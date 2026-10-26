/**
 * Nucleo del contratto di vendita: dati -> HTML, calcoli e testi.
 *
 * È codice "puro" (nessun servizio Google): la stessa funzione gira nello script
 * (per il PDF) e nel browser (per l'anteprima dal vivo), dove viene inviata come
 * sorgente con contrattoNucleo.toString(). Per questo NON deve usare nulla di
 * definito fuori da sé: tutto ciò che serve arriva da `risorse`.
 *
 * Struttura dei dati di un contratto (vedi datiVuoti()):
 *  numero, sottotitolo, preventivo {numero, data}, dataSottoscrizione,
 *  cliente {titolo, nome, cognome, codiceFiscale, indirizzo, indirizzo2, cap, comune, provincia, telefono, email},
 *  righe [{descrizione, dettaglio, quantita, prezzo, sconto, etichettaSconto, etichettaDopoSconto, omaggio}],
 *  notaFornitura, spedizioneInclusa,
 *  pagamento {modalita, finanziaria, rate, maggiorazione, acconto, testo},
 *  consegna {diversa, destinatario, indirizzo, indirizzo2, cap, comune, provincia, note},
 *  condizioni {prova, garanziaMesi, estensione, note}, luogo
 */
function contrattoNucleo(risorse) {
  var R = risorse || {};
  var LOGO = R.logo || '';
  var VENDITORE = R.venditore || '';
  var FIRMA_PER = R.firmaPer || 'Firma per Migelino';
  var TAGLINE = R.tagline || '';
  var PIE = R.pie || '';
  var EMAIL_SUPPORTO = R.emailSupporto || '';
  var SITO = R.sito || '';
  var PROVA_GIORNI = R.provaGiorni || 30;
  var GARANZIA_LEGALE_MESI = 24;
  var GARANZIA_MESI = R.garanziaMesi || GARANZIA_LEGALE_MESI;

  var MODALITA = [
    { codice: 'BONIFICO', nome: 'Bonifico bancario anticipato' },
    { codice: 'CARTA', nome: 'Carta o link di pagamento online' },
    { codice: 'FINANZIAMENTO', nome: 'Finanziamento a rate con finanziaria (es. HeyLight)' },
    { codice: 'RATE', nome: 'Rate mensili Migelino senza interessi' },
    { codice: 'ALTRO', nome: 'Altro (testo libero)' }
  ];
  var TITOLI = ['Sig.', 'Sig.ra', 'Dott.', 'Dott.ssa', ''];
  var RIGA_VUOTA = '____________________';

  // ------------------------------------------------------------------ utilità
  function str(x) {
    return x === null || x === undefined ? '' : String(x).replace(/\s+/g, ' ').trim();
  }

  function testoMultiriga(x) {
    return x === null || x === undefined ? '' : String(x).replace(/\r\n?/g, '\n').trim();
  }

  function bool(x, predefinito) {
    if (x === undefined || x === null || x === '') return predefinito;
    return x === true || x === 1 || x === 'true' || x === 'on' || x === '1';
  }

  /** Numero da testo in formato italiano ("3.580,00") o internazionale ("3580.5"). */
  function num(x) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    var s = String(x === null || x === undefined ? '' : x).replace(/[€\s]/g, '');
    if (!s) return 0;
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function intero(x, predefinito) {
    var n = Math.round(num(x));
    return n > 0 ? n : predefinito;
  }

  function arrotonda(n) {
    return Math.round(n * 100) / 100;
  }

  /** 3580 -> "3.580,00 €", -200 -> "- 200,00 €" */
  function euro(n) {
    var v = arrotonda(num(n));
    var negativo = v < 0;
    v = Math.abs(v);
    var parteIntera = Math.floor(v);
    var centesimi = Math.round((v - parteIntera) * 100);
    if (centesimi === 100) { parteIntera++; centesimi = 0; }
    var s = String(parteIntera).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (negativo ? '- ' : '') + s + ',' + (centesimi < 10 ? '0' : '') + centesimi + ' €';
  }

  function percentuale(n) {
    return String(arrotonda(num(n))).replace('.', ',') + '%';
  }

  /** "2026-09-28" -> "28/09/2026"; altri formati restano come sono. */
  function dataIt(s) {
    var t = str(s);
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    return m ? m[3] + '/' + m[2] + '/' + m[1] : t;
  }

  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escMultiriga(s) {
    return esc(testoMultiriga(s)).replace(/\n/g, '<br>');
  }

  function oVuoto(s) {
    var t = str(s);
    return t ? esc(t) : RIGA_VUOTA;
  }

  // --------------------------------------------------------------------- dati
  function rigaVuota() {
    return { descrizione: '', dettaglio: '', quantita: 1, prezzo: 0, sconto: 0, etichettaSconto: '', etichettaDopoSconto: '', omaggio: false };
  }

  function datiVuoti() {
    return {
      versione: 1,
      numero: '',
      sottotitolo: '',
      preventivo: { numero: '', data: '' },
      dataSottoscrizione: '',
      cliente: { titolo: 'Sig.', nome: '', cognome: '', codiceFiscale: '', indirizzo: '', indirizzo2: '', cap: '', comune: '', provincia: '', telefono: '', email: '' },
      righe: [rigaVuota()],
      notaFornitura: '',
      spedizioneInclusa: true,
      pagamento: { modalita: 'BONIFICO', finanziaria: 'HeyLight', rate: 12, maggiorazione: 6, acconto: 0, testo: '' },
      consegna: { diversa: false, destinatario: '', indirizzo: '', indirizzo2: '', cap: '', comune: '', provincia: '', note: '' },
      condizioni: { prova: true, garanziaMesi: GARANZIA_MESI, estensione: '', note: '' },
      luogo: ''
    };
  }

  function normalizzaRiga(r) {
    r = r || {};
    return {
      descrizione: str(r.descrizione),
      dettaglio: str(r.dettaglio),
      quantita: intero(r.quantita, 1),
      prezzo: Math.max(0, arrotonda(num(r.prezzo))),
      sconto: Math.max(0, arrotonda(num(r.sconto))),
      etichettaSconto: str(r.etichettaSconto),
      etichettaDopoSconto: str(r.etichettaDopoSconto),
      omaggio: bool(r.omaggio, false)
    };
  }

  function modalitaValida(codice) {
    var c = str(codice).toUpperCase();
    for (var i = 0; i < MODALITA.length; i++) if (MODALITA[i].codice === c) return c;
    return 'BONIFICO';
  }

  /** Riporta qualsiasi oggetto (anche parziale o con testi al posto dei numeri) alla struttura completa. */
  function normalizza(g) {
    g = g || {};
    var c = g.cliente || {};
    var p = g.pagamento || {};
    var k = g.consegna || {};
    var z = g.condizioni || {};
    var pv = g.preventivo || {};
    var righe = (Array.isArray(g.righe) ? g.righe : []).map(normalizzaRiga);
    if (!righe.length) righe = [rigaVuota()];
    return {
      versione: 1,
      numero: str(g.numero),
      sottotitolo: str(g.sottotitolo),
      preventivo: { numero: str(pv.numero), data: str(pv.data) },
      dataSottoscrizione: str(g.dataSottoscrizione),
      cliente: {
        titolo: c.titolo === undefined ? 'Sig.' : str(c.titolo),
        nome: str(c.nome), cognome: str(c.cognome),
        codiceFiscale: str(c.codiceFiscale).toUpperCase().replace(/[^A-Z0-9]/g, ''),
        indirizzo: str(c.indirizzo), indirizzo2: str(c.indirizzo2),
        cap: str(c.cap).replace(/\s/g, ''), comune: str(c.comune),
        provincia: str(c.provincia).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
        telefono: str(c.telefono), email: str(c.email).toLowerCase()
      },
      righe: righe,
      notaFornitura: testoMultiriga(g.notaFornitura),
      spedizioneInclusa: bool(g.spedizioneInclusa, true),
      pagamento: {
        modalita: modalitaValida(p.modalita),
        finanziaria: str(p.finanziaria) || 'HeyLight',
        rate: intero(p.rate, 12),
        maggiorazione: p.maggiorazione === undefined || p.maggiorazione === null || p.maggiorazione === '' ? 6 : Math.max(0, num(p.maggiorazione)),
        acconto: Math.max(0, arrotonda(num(p.acconto))),
        testo: testoMultiriga(p.testo)
      },
      consegna: {
        diversa: bool(k.diversa, false),
        destinatario: str(k.destinatario),
        indirizzo: str(k.indirizzo), indirizzo2: str(k.indirizzo2),
        cap: str(k.cap).replace(/\s/g, ''), comune: str(k.comune),
        provincia: str(k.provincia).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
        note: str(k.note)
      },
      condizioni: {
        prova: bool(z.prova, true),
        garanziaMesi: intero(z.garanziaMesi, GARANZIA_MESI),
        estensione: str(z.estensione),
        note: testoMultiriga(z.note)
      },
      luogo: str(g.luogo)
    };
  }

  function righeCompilate(dati) {
    return dati.righe.filter(function (r) { return r.descrizione || r.prezzo > 0; });
  }

  function nomeCliente(dati) {
    return str((dati.cliente.titolo ? dati.cliente.titolo + ' ' : '') + dati.cliente.nome + ' ' + dati.cliente.cognome);
  }

  // ------------------------------------------------------------------ calcoli
  /** Divide un totale in n rate al centesimo: rate uguali arrotondate per eccesso, ultima di conguaglio. */
  function pianoRate(totale, n) {
    var t = arrotonda(num(totale));
    n = intero(n, 1);
    if (n === 1 || t <= 0) return { n: n, rata: t, ultima: t, uguali: true };
    var rata = Math.ceil(t / n * 100) / 100;
    var ultima = arrotonda(t - rata * (n - 1));
    if (ultima <= 0) {
      rata = Math.floor(t / n * 100) / 100;
      ultima = arrotonda(t - rata * (n - 1));
    }
    return { n: n, rata: rata, ultima: ultima, uguali: Math.abs(rata - ultima) < 0.005 };
  }

  function testoPiano(piano) {
    if (piano.uguali) return piano.n + (piano.n === 1 ? ' rata da ' : ' rate da ') + euro(piano.rata) + '.';
    return (piano.n - 1) + (piano.n === 2 ? ' rata da ' : ' rate da ') + euro(piano.rata) + ' e ultima rata da ' + euro(piano.ultima) + '.';
  }

  function nomeModalita(codice) {
    for (var i = 0; i < MODALITA.length; i++) if (MODALITA[i].codice === codice) return MODALITA[i].nome;
    return codice;
  }

  /** Sezione 3: righe (etichetta, valore) e nota, secondo la modalità di pagamento. */
  function calcolaPagamento(dati, totale) {
    var p = dati.pagamento;
    var acconto = Math.min(p.acconto, totale);
    var residuo = arrotonda(totale - acconto);
    var righe = [];
    var nota = '';
    var esito = { modalita: p.modalita, nome: nomeModalita(p.modalita), totale: totale, acconto: acconto, residuo: residuo, interessi: 0, daRimborsare: residuo, piano: null };

    function importoEAcconto(etichettaResiduo) {
      righe.push(['Importo della fornitura', euro(totale)]);
      if (acconto > 0) {
        righe.push(['Acconto alla conferma', euro(acconto)]);
        righe.push([etichettaResiduo, euro(residuo)]);
      }
    }

    if (p.modalita === 'BONIFICO') {
      righe.push(['Modalità di pagamento concordata', 'bonifico bancario anticipato.']);
      importoEAcconto('Saldo prima della spedizione');
      nota = 'Le coordinate bancarie sono riportate nella conferma d\'ordine. La spedizione avviene dopo l\'accredito dell\'importo dovuto.';
    } else if (p.modalita === 'CARTA') {
      righe.push(['Modalità di pagamento concordata', 'pagamento online con carta tramite link di pagamento sicuro inviato via email.']);
      importoEAcconto('Saldo prima della spedizione');
      nota = 'Il link di pagamento viene inviato con la conferma d\'ordine. La spedizione avviene dopo l\'esito positivo del pagamento.';
    } else if (p.modalita === 'FINANZIAMENTO') {
      var n = Math.max(2, p.rate);
      var interessi = arrotonda(residuo * p.maggiorazione / 100);
      var daRimborsare = arrotonda(residuo + interessi);
      var piano = pianoRate(daRimborsare, n);
      esito.interessi = interessi;
      esito.daRimborsare = daRimborsare;
      esito.piano = piano;
      righe.push(['Modalità di pagamento concordata', p.finanziaria + ' - ' + n + ' rate mensili.']);
      importoEAcconto('Importo finanziato');
      if (p.maggiorazione > 0) righe.push(['Interessi complessivi concordati (' + percentuale(p.maggiorazione) + ' dell\'importo' + (acconto > 0 ? ' finanziato' : '') + ')', euro(interessi)]);
      else righe.push(['Interessi', 'nessuno (finanziamento a tasso zero).']);
      righe.push(['Totale da rimborsare', euro(daRimborsare)]);
      righe.push(['Piano di pagamento', testoPiano(piano)]);
      nota = 'Finanziamento soggetto all\'approvazione della finanziaria. ' +
        (p.maggiorazione > 0 ? 'Il ' + percentuale(p.maggiorazione) + ' è qui indicato come maggiorazione complessiva, in continuità con il preventivo, e non come TAN o TAEG. ' : '') +
        'TAN, TAEG, decorrenza delle rate e condizioni definitive sono riportati nel contratto di credito sottoscritto con la finanziaria.';
    } else if (p.modalita === 'RATE') {
      var nr = Math.max(2, p.rate);
      var pianoRateMigelino = pianoRate(residuo, nr);
      esito.piano = pianoRateMigelino;
      righe.push(['Modalità di pagamento concordata', 'pagamento dilazionato in ' + nr + ' rate mensili senza interessi, direttamente a Migelino.']);
      importoEAcconto('Importo dilazionato');
      righe.push(['Piano di pagamento', testoPiano(pianoRateMigelino)]);
      nota = 'La prima rata è dovuta alla conferma dell\'ordine e le successive a cadenza mensile, senza interessi né costi aggiuntivi. ' +
        'La proprietà degli apparecchi si trasferisce al pagamento dell\'ultima rata.';
    } else {
      righe.push(['Modalità di pagamento concordata', p.testo ? p.testo.replace(/\n+/g, ' ') : RIGA_VUOTA]);
      importoEAcconto('Saldo');
    }
    esito.righe = righe;
    esito.nota = nota;
    return esito;
  }

  /** Righe da stampare nella sezione 2, totale, omaggi e pagamento. */
  function calcola(datiGrezzi) {
    var dati = normalizza(datiGrezzi);
    var righe = [];
    var totale = 0;
    var omaggi = [];
    dati.righe.forEach(function (r, indice) {
      if (!r.descrizione && !(r.prezzo > 0)) return;
      var importo = arrotonda(r.quantita * r.prezzo);
      righe.push({ testo: r.descrizione || RIGA_VUOTA, importo: importo, tipo: 'voce', indice: indice });
      if (r.dettaglio) righe.push({ testo: r.dettaglio, importo: null, tipo: 'dettaglio', indice: indice });
      if (r.omaggio) {
        righe.push({ testo: r.etichettaSconto || 'Omaggio - sconto integrale', importo: -importo, tipo: 'omaggio', indice: indice });
        omaggi.push({ descrizione: r.descrizione, valore: importo });
      } else if (r.sconto > 0) {
        var sconto = Math.min(r.sconto, importo);
        righe.push({ testo: r.etichettaSconto || 'Sconto', importo: -sconto, tipo: 'sconto', indice: indice });
        righe.push({ testo: r.etichettaDopoSconto || 'Prezzo dopo lo sconto', importo: arrotonda(importo - sconto), tipo: 'subtotale', indice: indice });
        totale += importo - sconto;
      } else {
        totale += importo;
      }
    });
    totale = arrotonda(totale);
    return { dati: dati, righe: righe, totale: totale, omaggi: omaggi, pagamento: calcolaPagamento(dati, totale) };
  }

  // -------------------------------------------------------------------- testi
  function sottotitoloProposto(datiGrezzi) {
    var c = calcola(datiGrezzi);
    var voci = righeCompilate(c.dati).filter(function (r) { return !r.omaggio && r.descrizione; });
    var parti = [];
    if (voci.length) parti.push(voci[0].descrizione);
    if (c.omaggi.length && c.omaggi[0].descrizione) parti.push(c.omaggi[0].descrizione + ' incluso gratuitamente');
    return parti.join(' | ');
  }

  function notaFornituraProposta(datiGrezzi) {
    var c = calcola(datiGrezzi);
    var frasi = c.omaggi.map(function (o) {
      return 'In omaggio: ' + (o.descrizione || 'accessorio') + ' (valore ' + euro(o.valore) + ', importo addebitato 0,00 €).';
    });
    if (c.dati.spedizioneInclusa) frasi.push('Non sono previsti ulteriori addebiti di spedizione per questa fornitura.');
    return frasi.join(' ');
  }

  function indirizzoCompleto(x) {
    var via = x.indirizzo + (x.indirizzo2 ? ', ' + x.indirizzo2 : '');
    var localita = str(x.cap + ' ' + x.comune) + (x.provincia ? ' (' + x.provincia + ')' : '');
    return str(via + (via && localita ? ', ' : '') + localita);
  }

  function testiCondizioni(c) {
    var dati = c.dati;
    var m = dati.pagamento.modalita;
    var spedizione = m === 'FINANZIAMENTO' ? 'Per prodotti disponibili, spedizione entro 2-3 giorni lavorativi dall\'approvazione del finanziamento'
      : m === 'RATE' ? 'Per prodotti disponibili, spedizione entro 2-3 giorni lavorativi dall\'incasso della prima rata'
        : m === 'ALTRO' ? 'Per prodotti disponibili, spedizione entro 2-3 giorni lavorativi dal perfezionamento del pagamento concordato'
          : 'Per prodotti disponibili e pagamento anticipato, spedizione entro 2-3 giorni lavorativi dall\'accredito';
    var paragrafi = [];
    paragrafi.push(['Configurazione e assistenza.', 'La fornitura comprende preprogrammazione su documentazione audiologica idonea, ' +
      'ricevitori e cupoline necessari, kit iniziale di pulizia e filtri, regolazioni remote gratuite e illimitate durante la vita utile ' +
      'degli apparecchi. Le funzioni via app richiedono uno smartphone compatibile.']);
    paragrafi.push(['Conclusione e consegna.', 'L\'ordine è soggetto a conferma del venditore e verifica della documentazione audiologica. ' +
      spedizione + ', salvo diversa data concordata. La proprietà si trasferisce al saldo.']);
    if (dati.condizioni.prova) {
      paragrafi.push(['Prova e restituzione.', 'È prevista una prova convenzionale di ' + PROVA_GIORNI + ' giorni dal ricevimento. La richiesta va inviata a ' +
        (EMAIL_SUPPORTO || 'Migelino') + '; apparecchi e accessori' + (c.omaggi.length ? ', compreso l\'omaggio,' : '') +
        ' vanno restituiti integri nella confezione originale con spedizione tracciabile e assicurata. Rimborso entro 14 giorni dal rientro. ' +
        'Per dispositivi già provati prima dell\'ordine definitivo, si applica la disciplina specifica delle condizioni pubblicate, nei limiti di legge.']);
    } else {
      paragrafi.push(['Prova e restituzione.', 'Non è prevista una prova convenzionale oltre ai diritti riconosciuti dalla legge. ' +
        'Resta fermo il diritto di recesso ove applicabile.']);
    }
    var mesi = dati.condizioni.garanziaMesi;
    var garanzia = mesi > GARANZIA_LEGALE_MESI
      ? 'Periodo di garanzia: ' + mesi + ' mesi dalla consegna, di cui ' + GARANZIA_LEGALE_MESI + ' di garanzia legale di conformità e i restanti di garanzia commerciale. '
      : 'Periodo di garanzia: ' + GARANZIA_LEGALE_MESI + ' mesi dalla consegna (garanzia legale di conformità). ';
    if (dati.condizioni.estensione) garanzia += 'Estensione concordata: ' + dati.condizioni.estensione + (/[.!?]$/.test(dati.condizioni.estensione) ? ' ' : '. ');
    garanzia += 'Restano salvi tutti i diritti inderogabili del consumatore, inclusi i rimedi per difetti di conformità, il recesso ove applicabile e il foro competente previsto dalla legge.';
    if (c.omaggi.length) garanzia += ' L\'omaggio non limita tali diritti.';
    paragrafi.push(['Garanzia e diritti.', garanzia]);
    if (dati.condizioni.note) paragrafi.push(['Condizioni particolari.', dati.condizioni.note]);
    return paragrafi;
  }

  var TESTO_ACCETTAZIONE = 'Le parti accettano la fornitura e il prezzo sopra riportati. Le condizioni particolari di questo contratto prevalgono ' +
    'su importi e opzioni del preventivo precedente. I dati mancanti vanno completati prima della firma. Il cliente riceve copia del contratto ' +
    'e delle condizioni applicabili.';

  function testoPrivacy() {
    return 'Informativa privacy disponibile su ' + (SITO || 'richiesta') + '. L\'eventuale consenso al trattamento dei dati sanitari per il servizio remoto è raccolto separatamente.';
  }

  /** Testi delle sezioni 4 e 5 e consegna, già adattati ai dati: per chi disegna il contratto senza l'HTML (es. jsPDF). */
  function testi(c) {
    var dati = c.dati;
    var consegna = dati.consegna.diversa ? dati.consegna : dati.cliente;
    return {
      condizioni: testiCondizioni(c),
      accettazione: TESTO_ACCETTAZIONE,
      privacy: testoPrivacy(),
      consegnaIndirizzo: indirizzoCompleto(consegna),
      consegnaDestinatario: dati.consegna.destinatario || str(dati.cliente.nome + ' ' + dati.cliente.cognome),
      sottotitolo: dati.sottotitolo || sottotitoloProposto(dati),
      notaFornitura: dati.notaFornitura || notaFornituraProposta(dati)
    };
  }

  // --------------------------------------------------------------------- HTML
  var CSS = [
    '@page { size: A4; margin: 14mm 16mm 12mm 16mm; }',
    'body { font-family: Helvetica, Arial, sans-serif; font-size: 10pt; color: #222; margin: 0; padding: 0; line-height: 1.3; }',
    'table { border-collapse: collapse; width: 100%; }',
    'td { vertical-align: top; }',
    '.pagina { page-break-after: always; }',
    '.pagina.ultima { page-break-after: auto; }',
    'table.testata td { vertical-align: bottom; padding: 0 0 4pt 0; }',
    'table.testata td.tagline { font-size: 8.5pt; color: #666; padding-bottom: 10pt; }',
    'table.testata td.logo { text-align: right; width: 70pt; }',
    'table.testata img { width: 62pt; height: auto; }',
    '.riga-teal { border-top: 2px solid #209cae; margin: 0 0 14pt 0; height: 0; }',
    'h1 { font-size: 20pt; font-weight: bold; color: #333; margin: 0 0 3pt 0; }',
    '.sottotitolo { font-size: 11pt; color: #333; margin: 0 0 10pt 0; }',
    '.riferimenti { font-size: 9.5pt; margin: 0 0 6pt 0; }',
    '.riferimenti p { margin: 0 0 2pt 0; }',
    '.sezione { background: #f3f3f3; border-left: 4px solid #209cae; padding: 6pt 10pt; margin: 11pt 0 7pt 0; color: #209cae; font-weight: bold; font-size: 10.5pt; }',
    '.campi p { margin: 0 0 3pt 0; }',
    '.nota { font-size: 9.5pt; margin: 8pt 0 0 0; }',
    'table.fornitura td { padding: 6pt 8pt; border-bottom: 1px solid #e4e8e8; }',
    'table.fornitura td.importo { text-align: right; white-space: nowrap; width: 22%; }',
    'table.fornitura tr.dettaglio td { padding-top: 4pt; padding-bottom: 4pt; color: #333; }',
    'table.fornitura tr.subtotale td { font-weight: normal; }',
    'table.totale { margin-top: 8pt; }',
    'table.totale td { background: #209cae; color: #ffffff; font-weight: bold; font-size: 12pt; padding: 8pt 10pt; }',
    'table.totale td.importo { text-align: right; white-space: nowrap; width: 30%; }',
    '.para { margin: 0 0 6pt 0; text-align: left; }',
    '.luogo { margin: 8pt 0 0 0; }',
    'table.firme td { width: 50%; padding: 16pt 10pt 0 0; vertical-align: bottom; }',
    'table.firme td.dx { padding: 16pt 0 0 10pt; }',
    '.firma-img { height: 44pt; }',
    '.firma-img img { height: 44pt; width: auto; }',
    '.linea-firma { border-top: 1px solid #209cae; padding-top: 4pt; font-size: 9.5pt; margin-top: 4pt; }',
    '.firmatario { color: #555; font-size: 8.5pt; }',
    '.pie { margin-top: 12pt; border-top: 1px solid #cccccc; padding-top: 5pt; font-size: 8pt; color: #666; }',
    '.pie td.dx { text-align: right; white-space: nowrap; }'
  ].join('\n');

  // Solo nel browser (anteprima e stampa): fogli A4 visibili, piè di pagina in fondo alla pagina.
  var CSS_BROWSER = [
    'body { background: #e5e7eb; padding: 10px 0; }',
    '.pagina { position: relative; width: 178mm; min-height: 271mm; padding: 14mm 16mm 12mm 16mm; margin: 0 auto 12px auto; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.25); box-sizing: content-box; }',
    '.pie { position: absolute; left: 16mm; right: 16mm; bottom: 10mm; margin-top: 0; }',
    '@media print { body { background: #fff; padding: 0; } .pagina { box-shadow: none; margin: 0; width: 178mm; height: 271mm; min-height: 0; page-break-after: always; } .pagina.ultima { page-break-after: auto; } }'
  ].join('\n');

  function testata() {
    return '<table class="testata"><tr><td class="tagline">' + esc(TAGLINE) + '</td><td class="logo">' +
      (LOGO ? '<img src="' + LOGO + '" alt="Migelino">' : '') + '</td></tr></table><div class="riga-teal"></div>';
  }

  function pie(pagina, totali) {
    return '<div class="pie"><table><tr><td>' + esc(PIE) + '</td><td class="dx">Pagina ' + pagina + ' di ' + totali + '</td></tr></table></div>';
  }

  function sezione(titolo) {
    return '<div class="sezione">' + esc(titolo) + '</div>';
  }

  function campo(etichetta, valoreHtml) {
    return '<p><b>' + esc(etichetta) + ':</b> ' + valoreHtml + '</p>';
  }

  function pagina1(c, opzioni) {
    var dati = c.dati;
    var h = '';
    h += '<div class="pagina">' + testata();
    h += '<h1>CONTRATTO DI VENDITA</h1>';
    var sottotitolo = dati.sottotitolo || sottotitoloProposto(dati);
    if (sottotitolo) h += '<div class="sottotitolo">' + esc(sottotitolo) + '</div>';
    h += '<div class="riferimenti">';
    if (dati.numero) h += '<p>Contratto n. <b>' + esc(dati.numero) + '</b></p>';
    else if (opzioni.anteprima) h += '<p>Contratto n. <b>(assegnato alla generazione del PDF)</b></p>';
    if (dati.preventivo.numero || dati.preventivo.data) {
      h += '<p>Riferimento: preventivo' + (dati.preventivo.numero ? ' n. <b>' + esc(dati.preventivo.numero) + '</b>' : '') +
        (dati.preventivo.data ? ' del ' + esc(dataIt(dati.preventivo.data)) : '') + '</p>';
    }
    h += '<p>Data di sottoscrizione: ' + (dati.dataSottoscrizione ? esc(dataIt(dati.dataSottoscrizione)) : RIGA_VUOTA) + '</p>';
    h += '</div>';

    h += sezione('1. PARTI E DATI DEL CLIENTE');
    h += '<div class="campi">';
    h += campo('Venditore', esc(VENDITORE));
    h += campo('Cliente', oVuoto(nomeCliente(dati)));
    h += campo('Codice fiscale', dati.cliente.codiceFiscale ? '<b>' + esc(dati.cliente.codiceFiscale) + '</b>' : RIGA_VUOTA);
    h += campo('Indirizzo', oVuoto(dati.cliente.indirizzo + (dati.cliente.indirizzo2 ? ', ' + dati.cliente.indirizzo2 : '')));
    h += campo('CAP / Comune / Provincia', oVuoto(str(dati.cliente.cap + ' ' + dati.cliente.comune) + (dati.cliente.provincia ? ' (' + dati.cliente.provincia + ')' : '')));
    h += campo('Telefono', oVuoto(dati.cliente.telefono));
    h += campo('E-mail', oVuoto(dati.cliente.email));
    h += '</div>';

    h += sezione('2. FORNITURA E PREZZO CONCORDATO');
    h += '<table class="fornitura">';
    if (!c.righe.length) h += '<tr><td>' + RIGA_VUOTA + '</td><td class="importo"></td></tr>';
    c.righe.forEach(function (r) {
      h += '<tr class="' + r.tipo + '"><td>' + esc(r.testo) + '</td><td class="importo">' + (r.importo === null ? '' : esc(euro(r.importo))) + '</td></tr>';
    });
    h += '</table>';
    h += '<table class="totale"><tr><td>TOTALE CONTRATTO - IVA INCLUSA</td><td class="importo">' + esc(euro(c.totale)) + '</td></tr></table>';
    var nota = dati.notaFornitura || notaFornituraProposta(dati);
    if (nota) h += '<p class="nota">' + escMultiriga(nota) + '</p>';
    h += pie(1, 2) + '</div>';
    return h;
  }

  function pagina2(c, opzioni) {
    var dati = c.dati;
    var h = '<div class="pagina ultima">' + testata();
    h += sezione('3. PAGAMENTO E CONSEGNA');
    h += '<div class="campi">';
    c.pagamento.righe.forEach(function (r) { h += campo(r[0], esc(r[1])); });
    var consegna = dati.consegna.diversa ? dati.consegna : dati.cliente;
    var destinatario = dati.consegna.destinatario || str(dati.cliente.nome + ' ' + dati.cliente.cognome);
    h += '<p><b>Indirizzo di consegna:</b> ' + oVuoto(indirizzoCompleto(consegna)) + '. Nome destinatario: ' + oVuoto(destinatario) +
      (dati.consegna.note ? '. ' + esc(dati.consegna.note) : '') + '</p>';
    if (c.pagamento.nota) h += '<p class="nota">' + esc(c.pagamento.nota) + '</p>';
    h += '</div>';

    h += sezione('4. SERVIZI E CONDIZIONI DELLA FORNITURA');
    testiCondizioni(c).forEach(function (p) {
      h += '<p class="para"><b>' + esc(p[0]) + '</b> ' + escMultiriga(p[1]) + '</p>';
    });

    h += sezione('5. ACCETTAZIONE E FIRME');
    h += '<p class="para">' + esc(TESTO_ACCETTAZIONE) + '</p>';
    h += '<p class="para">' + esc(testoPrivacy()) + '</p>';
    h += '<p class="luogo">Luogo e data: ' + (dati.luogo ? esc(dati.luogo) + ', ' : '') + '______________________________</p>';
    var firma = opzioni.firma || {};
    h += '<table class="firme"><tr>';
    h += '<td><div class="firma-img"></div><div class="linea-firma">Firma del cliente</div></td>';
    h += '<td class="dx"><div class="firma-img">' + (firma.immagine ? '<img src="' + esc(firma.immagine) + '" alt="Firma">' : '') + '</div>';
    h += '<div class="linea-firma">' + esc(FIRMA_PER) + (firma.nome ? '<br><span class="firmatario">' + esc(firma.nome) + '</span>' : '') + '</div></td>';
    h += '</tr></table>';
    h += pie(2, 2) + '</div>';
    return h;
  }

  /**
   * HTML completo del contratto.
   * opzioni.anteprima: true nel browser (fogli visibili, avvisi sui campi non ancora assegnati)
   * opzioni.browser: true per anteprima e stampa dal browser (CSS aggiuntivo)
   * opzioni.firma: { immagine: dataURI, nome: 'Nome Cognome' } firma dell'operatore
   */
  function html(datiGrezzi, opzioni) {
    opzioni = opzioni || {};
    var c = calcola(datiGrezzi);
    var titolo = 'Contratto di vendita' + (c.dati.cliente.cognome ? ' - ' + c.dati.cliente.cognome : '');
    return '<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>' + esc(titolo) + '</title>' +
      '<style>' + CSS + (opzioni.browser || opzioni.anteprima ? '\n' + CSS_BROWSER : '') + '</style></head><body>' +
      pagina1(c, opzioni) + pagina2(c, opzioni) + '</body></html>';
  }

  return {
    MODALITA: MODALITA,
    TITOLI: TITOLI,
    datiVuoti: datiVuoti,
    rigaVuota: rigaVuota,
    normalizza: normalizza,
    calcola: calcola,
    pianoRate: pianoRate,
    html: html,
    testi: testi,
    indirizzoCompleto: indirizzoCompleto,
    sottotitoloProposto: sottotitoloProposto,
    notaFornituraProposta: notaFornituraProposta,
    nomeCliente: nomeCliente,
    euro: euro,
    num: num,
    dataIt: dataIt,
    esc: esc
  };
}

/** Risorse del nucleo lato script (logo e testi fissi, con le eventuali sovrascritture dalle Proprietà). */
function contrattoRisorse() {
  var c = CONFIG.CONTRATTO;
  return {
    logo: typeof LOGO_MIGELINO === 'string' ? LOGO_MIGELINO : '',
    venditore: Impostazioni.leggi(CHIAVI.CONTRATTO_VENDITORE, c.VENDITORE),
    firmaPer: c.FIRMA_PER,
    tagline: c.TAGLINE,
    pie: Impostazioni.leggi(CHIAVI.CONTRATTO_PIE, c.PIE),
    emailSupporto: c.EMAIL_SUPPORTO,
    sito: c.SITO,
    provaGiorni: c.PROVA_GIORNI,
    garanziaMesi: c.GARANZIA_MESI
  };
}
