/**
 * MIGELINO - Turni della casella condivisa
 * ---------------------------------------------------------------------------
 * Ogni nuova conversazione che arriva nella casella condivisa viene inoltrata a
 * turno a un collega: Denis -> Marco -> Silvia -> Denis -> ...
 * Le mail successive della stessa conversazione vanno allo stesso collega, così il
 * cliente ha un solo interlocutore. Il turno è scritto sulla conversazione come
 * etichetta Gmail (es. "Turno/Marco"): cambiandola a mano si riassegna la conversazione.
 *
 * Gira ogni minuto con l'account della casella condivisa (support@migelino.ch). File autonomo, separato
 * dall'Anagrafica. Installazione: turni/README.md
 */

var TURNI = {
  // Ordine del giro.
  SQUADRA: [
    { nome: 'Denis', email: 'denis@migelino.it' },
    { nome: 'Marco', email: 'marcoz@migelino.it' },
    { nome: 'Silvia', email: 'silvia@migelino.it' }
  ],
  STESSA_PERSONA_PER_CONVERSAZIONE: true, // false = turno puro: ogni singola mail va al collega successivo
  RISPOSTA_AL_CLIENTE: true,               // "Rispondi" sull'inoltro scrive al cliente, non alla casella condivisa
  ETICHETTA: 'Turno',                      // crea Turno/Denis, Turno/Marco, Turno/Silvia
  QUERY: 'in:inbox -in:chats',
  MITTENTI_ESCLUSI: [/mailer-daemon/i, /postmaster/i], // evita giri infiniti con le mail di errore
  MINUTI_TRIGGER: 1,                       // valori ammessi da Google: 1, 5, 10, 15, 30
  MARGINE_MS: 60 * 60 * 1000,              // riguarda l'ultima ora: nessuna mail persa se Gmail la indicizza in ritardo
  MAX_INOLTRI_PER_ESECUZIONE: 40,
  MAX_TENTATIVI: 3                         // poi la conversazione riceve l'etichetta "Turno/⛔ Non inoltrata"
};

var CHIAVI_TURNI = {
  INIZIO: 'TURNI_INIZIO',     // installazione: le mail precedenti non vengono inoltrate
  ULTIMO: 'TURNI_ULTIMO',     // ultimo controllo completato
  PROSSIMO: 'TURNI_PROSSIMO', // posizione nel giro del prossimo collega
  VISTI: 'TURNI_VISTI',       // mail già inoltrate (solo quelle recenti) per non inoltrarle due volte
  ERRORI: 'TURNI_ERRORI'      // tentativi falliti per mail
};

var Turni = (function () {
  var PAGINA = 50;

  function proprieta() {
    return PropertiesService.getScriptProperties();
  }

  function indirizzo(da) {
    var m = /<([^>]+)>/.exec(da || '');
    return String(m ? m[1] : da || '').trim().toLowerCase();
  }

  function casella() {
    try { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
  }

  function nomeEtichetta(persona) {
    return TURNI.ETICHETTA + '/' + persona.nome;
  }

  var cacheEtichette = {};

  function etichetta(nome) {
    if (!cacheEtichette[nome]) cacheEtichette[nome] = GmailApp.getUserLabelByName(nome) || GmailApp.createLabel(nome);
    return cacheEtichette[nome];
  }

  function verificaSquadra() {
    if (!TURNI.SQUADRA.length) throw new Error('TURNI.SQUADRA è vuota.');
    TURNI.SQUADRA.forEach(function (s) {
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(s.email)) {
        throw new Error('Indirizzo non valido per ' + s.nome + ': "' + s.email + '". Correggi TURNI.SQUADRA.');
      }
    });
  }

  /** Collega già assegnato alla conversazione (dalla sua etichetta), oppure null. */
  function assegnato(thread) {
    var nomi = thread.getLabels().map(function (l) { return l.getName(); });
    for (var i = 0; i < TURNI.SQUADRA.length; i++) {
      if (nomi.indexOf(nomeEtichetta(TURNI.SQUADRA[i])) >= 0) return TURNI.SQUADRA[i];
    }
    return null;
  }

  /** Mail della casella stessa (i suoi inoltri), dei colleghi del giro e di errore: mai inoltrate. */
  function escluso(mittente, io) {
    if (!mittente || mittente === io) return true;
    if (TURNI.SQUADRA.some(function (s) { return s.email.toLowerCase() === mittente; })) return true;
    return TURNI.MITTENTI_ESCLUSI.some(function (re) { return re.test(mittente); });
  }

  /** Mail arrivate dopo "dalMs" e non ancora inoltrate, dalla più vecchia. */
  function nuove(dalMs, visti, io) {
    var q = TURNI.QUERY + ' after:' + Math.floor(dalMs / 1000);
    var lista = [];
    for (var inizio = 0; ; inizio += PAGINA) {
      var threads = GmailApp.search(q, inizio, PAGINA);
      threads.forEach(function (t) {
        t.getMessages().forEach(function (m) {
          if (m.getDate().getTime() <= dalMs || visti[m.getId()] || m.isInTrash()) return;
          if (escluso(indirizzo(m.getFrom()), io)) return;
          lista.push(m);
        });
      });
      if (threads.length < PAGINA) break;
    }
    lista.sort(function (a, b) { return a.getDate().getTime() - b.getDate().getTime(); });
    return lista;
  }

  function controlla() {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(1000)) return; // un altro controllo è ancora in corso
    try {
      verificaSquadra();
      var p = proprieta();
      var avvio = Date.now();
      var inizio = Number(p.getProperty(CHIAVI_TURNI.INIZIO));
      if (!inizio) throw new Error('Turni non installati: esegui "installaTurni".');
      var dal = Math.max(inizio, (Number(p.getProperty(CHIAVI_TURNI.ULTIMO)) || inizio) - TURNI.MARGINE_MS);
      var visti = JSON.parse(p.getProperty(CHIAVI_TURNI.VISTI) || '{}');
      var errori = JSON.parse(p.getProperty(CHIAVI_TURNI.ERRORI) || '{}');
      var n = TURNI.SQUADRA.length;
      var prossimo = (parseInt(p.getProperty(CHIAVI_TURNI.PROSSIMO), 10) || 0) % n;
      var inQuestoGiro = {}; // conversazione -> collega, per più mail nuove della stessa conversazione
      var messaggi = nuove(dal, visti, casella());
      var completo = messaggi.length <= TURNI.MAX_INOLTRI_PER_ESECUZIONE;

      // Salvato dopo ogni mail: se l'esecuzione si interrompe, nessun doppione al giro dopo.
      function salva() {
        var valori = {};
        valori[CHIAVI_TURNI.PROSSIMO] = String(prossimo);
        valori[CHIAVI_TURNI.VISTI] = JSON.stringify(visti);
        valori[CHIAVI_TURNI.ERRORI] = JSON.stringify(errori);
        p.setProperties(valori);
      }

      messaggi.slice(0, TURNI.MAX_INOLTRI_PER_ESECUZIONE).forEach(function (m) {
        var thread = m.getThread();
        var persona = TURNI.STESSA_PERSONA_PER_CONVERSAZIONE
          ? inQuestoGiro[thread.getId()] || assegnato(thread)
          : null;
        var nuovoTurno = !persona;
        if (nuovoTurno) persona = TURNI.SQUADRA[prossimo];
        try {
          var opzioni = {};
          if (TURNI.RISPOSTA_AL_CLIENTE) opzioni.replyTo = m.getReplyTo() || m.getFrom();
          m.forward(persona.email, opzioni);
        } catch (e) {
          console.error('Inoltro non riuscito a ' + persona.email + ' (' + m.getSubject() + '): ' + e.message);
          errori[m.getId()] = (errori[m.getId()] || 0) + 1;
          if (errori[m.getId()] >= TURNI.MAX_TENTATIVI) {
            // Si rinuncia, in vista nella casella condivisa: una mail bloccata non deve fermare il giro.
            thread.addLabel(etichetta(TURNI.ETICHETTA + '/⛔ Non inoltrata'));
            visti[m.getId()] = m.getDate().getTime();
            delete errori[m.getId()];
          } else {
            completo = false; // riprova al prossimo controllo
          }
          salva();
          return;
        }
        thread.addLabel(etichetta(nomeEtichetta(persona)));
        inQuestoGiro[thread.getId()] = persona;
        if (nuovoTurno) prossimo = (prossimo + 1) % n;
        visti[m.getId()] = m.getDate().getTime();
        delete errori[m.getId()];
        salva();
        Logger.log('Inoltrata a ' + persona.nome + ': ' + m.getSubject());
      });

      if (completo) {
        p.setProperty(CHIAVI_TURNI.ULTIMO, String(avvio));
        var prossimoDal = Math.max(inizio, avvio - TURNI.MARGINE_MS);
        Object.keys(visti).forEach(function (id) { if (visti[id] <= prossimoDal) delete visti[id]; });
        p.setProperty(CHIAVI_TURNI.VISTI, JSON.stringify(visti));
      }
    } finally {
      lock.releaseLock();
    }
  }

  function installa() {
    verificaSquadra();
    var p = proprieta();
    if (!p.getProperty(CHIAVI_TURNI.INIZIO)) p.setProperty(CHIAVI_TURNI.INIZIO, String(Date.now()));
    etichetta(TURNI.ETICHETTA);
    TURNI.SQUADRA.forEach(function (s) { etichetta(nomeEtichetta(s)); });
    rimuoviTrigger();
    ScriptApp.newTrigger('controllaTurni').timeBased().everyMinutes(TURNI.MINUTI_TRIGGER).create();
    Logger.log('Turni attivi su ' + casella() + ', controllo ogni ' + TURNI.MINUTI_TRIGGER + ' minuti. ' + stato());
  }

  function rimuoviTrigger() {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'controllaTurni') ScriptApp.deleteTrigger(t);
    });
  }

  /** Ferma il controllo. Reinstallando si riparte dalle mail nuove; il giro continua dal collega successivo. */
  function disinstalla() {
    rimuoviTrigger();
    var p = proprieta();
    [CHIAVI_TURNI.INIZIO, CHIAVI_TURNI.ULTIMO, CHIAVI_TURNI.VISTI, CHIAVI_TURNI.ERRORI].forEach(function (k) { p.deleteProperty(k); });
  }

  function stato() {
    var p = proprieta();
    var prossimo = (parseInt(p.getProperty(CHIAVI_TURNI.PROSSIMO), 10) || 0) % TURNI.SQUADRA.length;
    var ultimo = Number(p.getProperty(CHIAVI_TURNI.ULTIMO));
    var attivo = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'controllaTurni'; });
    return 'Prossimo turno: ' + TURNI.SQUADRA[prossimo].nome + '. Ultimo controllo: ' +
      (ultimo ? Utilities.formatDate(new Date(ultimo), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : 'mai') + '. Controllo automatico: ' + (attivo ? 'attivo' : 'spento') + '.';
  }

  return { controlla: controlla, installa: installa, disinstalla: disinstalla, stato: stato };
})();

// Funzioni da eseguire dall'editor di Apps Script (menu "Esegui").

/** Da eseguire una volta, con l'account della casella condivisa. Rieseguirla non crea doppioni. */
function installaTurni() { Turni.installa(); }

/** Chiamata dal controllo automatico ogni minuto. */
function controllaTurni() { Turni.controlla(); }

/** Ferma il controllo automatico; le mail arrivate nel frattempo non verranno inoltrate. */
function disinstallaTurni() { Turni.disinstalla(); Logger.log('Turni fermati.'); }

function statoTurni() { Logger.log(Turni.stato()); }
