/**
 * Controlli sui dati del contratto prima di generare il PDF (solo lato script:
 * usa codice fiscale, comuni, telefono e maiuscole dei moduli esistenti).
 *
 *  errori  = bloccanti: il PDF non viene generato
 *  avvisi  = da controllare: il PDF viene generato comunque
 *  dati    = dati normalizzati (maiuscole, comune ufficiale, telefono) da usare per il PDF
 */

var ContrattoControlli = (function () {
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function nucleo() {
    return contrattoNucleo(contrattoRisorse());
  }

  /** Data accettata in formato ISO (2026-09-28) o italiano (28/09/2026); restituisce ISO o '' se non riconosciuta. */
  function dataIso(testo) {
    var t = String(testo || '').trim();
    if (!t) return '';
    var iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    var ita = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(t);
    var a, m, g;
    if (iso) { a = Number(iso[1]); m = Number(iso[2]); g = Number(iso[3]); }
    else if (ita) { a = Number(ita[3]); m = Number(ita[2]); g = Number(ita[1]); }
    else return null;
    var d = new Date(Date.UTC(a, m - 1, g));
    if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== g) return null; // es. 31/02
    return a + '-' + (m < 10 ? '0' : '') + m + '-' + (g < 10 ? '0' : '') + g;
  }

  /** "+393331234567" -> "333 123 4567" (cellulari); fissi "+39 0612345678" (il prefisso ha lunghezza variabile); altri invariati. */
  function telefonoLeggibile(e164) {
    var m = /^\+39(3\d{2})(\d{3})(\d{3,4})$/.exec(e164);
    if (m) return m[1] + ' ' + m[2] + ' ' + m[3];
    var f = /^\+39(0\d{5,10})$/.exec(e164);
    if (f) return '+39 ' + f[1];
    return e164;
  }

  function controllaIndirizzo(x, prefisso, bloccante, errori, avvisi) {
    var mancanti = bloccante ? errori : avvisi;
    if (!x.indirizzo) mancanti.push(prefisso + 'indirizzo mancante');
    else if (!Indirizzi.separaCivico(x.indirizzo, '').civico) avvisi.push(prefisso + 'numero civico non riconosciuto nell\'indirizzo "' + x.indirizzo + '"');
    if (!/^\d{5}$/.test(x.cap)) mancanti.push(prefisso + 'CAP mancante o non valido (5 cifre)');
    if (!x.comune) mancanti.push(prefisso + 'comune mancante');
    if (!x.provincia) mancanti.push(prefisso + 'provincia mancante (sigla, es. NA)');
    else if (!Comuni.siglaValida(x.provincia)) errori.push(prefisso + 'provincia "' + x.provincia + '" non valida');
    var provinciaOk = x.provincia && Comuni.siglaValida(x.provincia);
    if (/^\d{5}$/.test(x.cap) && provinciaOk && Comuni.capCoerente(x.cap, x.provincia) === false) {
      errori.push(prefisso + 'CAP ' + x.cap + ' non compatibile con la provincia ' + x.provincia);
    }
    var comune = x.comune && provinciaOk ? Comuni.trova(x.comune, x.provincia) : null;
    if (comune) {
      x.comune = comune.nome; // nome ufficiale
    } else if (x.comune) {
      if (provinciaOk) avvisi.push(prefisso + 'comune "' + x.comune + '" non trovato in tabella per la provincia ' + x.provincia + ': controlla il nome (frazione?)');
      x.comune = Testo.maiuscoleIndirizzo(x.comune);
    }
    if (x.indirizzo) x.indirizzo = Testo.maiuscoleIndirizzo(x.indirizzo);
  }

  function valida(datiGrezzi) {
    var n = nucleo();
    var dati = n.normalizza(datiGrezzi);
    var errori = [];
    var avvisi = [];
    var c = dati.cliente;

    // Cliente
    c.nome = Testo.maiuscoleNome(c.nome);
    c.cognome = Testo.maiuscoleNome(c.cognome);
    if (!c.nome) errori.push('Nome del cliente mancante');
    if (!c.cognome) errori.push('Cognome del cliente mancante');
    if (c.codiceFiscale) {
      if (!CodiceFiscale.valido(c.codiceFiscale)) {
        errori.push('Codice fiscale "' + c.codiceFiscale + '" non valido (formato o carattere di controllo)');
      } else if (c.nome && c.cognome) {
        var coerenza = CodiceFiscale.verificaCoerenza(c.codiceFiscale, { nome: c.nome, cognome: c.cognome });
        if (coerenza.cognome === false || coerenza.nome === false) {
          avvisi.push('Il codice fiscale non corrisponde a nome e cognome indicati: controlla prima di firmare');
        }
      }
    } else {
      avvisi.push('Codice fiscale mancante: nel PDF resta una riga da completare a mano prima della firma');
    }
    controllaIndirizzo(c, '', true, errori, avvisi);
    if (c.telefono) {
      var e164 = Telefono.normalizza(c.telefono, 'IT');
      if (e164) c.telefono = telefonoLeggibile(e164);
      else avvisi.push('Telefono "' + c.telefono + '" non riconosciuto: viene stampato così com\'è');
    } else {
      avvisi.push('Telefono mancante');
    }
    if (c.email) {
      if (!EMAIL.test(c.email)) avvisi.push('E-mail "' + c.email + '" non sembra valida');
    } else {
      avvisi.push('E-mail mancante: senza email non si può preparare la bozza di invio');
    }

    // Date
    [['preventivo', 'data', 'Data del preventivo'], [null, 'dataSottoscrizione', 'Data di sottoscrizione']].forEach(function (v) {
      var contenitore = v[0] ? dati[v[0]] : dati;
      var iso = dataIso(contenitore[v[1]]);
      if (iso === null) avvisi.push(v[2] + ' "' + contenitore[v[1]] + '" non riconosciuta (usa gg/mm/aaaa): viene stampata così com\'è');
      else if (iso) contenitore[v[1]] = iso;
    });

    // Fornitura
    var calcolo = n.calcola(dati);
    var compilate = dati.righe.filter(function (r) { return r.descrizione || r.prezzo > 0; });
    if (!compilate.length) errori.push('Inserisci almeno una voce di fornitura');
    compilate.forEach(function (r, i) {
      var importo = r.quantita * r.prezzo;
      if (!r.descrizione) errori.push('Voce ' + (i + 1) + ': descrizione mancante');
      if (r.prezzo <= 0 && !r.omaggio) avvisi.push('Voce ' + (i + 1) + ' "' + r.descrizione + '": prezzo pari a zero');
      if (!r.omaggio && r.sconto > importo) avvisi.push('Voce ' + (i + 1) + ': sconto superiore all\'importo, limitato a ' + n.euro(importo));
      if (r.omaggio && r.prezzo <= 0) avvisi.push('Voce ' + (i + 1) + ': omaggio senza valore indicato');
    });
    if (compilate.length && calcolo.totale <= 0) errori.push('Il totale del contratto è pari a zero');

    // Pagamento
    var p = dati.pagamento;
    if ((p.modalita === 'FINANZIAMENTO' || p.modalita === 'RATE') && p.rate < 2) errori.push('Numero di rate non valido (minimo 2)');
    if (p.modalita === 'FINANZIAMENTO' && p.maggiorazione > 30) avvisi.push('Maggiorazione del finanziamento superiore al 30%: controlla');
    if (p.modalita === 'FINANZIAMENTO' && !p.finanziaria) errori.push('Indica il nome della finanziaria');
    if (p.modalita === 'ALTRO' && !p.testo) errori.push('Descrivi la modalità di pagamento (campo "Altro")');
    if (p.acconto > 0 && calcolo.totale > 0 && p.acconto >= calcolo.totale) errori.push('L\'acconto è pari o superiore al totale del contratto');

    // Consegna
    if (dati.consegna.diversa) controllaIndirizzo(dati.consegna, 'Consegna: ', true, errori, avvisi);
    if (dati.consegna.destinatario) dati.consegna.destinatario = Testo.maiuscoleNome(dati.consegna.destinatario);

    // Condizioni
    if (dati.condizioni.garanziaMesi < 24) {
      avvisi.push('Garanzia inferiore a 24 mesi: nel PDF viene indicata comunque la garanzia legale di 24 mesi');
      dati.condizioni.garanziaMesi = 24;
    }

    return { errori: errori, avvisi: avvisi, dati: dati, totale: calcolo.totale };
  }

  return { valida: valida, dataIso: dataIso, telefonoLeggibile: telefonoLeggibile };
})();
