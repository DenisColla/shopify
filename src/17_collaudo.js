/**
 * Collaudo sullo storico (sola lettura: non scrive su Shopify né su Gmail).
 *
 * Verità di riferimento:
 *  - POSITIVI: conversazioni in cui Migelino ha inoltrato la mail del paziente
 *    all'ufficio ordini -> erano conferme; l'anagrafica creata a mano
 *    dall'ufficio in Shopify è il confronto per i campi estratti.
 *  - NEGATIVI: messaggi di pazienti con cui Migelino ha parlato ma che non hanno
 *    portato a un inoltro -> non dovrebbero essere riconosciuti come conferme.
 *
 * Gira a blocchi (trigger ogni 5 minuti) finché tutti i casi sono elaborati,
 * poi scrive il foglio "Riepilogo collaudo" con le misure per ogni soglia.
 */

var Collaudo = (function () {
  var INTESTAZIONI_CASI = ['#', 'Tipo', 'Email', 'Thread', 'Messaggio', 'Riferimento (ms)', 'Stato'];
  var INTESTAZIONI_RISULTATI = ['#', 'Tipo', 'Email', 'Mail', 'Esito riconoscimento', 'Prob.', 'Frase', 'Decisione',
    'Mancanti', 'Nome', 'Cognome', 'CF', 'Residenza', 'Spedizione', 'Telefono', 'Dettaglio (JSON)'];
  var SOGLIE = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95];
  var CAMPI = ['nome', 'cognome', 'cf', 'residenza', 'spedizione', 'telefono'];
  var GIORNI = 180;
  var MAX_NEGATIVI = 90;

  function esterno(m) {
    var email = Testo.estraiEmail(m.getFrom());
    return !Prefiltro.interno(email) && !Prefiltro.automatico(email);
  }

  /** Ultimo messaggio del paziente prima di "limiteMs", cercando in tutte le sue conversazioni. */
  function ultimoMessaggioPaziente(email, limiteMs) {
    var threads = GmailApp.search('from:' + email + ' newer_than:' + (GIORNI + 30) + 'd', 0, 20);
    var migliore = null;
    threads.forEach(function (t) {
      t.getMessages().forEach(function (m) {
        var ms = m.getDate().getTime();
        if (ms > limiteMs || Testo.estraiEmail(m.getFrom()) !== email) return;
        if (!migliore || ms > migliore.getDate().getTime()) migliore = m;
      });
    });
    return migliore;
  }

  /** Costruisce l'elenco dei casi e avvia l'elaborazione a blocchi. */
  function avvia() {
    var inizio = Date.now();
    var casi = [];
    var positivi = {};
    var ufficio = String(Impostazioni.obbligatoria(CHIAVI.EMAIL_UFFICIO_ORDINI)).toLowerCase().trim();

    // Solo gli inoltri che parlano di ordini/spedizioni (non quelli per pagamenti o domande).
    var inoltri = GmailApp.search('in:sent to:' + ufficio + ' newer_than:' + GIORNI + 'd' +
      ' (ordine OR sped OR spedire OR spedizione OR confermato OR conferma OR creare)', 0, 150);
    inoltri.forEach(function (t) {
      var messaggi = t.getMessages();
      var inoltro = null;
      for (var i = 0; i < messaggi.length; i++) {
        var m = messaggi[i];
        if (Prefiltro.interno(Testo.estraiEmail(m.getFrom())) && m.getTo().toLowerCase().indexOf(ufficio) >= 0) {
          inoltro = m;
          break;
        }
      }
      if (!inoltro) return;
      var limite = inoltro.getDate().getTime();
      var email = '';
      var esterni = messaggi.filter(function (m) { return esterno(m) && m.getDate().getTime() <= limite; });
      if (esterni.length) {
        email = Testo.estraiEmail(esterni[esterni.length - 1].getFrom());
      } else {
        var trovato = /(?:Da|From):\s*[^<\n]*<([^>\s]+@[^>\s]+)>/i.exec(inoltro.getPlainBody() || '');
        if (trovato) email = trovato[1].toLowerCase();
      }
      if (!email || Prefiltro.interno(email) || Prefiltro.automatico(email) || positivi[email]) return;
      var conferma = ultimoMessaggioPaziente(email, limite);
      if (!conferma) return;
      positivi[email] = true;
      casi.push(['POSITIVO', email, conferma.getThread().getId(), conferma.getId(), limite]);
    });

    var candidati = GmailApp.search('in:inbox newer_than:120d -from:me -category:promotions -category:social', 0, 300);
    var negativi = 0;
    var visti = {};
    for (var k = 0; k < candidati.length && negativi < MAX_NEGATIVI && Date.now() - inizio < CONFIG.MAX_MS_ESECUZIONE; k++) {
      var msgs = candidati[k].getMessages().filter(esterno);
      if (!msgs.length) continue;
      var ultimo = msgs[msgs.length - 1];
      var email2 = Testo.estraiEmail(ultimo.getFrom());
      if (positivi[email2] || visti[email2]) continue;
      visti[email2] = true;
      var dto = Posta.dto(ultimo);
      if (!Prefiltro.valuta(dto, { haRelazione: Posta.haRelazione(email2) }).passa) continue;
      casi.push(['NEGATIVO', email2, dto.threadId, dto.id, dto.dataMs]);
      negativi++;
    }

    var foglioCasi = Registro.foglio(CONFIG.FOGLI.COLLAUDO_CASI, INTESTAZIONI_CASI);
    foglioCasi.clearContents();
    foglioCasi.getRange(1, 1, 1, INTESTAZIONI_CASI.length).setValues([INTESTAZIONI_CASI]).setFontWeight('bold');
    if (casi.length) {
      foglioCasi.getRange(2, 1, casi.length, INTESTAZIONI_CASI.length).setValues(casi.map(function (c, i) {
        return [i + 1].concat(c).concat(['DA_FARE']);
      }));
    }
    var foglioRisultati = Registro.foglio(CONFIG.FOGLI.COLLAUDO, INTESTAZIONI_RISULTATI);
    foglioRisultati.clearContents();
    foglioRisultati.getRange(1, 1, 1, INTESTAZIONI_RISULTATI.length).setValues([INTESTAZIONI_RISULTATI]).setFontWeight('bold');

    impostaTrigger(true);
    return { positivi: Object.keys(positivi).length, negativi: negativi };
  }

  function impostaTrigger(attivo) {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'continuaCollaudo') ScriptApp.deleteTrigger(t);
    });
    if (attivo) ScriptApp.newTrigger('continuaCollaudo').timeBased().everyMinutes(5).create();
  }

  // ------------------------------------------------------------ verità di riferimento
  function riferimentoShopify(email) {
    var c = Shopify.cercaCliente(email);
    if (!c) return null;
    var residenza = null;
    c.indirizzi.forEach(function (i) { if (CodiceFiscale.formatoValido(i.company)) residenza = residenza || i; });
    if (!residenza && c.indirizzi.length === 1) residenza = c.indirizzi[0];
    var spedizione = null;
    c.indirizzi.forEach(function (i) { if (i.id === c.defaultAddressId) spedizione = i; });
    return {
      nome: c.firstName, cognome: c.lastName, telefono: c.phone,
      cf: residenza && CodiceFiscale.formatoValido(residenza.company) ? CodiceFiscale.normalizza(residenza.company) : '',
      residenza: residenza ? residenza.interno : null,
      spedizione: spedizione ? spedizione.interno : null
    };
  }

  function indirizzoEstratto(x) {
    if (!x || !(String(x.via || '') + String(x.cap || '')).trim()) return null;
    return Indirizzi.normalizza({ via: x.via, civico: x.civico, cap: x.cap, comune: x.comune, provincia: x.provincia, paese: x.paese });
  }

  /** Valori grezzi estratti con confidenza e correttezza rispetto a Shopify. */
  function confronta(e, rif) {
    var residenza = indirizzoEstratto(e.residenza);
    var spedizione = e.spedizione && e.spedizione.stessa_della_residenza === 'SI' ? residenza : indirizzoEstratto(e.spedizione && e.spedizione.indirizzo);
    var confSpedizione = e.spedizione && e.spedizione.stessa_della_residenza === 'SI' ? (e.residenza || {}).confidenza : ((e.spedizione || {}).indirizzo || {}).confidenza;
    function esito(valore, confidenza, giusto) {
      return { presente: !!valore, confidenza: Number(confidenza) || 0, giusto: valore ? !!giusto : null };
    }
    return {
      nome: esito(e.nome.valore, e.nome.confidenza, rif && Testo.chiave(e.nome.valore) === Testo.chiave(rif.nome)),
      cognome: esito(e.cognome.valore, e.cognome.confidenza, rif && Testo.chiave(e.cognome.valore) === Testo.chiave(rif.cognome)),
      cf: esito(e.codice_fiscale.valore, e.codice_fiscale.confidenza, rif && rif.cf && CodiceFiscale.normalizza(e.codice_fiscale.valore) === rif.cf),
      residenza: esito(residenza, (e.residenza || {}).confidenza, rif && rif.residenza && Indirizzi.uguali(residenza, rif.residenza)),
      spedizione: esito(spedizione, confSpedizione, rif && rif.spedizione && Indirizzi.uguali(spedizione, rif.spedizione)),
      telefono: esito(e.telefono.valore, e.telefono.confidenza, rif && rif.telefono && Telefono.normalizza(e.telefono.valore) === rif.telefono)
    };
  }

  function simbolo(c) {
    if (!c || !c.presente) return '—';
    return (c.giusto ? '✓ ' : '✗ ') + Math.round(c.confidenza * 100) + '%';
  }

  function elaboraCaso(riga) {
    var tipo = riga[1];
    var email = riga[2];
    var threadId = riga[3];
    var messaggioId = riga[4];
    var riferimento = Number(riga[5]);
    var r = Classificatore.classifica(Posta.conversazione(threadId, messaggioId));
    var fila = [riga[0], tipo, email, Posta.link(threadId), r.esito, Math.round((Number(r.probabilita) || 0) * 100) + '%', r.frase_chiave];
    var dettaglio = { tipo: tipo, esito: r.esito, probabilita: Number(r.probabilita) || 0 };
    if (tipo !== 'POSITIVO') return fila.concat(['', '', '', '', '', '', '', '', JSON.stringify(dettaglio)]);

    var raccolta = Posta.dossier(email, riferimento);
    var messaggio = GmailApp.getMessageById(messaggioId);
    var e = Estrattore.estrai({
      mittente: { nome: Testo.estraiNomeMittente(messaggio.getFrom()), email: email },
      tipoConferma: r.tipo, dataConferma: Posta.dataIso(messaggio.getDate()),
      allegati: raccolta.allegati, nonLeggibili: raccolta.nonLeggibili, messaggi: raccolta.messaggi
    });
    var piano = Decisione.valuta({ estrazione: e, email: email, clienteEsistente: null, soglia: Impostazioni.sogliaCampo(),
      tipoConferma: r.tipo, dataConferma: Posta.dataIso(messaggio.getDate()) });
    var rif = riferimentoShopify(email);
    var c = confronta(e, rif);
    dettaglio.campi = c;
    dettaglio.decisione = piano.esito;
    dettaglio.riferimento = !!rif;
    return fila.concat([piano.esito, (piano.mancanti || []).join('; '),
      simbolo(c.nome), simbolo(c.cognome), simbolo(c.cf), simbolo(c.residenza), simbolo(c.spedizione), simbolo(c.telefono),
      JSON.stringify(dettaglio)]);
  }

  /** Elabora i casi rimasti finché c'è tempo; alla fine scrive il riepilogo. */
  function continua() {
    var inizio = Date.now();
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return;
    try {
      var foglioCasi = Registro.foglio(CONFIG.FOGLI.COLLAUDO_CASI, INTESTAZIONI_CASI);
      var foglioRisultati = Registro.foglio(CONFIG.FOGLI.COLLAUDO, INTESTAZIONI_RISULTATI);
      var righe = foglioCasi.getDataRange().getValues();
      var rimasti = 0;
      for (var i = 1; i < righe.length; i++) {
        if (righe[i][6] !== 'DA_FARE') continue;
        if (Date.now() - inizio > CONFIG.MAX_MS_ESECUZIONE) { rimasti++; continue; }
        try {
          foglioRisultati.appendRow(elaboraCaso(righe[i]));
          foglioCasi.getRange(i + 1, 7).setValue('FATTO');
        } catch (e) {
          foglioCasi.getRange(i + 1, 7).setValue('ERRORE: ' + String(e.message || e).slice(0, 200));
        }
      }
      if (!rimasti) {
        impostaTrigger(false);
        scriviRiepilogo(foglioRisultati.getDataRange().getValues().slice(1));
      }
    } finally {
      lock.releaseLock();
    }
  }

  function percentuale(a, b) {
    return b ? Math.round((a / b) * 1000) / 10 + '%' : '—';
  }

  /** Misure per soglia: riconoscimento (precisione/richiamo) e campi (accuratezza/copertura). */
  function scriviRiepilogo(risultati) {
    var dettagli = risultati.map(function (r) {
      try { return JSON.parse(r[15]); } catch (e) { return null; }
    }).filter(Boolean);
    var righe = [['RICONOSCIMENTO DELLA CONFERMA', '', '', '', '', '', ''],
      ['Soglia', 'Conferme giuste', 'Falsi allarmi', 'Conferme perse', 'Negativi giusti', 'Precisione', 'Richiamo']];
    SOGLIE.forEach(function (s) {
      var vp = 0, fp = 0, fn = 0, vn = 0;
      dettagli.forEach(function (d) {
        var predetto = d.esito === 'CONFERMA' && d.probabilita >= s;
        if (d.tipo === 'POSITIVO') { if (predetto) vp++; else fn++; } else { if (predetto) fp++; else vn++; }
      });
      righe.push([s, vp, fp, fn, vn, percentuale(vp, vp + fp), percentuale(vp, vp + fn)]);
    });
    righe.push(['', '', '', '', '', '', '']);
    righe.push(['CAMPI (positivi con anagrafica di riferimento in Shopify)', '', '', '', '', '', '']);
    righe.push(['Campo', 'Soglia', 'Scritti', 'Giusti', 'Accuratezza', 'Copertura', '']);
    var conRif = dettagli.filter(function (d) { return d.tipo === 'POSITIVO' && d.riferimento && d.campi; });
    CAMPI.forEach(function (campo) {
      SOGLIE.forEach(function (s) {
        var scritti = 0, giusti = 0;
        conRif.forEach(function (d) {
          var c = d.campi[campo];
          if (c && c.presente && c.confidenza >= s) { scritti++; if (c.giusto) giusti++; }
        });
        righe.push([campo, s, scritti, giusti, percentuale(giusti, scritti), percentuale(scritti, conRif.length), '']);
      });
    });
    righe.push(['', '', '', '', '', '', '']);
    var positivi = dettagli.filter(function (d) { return d.tipo === 'POSITIVO'; });
    var creabili = positivi.filter(function (d) { return d.decisione === 'CREA'; });
    righe.push(['DECISIONE CON LA SOGLIA ATTUALE (' + Impostazioni.sogliaCampo() + ')', '', '', '', '', '', '']);
    righe.push(['Positivi', positivi.length, 'Anagrafica creabile', creabili.length, percentuale(creabili.length, positivi.length), '', '']);
    var f = Registro.foglio(CONFIG.FOGLI.RIEPILOGO, []);
    f.clearContents();
    f.getRange(1, 1, righe.length, 7).setValues(righe);
  }

  return { avvia: avvia, continua: continua, scriviRiepilogo: scriviRiepilogo, confronta: confronta };
})();
