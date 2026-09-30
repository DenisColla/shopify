/**
 * Codice fiscale italiano: validazione formale, carattere di controllo, omocodia
 * e coerenza con i dati anagrafici letti dal documento.
 *
 * Regola di progetto: il CF viene scritto su Shopify SOLO se è scritto da
 * qualche parte (documento, tessera sanitaria, mail) e supera questi controlli.
 * Non viene mai "inventato": calcola() serve solo per i confronti e per i test.
 */

var CodiceFiscale = (function () {
  var MESI = 'ABCDEHLMPRST';
  var OMOCODIA = 'LMNPQRSTUV'; // L=0, M=1, ..., V=9
  var POSIZIONI_NUMERICHE = [6, 7, 9, 10, 12, 13, 14];
  var DISPARI = {
    '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
    A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
    N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23
  };
  var FORMATO = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/;

  function normalizza(cf) {
    return String(cf || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function valorePari(c) {
    return /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 65;
  }

  function carattereControllo(primi15) {
    var somma = 0;
    for (var i = 0; i < 15; i++) {
      var c = primi15.charAt(i);
      somma += i % 2 === 0 ? DISPARI[c] : valorePari(c);
    }
    return String.fromCharCode(65 + (somma % 26));
  }

  function formatoValido(cf) {
    return FORMATO.test(normalizza(cf));
  }

  function valido(cf) {
    var c = normalizza(cf);
    return FORMATO.test(c) && carattereControllo(c.slice(0, 15)) === c.charAt(15);
  }

  /** Riporta a cifre le posizioni numeriche sostituite per omocodia. */
  function senzaOmocodia(cf) {
    var c = normalizza(cf).split('');
    POSIZIONI_NUMERICHE.forEach(function (p) {
      var i = OMOCODIA.indexOf(c[p]);
      if (i >= 0) c[p] = String(i);
    });
    return c.join('');
  }

  function soloLettere(s) {
    return Testo.rimuoviAccenti(s).toUpperCase().replace(/[^A-Z]/g, '');
  }

  function consonanti(s) {
    return soloLettere(s).replace(/[AEIOU]/g, '');
  }

  function vocali(s) {
    return soloLettere(s).replace(/[^AEIOU]/g, '');
  }

  function codiceCognome(cognome) {
    return (consonanti(cognome) + vocali(cognome) + 'XXX').slice(0, 3);
  }

  function codiceNome(nome) {
    var c = consonanti(nome);
    if (c.length >= 4) return c.charAt(0) + c.charAt(2) + c.charAt(3);
    return (c + vocali(nome) + 'XXX').slice(0, 3);
  }

  /** dataISO "1973-07-26", sesso "M"/"F" -> "73L26" */
  function codiceData(dataISO, sesso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dataISO || ''));
    if (!m) return null;
    var mese = Number(m[2]);
    var giorno = Number(m[3]);
    if (mese < 1 || mese > 12 || giorno < 1 || giorno > 31) return null;
    var g = String(sesso || '').toUpperCase() === 'F' ? giorno + 40 : giorno;
    return m[1].slice(2) + MESI.charAt(mese - 1) + (g < 10 ? '0' + g : String(g));
  }

  function calcola(dati) {
    var data = codiceData(dati.dataNascita, dati.sesso);
    if (!data || !dati.codiceCatastale) return null;
    var primi15 = codiceCognome(dati.cognome) + codiceNome(dati.nome) + data + String(dati.codiceCatastale).toUpperCase();
    return primi15 + carattereControllo(primi15);
  }

  /** Sesso ricavato dal CF (giorno > 40 = femmina). */
  function sessoDaCf(cf) {
    var c = senzaOmocodia(cf);
    var giorno = Number(c.slice(9, 11));
    return isNaN(giorno) ? null : giorno > 40 ? 'F' : 'M';
  }

  /**
   * Confronta il CF con i dati del documento. Restituisce il dettaglio per parte:
   * true = coincide, false = non coincide, null = dato non disponibile.
   * È "coerente" se il CF è valido, nessuna parte disponibile è in contrasto e
   * almeno cognome, nome e data sono stati verificati.
   */
  function verificaCoerenza(cf, dati) {
    var esito = { valido: valido(cf), cognome: null, nome: null, data: null, sesso: null, luogo: null, coerente: false };
    if (!esito.valido) return esito;
    var c = senzaOmocodia(cf);
    if (dati.cognome) esito.cognome = c.slice(0, 3) === codiceCognome(dati.cognome);
    if (dati.nome) esito.nome = c.slice(3, 6) === codiceNome(dati.nome);
    if (dati.dataNascita) {
      var conSesso = codiceData(dati.dataNascita, dati.sesso || sessoDaCf(cf));
      esito.data = conSesso !== null && c.slice(6, 11) === conSesso;
    }
    if (dati.sesso) esito.sesso = sessoDaCf(cf) === String(dati.sesso).toUpperCase();
    if (dati.codiceCatastale) esito.luogo = c.slice(11, 15) === String(dati.codiceCatastale).toUpperCase();
    // Il luogo è solo informativo: i comuni soppressi hanno codici non più presenti nelle tabelle.
    var parti = [esito.cognome, esito.nome, esito.data, esito.sesso];
    var nessunContrasto = parti.every(function (p) { return p !== false; });
    esito.coerente = nessunContrasto && esito.cognome === true && esito.nome === true && esito.data === true;
    return esito;
  }

  return {
    normalizza: normalizza,
    formatoValido: formatoValido,
    valido: valido,
    carattereControllo: carattereControllo,
    senzaOmocodia: senzaOmocodia,
    codiceCognome: codiceCognome,
    codiceNome: codiceNome,
    codiceData: codiceData,
    calcola: calcola,
    sessoDaCf: sessoDaCf,
    verificaCoerenza: verificaCoerenza
  };
})();
