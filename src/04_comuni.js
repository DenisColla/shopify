/**
 * Ricerca nella tabella dei comuni italiani (src/03_comuni_dati.js).
 *
 * La tabella è del 2020 e i CAP cambiano ogni tanto: per questo il controllo
 * CAP/provincia usa le prime tre cifre del CAP (stabili) e non l'elenco esatto.
 */

var Comuni = (function () {
  // Province sarde riorganizzate più volte: sono considerate equivalenti tra loro.
  var GRUPPI_EQUIVALENTI = [
    ['SU', 'CI', 'VS', 'CA'],
    ['SS', 'OT'],
    ['NU', 'OG']
  ];
  var SIGLE_STORICHE = ['CI', 'VS', 'OG', 'OT'];

  var indice = null;

  function intervalliCap(testoCap) {
    return String(testoCap || '').split(',').filter(Boolean).map(function (pezzo) {
      var ab = pezzo.split('-');
      return [Number(ab[0]), Number(ab[1] || ab[0])];
    });
  }

  function costruisci() {
    var perNome = {};
    var perCatastale = {};
    var prefissiPerSigla = {};
    var sigle = {};
    COMUNI_DATI.split('\n').forEach(function (riga) {
      var p = riga.split('|');
      var comune = { nome: p[0], sigla: p[1], catastale: p[2], cap: intervalliCap(p[3]) };
      var k = Testo.chiave(comune.nome);
      (perNome[k] = perNome[k] || []).push(comune);
      perCatastale[comune.catastale] = comune;
      sigle[comune.sigla] = true;
      var prefissi = prefissiPerSigla[comune.sigla] = prefissiPerSigla[comune.sigla] || {};
      comune.cap.forEach(function (ab) {
        for (var n = ab[0]; n <= ab[1]; n++) prefissi[String(n).padStart(5, '0').slice(0, 3)] = true;
      });
    });
    SIGLE_STORICHE.forEach(function (s) { sigle[s] = true; });
    return { perNome: perNome, perCatastale: perCatastale, prefissiPerSigla: prefissiPerSigla, sigle: sigle };
  }

  function dati() {
    if (!indice) indice = costruisci();
    return indice;
  }

  function equivalenti(sigla) {
    var s = String(sigla || '').toUpperCase();
    for (var i = 0; i < GRUPPI_EQUIVALENTI.length; i++) {
      if (GRUPPI_EQUIVALENTI[i].indexOf(s) >= 0) return GRUPPI_EQUIVALENTI[i].slice();
    }
    return [s];
  }

  function siglaValida(sigla) {
    return !!dati().sigle[String(sigla || '').toUpperCase()];
  }

  /** Trova il comune per nome (senza accenti/maiuscole). Con la sigla sceglie tra omonimi. */
  function trova(nome, sigla) {
    var candidati = dati().perNome[Testo.chiave(nome)] || [];
    if (!candidati.length) return null;
    if (sigla) {
      var ammesse = equivalenti(sigla);
      var conSigla = candidati.filter(function (c) { return ammesse.indexOf(c.sigla) >= 0; });
      if (conSigla.length) return conSigla[0];
      return null;
    }
    return candidati.length === 1 ? candidati[0] : null;
  }

  function perCatastale(codice) {
    return dati().perCatastale[String(codice || '').toUpperCase()] || null;
  }

  /**
   * Il CAP è compatibile con la provincia? true / false, oppure null se la
   * provincia non è nella tabella (non verificabile).
   */
  function capCoerente(cap, sigla) {
    if (!/^\d{5}$/.test(String(cap || ''))) return false;
    var prefisso = String(cap).slice(0, 3);
    var ammesse = equivalenti(sigla);
    var verificabile = false;
    for (var i = 0; i < ammesse.length; i++) {
      var prefissi = dati().prefissiPerSigla[ammesse[i]];
      if (prefissi) {
        verificabile = true;
        if (prefissi[prefisso]) return true;
      }
    }
    return verificabile ? false : null;
  }

  /** Sigla ricavata dal CAP, solo se univoca. */
  function siglaDaCap(cap) {
    if (!/^\d{5}$/.test(String(cap || ''))) return null;
    var prefisso = String(cap).slice(0, 3);
    var trovate = Object.keys(dati().prefissiPerSigla).filter(function (s) {
      return dati().prefissiPerSigla[s][prefisso];
    });
    return trovate.length === 1 ? trovate[0] : null;
  }

  return {
    trova: trova,
    perCatastale: perCatastale,
    siglaValida: siglaValida,
    equivalenti: equivalenti,
    capCoerente: capCoerente,
    siglaDaCap: siglaDaCap
  };
})();
