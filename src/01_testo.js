/**
 * Utilità per il testo: pulizia delle mail, maiuscole di nomi e indirizzi.
 */

var Testo = (function () {
  var PARTICELLE = [
    'di', 'del', 'dello', 'della', 'dei', 'degli', 'delle',
    'da', 'dal', 'dallo', 'dalla', 'dai', 'dagli', 'dalle',
    'in', 'e', 'ed', 'a', 'ad', 'al', 'allo', 'alla', 'ai', 'agli', 'alle',
    'sul', 'sullo', 'sulla', 'sui', 'sugli', 'sulle', 'su',
    'con', 'per', 'tra', 'fra', 'lo', 'la', 'le', 'il', 'gli', 'dell', 'all', 'sull', 'nell'
  ];

  var ABBREVIAZIONI_INDIRIZZO = [
    [/^v\.?le\b\.?/i, 'Viale'],
    [/^p\.?zza\b\.?/i, 'Piazza'],
    [/^p\.?za\b\.?/i, 'Piazza'],
    [/^p\.?le\b\.?/i, 'Piazzale'],
    [/^c\.?so\b\.?/i, 'Corso'],
    [/^l\.?go\b\.?/i, 'Largo'],
    [/^str\.\s*/i, 'Strada '],
    [/^loc\.\s*/i, 'Località '],
    [/^fraz\.\s*/i, 'Frazione '],
    [/^vic\.\s*/i, 'Vicolo '],
    [/^v\.\s+/i, 'Via ']
  ];

  // Marcatori che introducono la parte citata di una risposta o un inoltro.
  // Per "ha scritto"/"wrote" serve anche una data/ora o un indirizzo email, così
  // una frase del paziente come "Il medico mi ha scritto..." non viene tagliata.
  var MARCATORI_CITAZIONE = [
    { re: /(^|\n)[ \t]*(?:Il|In data)\b[^\n]*(?:\n[^\n]*){0,2}?ha scritto\s*:?/gi, serveData: true },
    { re: /(^|\n)[ \t]*On\b[^\n]*(?:\n[^\n]*){0,2}?wrote\s*:?/gi, serveData: true },
    { re: /(^|\n)[ \t]*-{2,}\s*(?:Messaggio originale|Original Message|Messaggio inoltrato|Forwarded message)\s*-{2,}/gi },
    { re: /(^|\n)[ \t]*(?:Da|From)\s*:[^\n]*\n[ \t]*(?:Inviato|Sent|Data|Date|A|To)\s*:/gi },
    { re: /(^|\n)_{10,}/g }
  ];

  function haDataOEmail(s) {
    return /@/.test(s) || /\d{1,2}[:.]\d{2}/.test(s) || /\b\d{4}\b/.test(s) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
  }

  var RUMORE = [
    /Yahoo Mail: cerca, organizza, prendi il controllo della tua casella di posta/gi,
    /Inviato da (?:iPhone|iPad|Outlook[^\n]*|Libero Mail[^\n]*|il mio [^\n]*|Posta[^\n]*)/gi,
    /Sent from my [^\n]*/gi,
    /^\s*--\s*$/gm
  ];

  function testo(s) {
    return s === null || s === undefined ? '' : String(s);
  }

  function spazi(s) {
    return testo(s).replace(/\s+/g, ' ').trim();
  }

  function rimuoviAccenti(s) {
    return testo(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /** Chiave di confronto: minuscole, senza accenti né punteggiatura. */
  function chiave(s) {
    return rimuoviAccenti(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function vuoto(s) {
    return spazi(s) === '';
  }

  /** Parola con maiuscole interne volute (es. "McDonald"): va lasciata com'è. */
  function stilizzata(parola) {
    return /[a-zà-ÿ]/.test(parola) && /[A-ZÀ-Þ]/.test(parola.slice(1));
  }

  function capitalizza(parola) {
    if (!parola) return parola;
    if (stilizzata(parola)) return parola;
    return parola.charAt(0).toUpperCase() + parola.slice(1).toLowerCase();
  }

  /** "DE ANGELIS" -> "De Angelis", "d'orazio" -> "D'Orazio", "McDonald" resta "McDonald". */
  function maiuscoleNome(s) {
    var pulito = spazi(s);
    if (!pulito) return pulito;
    return pulito.split(' ').map(function (parola) {
      return parola.split(/([’'-])/).map(function (pezzo) {
        return /^[’'-]$/.test(pezzo) ? pezzo : capitalizza(pezzo);
      }).join('');
    }).join(' ');
  }

  function numeroRomano(parola) {
    return /^(X{0,3})(IX|IV|V?I{0,3})$/i.test(parola) && parola.length > 0 && parola.length <= 6;
  }

  function maiuscoleParolaIndirizzo(parola, prima) {
    if (/\d/.test(parola)) return parola.toUpperCase();                 // civici: 32/a -> 32/A
    if (parola.indexOf("'") > 0 || parola.indexOf('’') > 0) {
      var pezzi = parola.split(/([’'])/);
      return pezzi.map(function (p, i) {
        if (/^[’']$/.test(p)) return p;
        if (i === 0) return maiuscoleParolaIndirizzo(p, prima);
        return capitalizza(p);
      }).join('');
    }
    var minuscola = parola.toLowerCase();
    if (!prima && PARTICELLE.indexOf(minuscola) >= 0) return minuscola;
    if (numeroRomano(parola)) return parola.toUpperCase();
    return capitalizza(parola);
  }

  /** Normalizza la via: espande abbreviazioni e sistema le maiuscole ("VIA DELLE ROSE" -> "Via delle Rose"). */
  function maiuscoleIndirizzo(s) {
    var pulito = spazi(s);
    if (!pulito) return pulito;
    for (var i = 0; i < ABBREVIAZIONI_INDIRIZZO.length; i++) {
      var regola = ABBREVIAZIONI_INDIRIZZO[i];
      if (regola[0].test(pulito)) {
        pulito = spazi(pulito.replace(regola[0], regola[1] + ' '));
        break;
      }
    }
    return pulito.split(' ').map(function (parola, indice) {
      return maiuscoleParolaIndirizzo(parola, indice === 0);
    }).join(' ');
  }

  /** Testo nuovo di una risposta: toglie la parte citata, gli inoltri e le firme automatiche. */
  function testoNuovo(corpo) {
    var t = testo(corpo).replace(/\r\n?/g, '\n');
    var taglio = t.length;
    for (var i = 0; i < MARCATORI_CITAZIONE.length; i++) {
      var marcatore = MARCATORI_CITAZIONE[i];
      marcatore.re.lastIndex = 0;
      var m;
      while ((m = marcatore.re.exec(t)) !== null) {
        if (!marcatore.serveData || haDataOEmail(m[0])) {
          if (m.index < taglio) taglio = m.index;
          break;
        }
      }
    }
    t = t.slice(0, taglio);
    t = t.split('\n').filter(function (riga) { return !/^\s*>/.test(riga); }).join('\n');
    for (var j = 0; j < RUMORE.length; j++) t = t.replace(RUMORE[j], '');
    return t.replace(/\n{3,}/g, '\n\n').trim();
  }

  function estraiEmail(intestazione) {
    var t = testo(intestazione);
    var m = /<([^>]+)>/.exec(t) || /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(t);
    return m ? m[1].trim().toLowerCase() : '';
  }

  function estraiNomeMittente(intestazione) {
    var t = testo(intestazione);
    var i = t.indexOf('<');
    var nome = i > 0 ? t.slice(0, i) : '';
    return spazi(nome.replace(/["']/g, ''));
  }

  function tronca(s, massimo) {
    var t = testo(s);
    return t.length > massimo ? t.slice(0, massimo) + '\n[…testo troncato…]' : t;
  }

  return {
    spazi: spazi,
    rimuoviAccenti: rimuoviAccenti,
    chiave: chiave,
    vuoto: vuoto,
    maiuscoleNome: maiuscoleNome,
    maiuscoleIndirizzo: maiuscoleIndirizzo,
    testoNuovo: testoNuovo,
    estraiEmail: estraiEmail,
    estraiNomeMittente: estraiNomeMittente,
    tronca: tronca
  };
})();
