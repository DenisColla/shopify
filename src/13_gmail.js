/**
 * Gmail: lettura dei messaggi e degli allegati, etichette.
 * Nulla viene inviato, cancellato o segnato come letto.
 */

var Posta = (function () {
  var FUSO = 'Europe/Rome';
  var TIPI_LEGGIBILI = { 'application/pdf': true, 'image/jpeg': true, 'image/jpg': true, 'image/png': true, 'image/gif': true, 'image/webp': true };
  var TIPI_NON_LEGGIBILI = /^image\/(heic|heif|tiff?|bmp)$/i;
  var NOMI_AUDIOMETRIA = /audiometr|audiogram|esame|tonale|vocale|timpan|impedenz/i;

  function ruolo(email) {
    return Prefiltro.interno(email) ? 'MIGELINO' : 'PAZIENTE';
  }

  function dataTesto(d) {
    return Utilities.formatDate(d, FUSO, 'dd/MM/yyyy HH:mm');
  }

  function dataIso(d) {
    return Utilities.formatDate(d, FUSO, 'yyyy-MM-dd');
  }

  function allegatiDi(m) {
    var normali = m.getAttachments({ includeInlineImages: false, includeAttachments: true }) || [];
    var inLinea = m.getAttachments({ includeInlineImages: true, includeAttachments: false }) || [];
    return normali.map(function (a) { return { blob: a, inLinea: false }; })
      .concat(inLinea.map(function (a) { return { blob: a, inLinea: true }; }));
  }

  /** Messaggio Gmail -> struttura semplice usata dal resto del codice. */
  function dto(m) {
    var da = m.getFrom();
    var email = Testo.estraiEmail(da);
    var corpo = m.getPlainBody() || '';
    var data = m.getDate();
    return {
      id: m.getId(),
      threadId: m.getThread().getId(),
      dataMs: data.getTime(),
      data: dataTesto(data),
      dataIso: dataIso(data),
      mittente: email,
      nome: Testo.estraiNomeMittente(da),
      oggetto: m.getSubject() || '',
      testo: corpo,
      testoNuovo: Testo.testoNuovo(corpo),
      ruolo: ruolo(email),
      allegati: allegatiDi(m).map(function (a) {
        return { nome: a.blob.getName(), mimeType: String(a.blob.getContentType() || '').toLowerCase(), dimensione: a.blob.getSize(), inLinea: a.inLinea };
      })
    };
  }

  /** Messaggi arrivati dopo "dopoMs" da mittenti esterni, dal più vecchio. */
  function nuoviMessaggi(dopoMs) {
    var dopoSec = Math.floor(dopoMs / 1000) - 60;
    var threads = GmailApp.search(CONFIG.QUERY_NUOVI + ' after:' + dopoSec, 0, 50);
    var messaggi = [];
    threads.forEach(function (t) {
      t.getMessages().forEach(function (m) {
        if (m.getDate().getTime() <= dopoMs || m.isInTrash()) return;
        if (Prefiltro.interno(Testo.estraiEmail(m.getFrom()))) return;
        messaggi.push(m);
      });
    });
    messaggi.sort(function (a, b) { return a.getDate().getTime() - b.getDate().getTime(); });
    return messaggi;
  }

  /** Migelino ha già scritto a questo indirizzo? */
  function haRelazione(email) {
    var q = 'to:' + email + ' (from:me OR from:migelino.it OR from:migelino.ch)';
    return GmailApp.search(q, 0, 1).length > 0;
  }

  /** Conversazione fino al messaggio indicato (compreso), per il riconoscimento. */
  function conversazione(threadId, fineMessaggioId) {
    var thread = GmailApp.getThreadById(threadId);
    var lista = [];
    var messaggi = thread.getMessages();
    for (var i = 0; i < messaggi.length; i++) {
      var d = dto(messaggi[i]);
      lista.push({
        data: d.data, ruolo: d.ruolo, nome: d.nome, email: d.mittente, testo: d.testoNuovo,
        allegati: d.allegati.filter(function (a) { return !a.inLinea; }).map(function (a) { return a.nome; })
      });
      if (messaggi[i].getId() === fineMessaggioId) break;
    }
    return { oggetto: thread.getFirstMessageSubject(), messaggi: lista };
  }

  /**
   * Tutto il materiale del paziente per l'estrazione: messaggi (entrambe le
   * direzioni) e allegati inviati dal paziente, fino a "finoAMs" se indicato.
   */
  function dossier(email, finoAMs) {
    var q = '(from:' + email + ' OR to:' + email + ' OR cc:' + email + ') newer_than:' + CONFIG.GIORNI_STORICO_PAZIENTE + 'd';
    var threads = GmailApp.search(q, 0, CONFIG.MAX_CONVERSAZIONI_PAZIENTE);
    var tutti = [];
    threads.forEach(function (t) {
      t.getMessages().forEach(function (m) {
        if (finoAMs && m.getDate().getTime() > finoAMs) return;
        tutti.push(m);
      });
    });
    tutti.sort(function (a, b) { return a.getDate().getTime() - b.getDate().getTime(); });

    var messaggi = [];
    var candidati = [];
    var nonLeggibili = [];
    var visti = {};
    tutti.forEach(function (m) {
      var d = dto(m);
      messaggi.push({ data: d.data, ruolo: d.ruolo, nome: d.nome, oggetto: d.oggetto, testo: d.testoNuovo });
      if (d.ruolo !== 'PAZIENTE') return;
      allegatiDi(m).forEach(function (a) {
        var tipo = String(a.blob.getContentType() || '').toLowerCase();
        var nome = a.blob.getName();
        var dimensione = a.blob.getSize();
        var chiave = nome + '|' + dimensione;
        if (visti[chiave]) return;
        visti[chiave] = true;
        if (a.inLinea && dimensione < CONFIG.MIN_BYTE_IMMAGINE_IN_LINEA) return;
        if (TIPI_NON_LEGGIBILI.test(tipo) || /\.(heic|heif)$/i.test(nome)) { nonLeggibili.push(nome + ' (formato non supportato)'); return; }
        if (!TIPI_LEGGIBILI[tipo]) return;
        if (tipo !== 'application/pdf' && dimensione > CONFIG.MAX_BYTE_IMMAGINE) { nonLeggibili.push(nome + ' (immagine troppo grande)'); return; }
        candidati.push({ blob: a.blob, nome: nome, mimeType: tipo === 'image/jpg' ? 'image/jpeg' : tipo, dimensione: dimensione,
          dataMs: d.dataMs, data: d.data, audiometria: NOMI_AUDIOMETRIA.test(nome) });
      });
    });

    // Priorità: prima i documenti (non audiometrie), poi i più recenti.
    candidati.sort(function (a, b) {
      if (a.audiometria !== b.audiometria) return a.audiometria ? 1 : -1;
      return b.dataMs - a.dataMs;
    });
    var allegati = [];
    var totale = 0;
    candidati.forEach(function (c) {
      if (allegati.length >= CONFIG.MAX_ALLEGATI) return;
      if (totale + c.dimensione > CONFIG.MAX_BYTE_ALLEGATI) { nonLeggibili.push(c.nome + ' (omesso: limite di dimensione)'); return; }
      totale += c.dimensione;
      allegati.push({ nome: c.nome, mimeType: c.mimeType, base64: Utilities.base64Encode(c.blob.getBytes()), data: c.data,
        ruolo: 'PAZIENTE', dimensione: c.dimensione });
    });
    return { messaggi: messaggi, allegati: allegati, nonLeggibili: nonLeggibili };
  }

  // ------------------------------------------------------------------ etichette
  var cacheEtichette = {};

  function etichetta(nome) {
    if (cacheEtichette[nome]) return cacheEtichette[nome];
    var e = GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
    cacheEtichette[nome] = e;
    return e;
  }

  function creaEtichette() {
    etichetta(CONFIG.ETICHETTE.RADICE);
    Object.keys(CONFIG.ETICHETTE).forEach(function (k) { etichetta(CONFIG.ETICHETTE[k]); });
  }

  /** Applica l'etichetta di esito e toglie le altre etichette di esito dalla conversazione. */
  function impostaEsito(threadId, nomeEtichetta) {
    var thread = GmailApp.getThreadById(threadId);
    [CONFIG.ETICHETTE.CREATA, CONFIG.ETICHETTE.AGGIORNATA, CONFIG.ETICHETTE.DATI_MANCANTI,
      CONFIG.ETICHETTE.DUBBIA, CONFIG.ETICHETTE.ERRORE].forEach(function (n) {
      if (n !== nomeEtichetta) thread.removeLabel(etichetta(n));
    });
    if (nomeEtichetta) thread.addLabel(etichetta(nomeEtichetta));
  }

  function togliEtichetta(threadId, nomeEtichetta) {
    GmailApp.getThreadById(threadId).removeLabel(etichetta(nomeEtichetta));
  }

  function conversazioniConEtichetta(nomeEtichetta, massimo) {
    return etichetta(nomeEtichetta).getThreads(0, massimo || 10);
  }

  function link(threadId) {
    var utente = '';
    try { utente = Session.getEffectiveUser().getEmail(); } catch (e) { utente = ''; }
    return 'https://mail.google.com/mail/' + (utente ? '?authuser=' + encodeURIComponent(utente) : 'u/0/') + '#all/' + threadId;
  }

  return {
    dto: dto,
    nuoviMessaggi: nuoviMessaggi,
    haRelazione: haRelazione,
    conversazione: conversazione,
    dossier: dossier,
    creaEtichette: creaEtichette,
    impostaEsito: impostaEsito,
    togliEtichetta: togliEtichetta,
    conversazioniConEtichetta: conversazioniConEtichetta,
    link: link,
    dataIso: dataIso,
    dataTesto: dataTesto
  };
})();
