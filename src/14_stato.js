/**
 * Memoria tra un'esecuzione e l'altra.
 *
 * Lo script può girare su più caselle (Denis, Silvia, Marco): ognuno attiva il
 * controllo con il proprio account e il trigger gira come quella persona.
 *  - Proprietà UTENTE (una per casella): ultimo controllo, messaggi già elaborati.
 *  - Proprietà SCRIPT (condivise): stato di ogni paziente, così una conferma
 *    arrivata a una casella si completa anche se i dati mancanti arrivano a un'altra;
 *    registro delle caselle attive.
 */

var Stato = (function () {
  var PREFISSO_MSG = 'm_';
  var PREFISSO_PAZIENTE = 'p_';
  var PREFISSO_CASELLA = 'casella_';
  var ULTIMA_PULIZIA = 'ULTIMA_PULIZIA';
  var GIORNO_MS = 24 * 60 * 60 * 1000;

  function utente() {
    return PropertiesService.getUserProperties();
  }

  function condivise() {
    return PropertiesService.getScriptProperties();
  }

  function ultimoControllo() {
    var v = Number(utente().getProperty(CHIAVI.ULTIMO_CONTROLLO));
    if (v > 0) return v;
    // versione precedente (una sola casella): il valore stava nelle proprietà condivise
    var vecchio = Number(condivise().getProperty(CHIAVI.ULTIMO_CONTROLLO));
    if (vecchio > 0) {
      condivise().deleteProperty(CHIAVI.ULTIMO_CONTROLLO);
      return vecchio;
    }
    return Date.now() - GIORNO_MS; // al primo avvio guarda le ultime 24 ore
  }

  function salvaUltimoControllo(ms) {
    utente().setProperty(CHIAVI.ULTIMO_CONTROLLO, String(Math.floor(ms)));
  }

  function giaElaborato(idMessaggio) {
    return utente().getProperty(PREFISSO_MSG + idMessaggio) !== null ||
      condivise().getProperty(PREFISSO_MSG + idMessaggio) !== null; // versione precedente
  }

  function segnaElaborato(idMessaggio) {
    utente().setProperty(PREFISSO_MSG + idMessaggio, String(Date.now()));
  }

  function statoPaziente(email) {
    var v = condivise().getProperty(PREFISSO_PAZIENTE + String(email).toLowerCase());
    if (!v) return null;
    try {
      var s = JSON.parse(v);
      if (Date.now() - s.ts > CONFIG.GIORNI_MEMORIA_STATO * GIORNO_MS) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  /** stato = { esito, tipo, threadId, casella, estrazione (solo se mancano dati) } */
  function salvaStatoPaziente(email, stato) {
    stato.ts = Date.now();
    var testo = JSON.stringify(stato);
    if (testo.length > 8500 && stato.estrazione) { // limite di 9 KB per proprietà
      delete stato.estrazione;
      testo = JSON.stringify(stato);
    }
    condivise().setProperty(PREFISSO_PAZIENTE + String(email).toLowerCase(), testo);
  }

  // ------------------------------------------------------------ caselle attive
  function registraCasella(email, attiva) {
    var chiave = PREFISSO_CASELLA + String(email).toLowerCase();
    var s = leggiCasella(chiave) || {};
    s.attiva = attiva;
    if (attiva) s.dal = Date.now();
    condivise().setProperty(chiave, JSON.stringify(s));
  }

  function leggiCasella(chiave) {
    try { return JSON.parse(condivise().getProperty(chiave) || 'null'); } catch (e) { return null; }
  }

  /** Aggiorna l'ora dell'ultimo giro di questa casella (per vedere se un trigger si è fermato). */
  function battito(email, riepilogo) {
    var chiave = PREFISSO_CASELLA + String(email).toLowerCase();
    var s = leggiCasella(chiave) || { attiva: true, dal: Date.now() };
    s.ultimoGiro = Date.now();
    s.riepilogo = riepilogo || '';
    condivise().setProperty(chiave, JSON.stringify(s));
  }

  function elencoCaselle() {
    var tutte = condivise().getProperties();
    return Object.keys(tutte).filter(function (k) { return k.indexOf(PREFISSO_CASELLA) === 0; }).map(function (k) {
      var s = leggiCasella(k) || {};
      s.email = k.slice(PREFISSO_CASELLA.length);
      return s;
    });
  }

  /** Cancella le voci più vecchie della finestra di memoria (una volta al giorno per casella). */
  function pulisci() {
    var u = utente();
    var ultima = Number(u.getProperty(ULTIMA_PULIZIA)) || 0;
    if (Date.now() - ultima < GIORNO_MS) return;
    var limite = Date.now() - CONFIG.GIORNI_MEMORIA_STATO * GIORNO_MS;
    [u, condivise()].forEach(function (p) {
      var tutte = p.getProperties();
      Object.keys(tutte).forEach(function (k) {
        if (k.indexOf(PREFISSO_MSG) === 0 && Number(tutte[k]) < limite) p.deleteProperty(k);
        if (k.indexOf(PREFISSO_PAZIENTE) === 0) {
          try { if (JSON.parse(tutte[k]).ts < limite) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); }
        }
      });
    });
    u.setProperty(ULTIMA_PULIZIA, String(Date.now()));
  }

  return {
    ultimoControllo: ultimoControllo,
    salvaUltimoControllo: salvaUltimoControllo,
    giaElaborato: giaElaborato,
    segnaElaborato: segnaElaborato,
    statoPaziente: statoPaziente,
    salvaStatoPaziente: salvaStatoPaziente,
    registraCasella: registraCasella,
    battito: battito,
    elencoCaselle: elencoCaselle,
    pulisci: pulisci
  };
})();
