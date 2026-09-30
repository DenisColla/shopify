/**
 * Memoria tra un'esecuzione e l'altra (Proprietà dello script):
 * - ultimo controllo della posta;
 * - messaggi già elaborati (per non rielaborarli);
 * - ultimo esito per paziente (per completare l'anagrafica quando arrivano i dati mancanti).
 */

var Stato = (function () {
  var PREFISSO_MSG = 'm_';
  var PREFISSO_PAZIENTE = 'p_';
  var ULTIMA_PULIZIA = 'ULTIMA_PULIZIA';
  var GIORNO_MS = 24 * 60 * 60 * 1000;

  function proprieta() {
    return PropertiesService.getScriptProperties();
  }

  function ultimoControllo() {
    var v = Number(proprieta().getProperty(CHIAVI.ULTIMO_CONTROLLO));
    return v > 0 ? v : Date.now() - GIORNO_MS; // al primo avvio guarda le ultime 24 ore
  }

  function salvaUltimoControllo(ms) {
    proprieta().setProperty(CHIAVI.ULTIMO_CONTROLLO, String(Math.floor(ms)));
  }

  function giaElaborato(idMessaggio) {
    return proprieta().getProperty(PREFISSO_MSG + idMessaggio) !== null;
  }

  function segnaElaborato(idMessaggio) {
    proprieta().setProperty(PREFISSO_MSG + idMessaggio, String(Date.now()));
  }

  function statoPaziente(email) {
    var v = proprieta().getProperty(PREFISSO_PAZIENTE + String(email).toLowerCase());
    if (!v) return null;
    try {
      var s = JSON.parse(v);
      if (Date.now() - s.ts > CONFIG.GIORNI_MEMORIA_STATO * GIORNO_MS) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function salvaStatoPaziente(email, stato) {
    stato.ts = Date.now();
    proprieta().setProperty(PREFISSO_PAZIENTE + String(email).toLowerCase(), JSON.stringify(stato));
  }

  /** Cancella le voci più vecchie della finestra di memoria (una volta al giorno). */
  function pulisci() {
    var p = proprieta();
    var ultima = Number(p.getProperty(ULTIMA_PULIZIA)) || 0;
    if (Date.now() - ultima < GIORNO_MS) return;
    var limite = Date.now() - CONFIG.GIORNI_MEMORIA_STATO * GIORNO_MS;
    var tutte = p.getProperties();
    Object.keys(tutte).forEach(function (k) {
      if (k.indexOf(PREFISSO_MSG) === 0 && Number(tutte[k]) < limite) p.deleteProperty(k);
      if (k.indexOf(PREFISSO_PAZIENTE) === 0) {
        try { if (JSON.parse(tutte[k]).ts < limite) p.deleteProperty(k); } catch (e) { p.deleteProperty(k); }
      }
    });
    p.setProperty(ULTIMA_PULIZIA, String(Date.now()));
  }

  return {
    ultimoControllo: ultimoControllo,
    salvaUltimoControllo: salvaUltimoControllo,
    giaElaborato: giaElaborato,
    segnaElaborato: segnaElaborato,
    statoPaziente: statoPaziente,
    salvaStatoPaziente: salvaStatoPaziente,
    pulisci: pulisci
  };
})();
