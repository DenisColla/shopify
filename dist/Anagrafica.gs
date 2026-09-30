/**
 * MIGELINO - Anagrafica automatica da Gmail a Shopify
 * Versione 1.0.0. FILE GENERATO da tools/build.mjs: non modificarlo qui,
 * modifica i file in src/ e rigenera. Istruzioni: docs/INSTALLAZIONE.md
 */
// ===== 00_config.js =====
/**
 * MIGELINO — Anagrafica automatica da Gmail a Shopify
 * ---------------------------------------------------------------------------
 * Configurazione generale. Le chiavi segrete NON stanno qui: si inseriscono dal
 * menu del Foglio ("Anagrafiche > Configura") e finiscono nelle Proprietà dello
 * script, visibili solo a chi può modificare il progetto.
 */

var CONFIG = {
  VERSIONE: '1.0.0',

  // Etichette Gmail (la parte prima di "/" crea il gruppo "Anagrafica").
  ETICHETTE: {
    RADICE: 'Anagrafica',
    CREATA: 'Anagrafica/✅ Creata',
    AGGIORNATA: 'Anagrafica/✅ Completata',
    DATI_MANCANTI: 'Anagrafica/⚠️ Dati mancanti',
    DUBBIA: 'Anagrafica/❓ Conferma dubbia',
    CREA_MANUALE: 'Anagrafica/▶ Crea',
    ERRORE: 'Anagrafica/⛔ Errore'
  },

  // Soglie (valori predefiniti, modificabili dalle Proprietà dello script).
  SOGLIA_CONFERMA: 0.85,   // sopra: è una conferma e si procede
  SOGLIA_DUBBIO: 0.60,     // tra dubbio e conferma: etichetta "Conferma dubbia", nessuna scrittura
  SOGLIA_CAMPO: 0.85,      // confidenza minima perché un campo venga scritto

  // Modalità: OMBRA = lavora e registra ma non scrive su Shopify né etichetta; LIVE = scrive.
  MODALITA_PREDEFINITA: 'OMBRA',

  // Gmail
  DOMINI_INTERNI: ['migelino.ch', 'migelino.it'],
  MITTENTI_AUTOMATICI: [
    /no-?reply/i, /do-?not-?reply/i, /mailer-daemon/i, /postmaster/i,
    /calendar-notification/i, /notifications?@/i, /notifica/i, /newsletter/i,
    /@shopify\.com$/i, /@calendly\.com$/i, /@google\.com$/i, /@mailchimp/i,
    /@pec\./i, /posta-certificata/i, /bounce/i
  ],
  QUERY_NUOVI: 'in:inbox -in:chats -category:promotions -category:social -category:forums',
  GIORNI_STORICO_PAZIENTE: 120,    // quanto indietro cercare mail e allegati del paziente
  MAX_CONVERSAZIONI_PAZIENTE: 15,
  MAX_ALLEGATI: 8,
  // Limiti Claude: 32 MB per richiesta, 10 MB per immagine (in base64, che pesa +33%).
  MAX_BYTE_ALLEGATI: 18 * 1024 * 1024,
  MAX_BYTE_IMMAGINE: 5 * 1024 * 1024,
  MAX_BYTE_IMMAGINE_RIPROVA: 2 * 1024 * 1024, // secondo tentativo se Claude rifiuta un'immagine
  MIN_BYTE_IMMAGINE_IN_LINEA: 30 * 1024, // sotto questa soglia le immagini in linea sono loghi/firme
  MAX_CARATTERI_MESSAGGIO: 6000,
  MAX_MESSAGGI_CONTESTO: 8,

  // Esecuzione
  MINUTI_TRIGGER: 10,
  MAX_MS_ESECUZIONE: 4.5 * 60 * 1000, // Apps Script interrompe a 6 minuti
  MAX_MESSAGGI_PER_ESECUZIONE: 6,
  GIORNI_MEMORIA_STATO: 45,

  // Shopify
  SHOPIFY_API_VERSIONE: '2026-07',
  TAG_CLIENTE: 'anagrafica-auto',

  // Claude
  CLAUDE_URL: 'https://api.anthropic.com/v1/messages',
  CLAUDE_VERSIONE_API: '2023-06-01',
  CLAUDE_BETA_FALLBACK: 'server-side-fallback-2026-07-01',
  CLAUDE_SFORZO_CLASSIFICAZIONE: 'low',
  CLAUDE_SFORZO_ESTRAZIONE: 'medium',
  CLAUDE_MAX_TOKEN_CLASSIFICAZIONE: 6000,
  CLAUDE_MAX_TOKEN_ESTRAZIONE: 16000,
  CLAUDE_TENTATIVI: 3,

  // Nomi dei fogli del Registro
  FOGLI: {
    REGISTRO: 'Registro',
    COLLAUDO: 'Collaudo',
    COLLAUDO_CASI: 'Collaudo_casi',
    RIEPILOGO: 'Riepilogo collaudo'
  }
};

/** Chiavi delle Proprietà dello script. */
var CHIAVI = {
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  CLAUDE_MODEL: 'CLAUDE_MODEL',
  SHOPIFY_SHOP: 'SHOPIFY_SHOP',                 // es. nome-negozio.myshopify.com
  SHOPIFY_CLIENT_ID: 'SHOPIFY_CLIENT_ID',
  SHOPIFY_CLIENT_SECRET: 'SHOPIFY_CLIENT_SECRET',
  SHOPIFY_ACCESS_TOKEN: 'SHOPIFY_ACCESS_TOKEN', // alternativa: token fisso di una app già esistente
  MODALITA: 'MODALITA',
  EMAIL_UFFICIO_ORDINI: 'EMAIL_UFFICIO_ORDINI', // usata solo dal collaudo sullo storico
  SOGLIA_CONFERMA: 'SOGLIA_CONFERMA',
  SOGLIA_CAMPO: 'SOGLIA_CAMPO',
  ULTIMO_CONTROLLO: 'ULTIMO_CONTROLLO'
};

var Impostazioni = {
  _proprieta: function () {
    return PropertiesService.getScriptProperties();
  },

  leggi: function (chiave, predefinito) {
    var valore = this._proprieta().getProperty(chiave);
    return valore === null || valore === '' ? predefinito : valore;
  },

  obbligatoria: function (chiave) {
    var valore = this.leggi(chiave, null);
    if (!valore) {
      throw new Error('Impostazione mancante: ' + chiave + '. Usa il menu "Anagrafiche > Configura".');
    }
    return valore;
  },

  scrivi: function (chiave, valore) {
    this._proprieta().setProperty(chiave, String(valore));
  },

  numero: function (chiave, predefinito) {
    var n = parseFloat(this.leggi(chiave, ''));
    return isNaN(n) ? predefinito : n;
  },

  modalita: function () {
    var m = String(this.leggi(CHIAVI.MODALITA, CONFIG.MODALITA_PREDEFINITA)).toUpperCase();
    return m === 'LIVE' ? 'LIVE' : 'OMBRA';
  },

  sogliaConferma: function () {
    return this.numero(CHIAVI.SOGLIA_CONFERMA, CONFIG.SOGLIA_CONFERMA);
  },

  sogliaCampo: function () {
    return this.numero(CHIAVI.SOGLIA_CAMPO, CONFIG.SOGLIA_CAMPO);
  }
};

// ===== 01_testo.js =====
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

// ===== 02_codice_fiscale.js =====
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

// ===== 03_comuni_dati.js =====
// FILE GENERATO da tools/genera_comuni.mjs - non modificare a mano.
// Comuni italiani: nome|sigla provincia|codice catastale|CAP (intervalli).
// Fonte: comuni-json di Matteo Contrini (dati ISTAT e ANCI, aggiornati al 01/01/2020).
// 7904 comuni.
var COMUNI_DATI = "Abano Terme|PD|A001|35031\nAbbadia Cerreto|LO|A004|26834\nAbbadia Lariana|LC|A005|23821\nAbbadia San Salvatore|SI|A006|53021\nAbbasanta|OR|A007|09071\nAbbateggio|PE|A008|65020\nAbbiategrasso|MI|A010|20081\nAbetone Cutigliano|PT|M376|51024\nAbriola|PZ|A013|85010\nAcate|RG|A014|97011\nAccadia|FG|A015|71021\nAcceglio|CN|A016|12021\nAccettura|MT|A017|75011\nAcciano|AQ|A018|67020\nAccumoli|RI|A019|02011\nAcerenza|PZ|A020|85011\nAcerno|SA|A023|84042\nAcerra|NA|A024|80011\nAci Bonaccorsi|CT|A025|95020\nAci Castello|CT|A026|95021\nAci Catena|CT|A027|95022\nAci Sant'Antonio|CT|A029|95025\nAcireale|CT|A028|95024\nAcquafondata|FR|A032|03040\nAcquaformosa|CS|A033|87010\nAcquafredda|BS|A034|25010\nAcqualagna|PU|A035|61041\nAcquanegra Cremonese|CR|A039|26020\nAcquanegra sul Chiese|MN|A038|46011\nAcquapendente|VT|A040|01021\nAcquappesa|CS|A041|87020\nAcquaro|VV|A043|89832\nAcquasanta Terme|AP|A044|63095\nAcquasparta|TR|A045|05021\nAcquaviva Collecroce|CB|A050|86030\nAcquaviva d'Isernia|IS|A051|86080\nAcquaviva delle Fonti|BA|A048|70021\nAcquaviva Picena|AP|A047|63075\nAcquaviva Platani|CL|A049|93010\nAcquedolci|ME|M211|98070\nAcqui Terme|AL|A052|15011\nAcri|CS|A053|87041\nAcuto|FR|A054|03010\nAdelfia|BA|A055|70010\nAdrano|CT|A056|95031\nAdrara San Martino|BG|A057|24060\nAdrara San Rocco|BG|A058|24060\nAdria|RO|A059|45011\nAdro|BS|A060|25030\nAffi|VR|A061|37010\nAffile|RM|A062|00021\nAfragola|NA|A064|80021\nAfrico|RC|A065|89030\nAgazzano|PC|A067|29010\nAgerola|NA|A068|80051\nAggius|SS|A069|07020\nAgira|EN|A070|94011\nAgliana|PT|A071|51031\nAgliano Terme|AT|A072|14041\nAgliè|TO|A074|10011\nAglientu|SS|H848|07020\nAgna|PD|A075|35021\nAgnadello|CR|A076|26020\nAgnana Calabra|RC|A077|89040\nAgnone|IS|A080|86081\nAgnosine|BS|A082|25071\nAgordo|BL|A083|32021\nAgosta|RM|A084|00020\nAgra|VA|A085|21010\nAgrate Brianza|MB|A087|20864\nAgrate Conturbia|NO|A088|28010\nAgrigento|AG|A089|92100\nAgropoli|SA|A091|84043\nAgugliano|AN|A092|60020\nAgugliaro|VI|A093|36020\nAicurzio|MB|A096|20886\nAidomaggiore|OR|A097|09070\nAidone|EN|A098|94010\nAielli|AQ|A100|67041\nAiello Calabro|CS|A102|87031\nAiello del Friuli|UD|A103|33041\nAiello del Sabato|AV|A101|83020\nAieta|CS|A105|87020\nAilano|CE|A106|81010\nAiloche|BI|A107|13861\nAirasca|TO|A109|10060\nAirola|BN|A110|82011\nAirole|IM|A111|18030\nAiruno|LC|A112|23881\nAisone|CN|A113|12010\nAlà dei Sardi|SS|A115|07020\nAla di Stura|TO|A117|10070\nAla|TN|A116|38061\nAlagna Valsesia|VC|A119|13021\nAlagna|PV|A118|27020\nAlanno|PE|A120|65020\nAlano di Piave|BL|A121|32031\nAlassio|SV|A122|17021\nAlatri|FR|A123|03011\nAlba Adriatica|TE|A125|64011\nAlba|CN|A124|12051\nAlbagiara|OR|A126|09090\nAlbairate|MI|A127|20080\nAlbanella|SA|A128|84044\nAlbano di Lucania|PZ|A131|85010\nAlbano Laziale|RM|A132|00041\nAlbano Sant'Alessandro|BG|A129|24061\nAlbano Vercellese|VC|A130|13030\nAlbaredo Arnaboldi|PV|A134|27040\nAlbaredo d'Adige|VR|A137|37041\nAlbaredo per San Marco|SO|A135|23010\nAlbareto|PR|A138|43051\nAlbaretto della Torre|CN|A139|12050\nAlbavilla|CO|A143|22031\nAlbenga|SV|A145|17031\nAlbera Ligure|AL|A146|15060\nAlberobello|BA|A149|70011\nAlberona|FG|A150|71031\nAlbese con Cassano|CO|A153|22032\nAlbettone|VI|A154|36020\nAlbi|CZ|A155|88055\nAlbiano d'Ivrea|TO|A157|10010\nAlbiano|TN|A158|38041\nAlbiate|MB|A159|20847\nAlbidona|CS|A160|87070\nAlbignasego|PD|A161|35020\nAlbinea|RE|A162|42020\nAlbino|BG|A163|24021\nAlbiolo|CO|A164|22070\nAlbisola Superiore|SV|A166|17011\nAlbissola Marina|SV|A165|17012\nAlbizzate|VA|A167|21041\nAlbonese|PV|A171|27020\nAlbosaggia|SO|A172|23010\nAlbugnano|AT|A173|14022\nAlbuzzano|PV|A175|27010\nAlcamo|TP|A176|91011\nAlcara li Fusi|ME|A177|98070\nAldeno|TN|A178|38060\nAldino|BZ|A179|39040\nAles|OR|A180|09091\nAlessandria del Carretto|CS|A183|87070\nAlessandria della Rocca|AG|A181|92010\nAlessandria|AL|A182|15121-15122\nAlessano|LE|A184|73031\nAlezio|LE|A185|73011\nAlfano|SA|A186|84040\nAlfedena|AQ|A187|67030\nAlfianello|BS|A188|25020\nAlfiano Natta|AL|A189|15021\nAlfonsine|RA|A191|48011\nAlghero|SS|A192|07041\nAlgua|BG|A193|24010\nAlì Terme|ME|A201|98021\nAlì|ME|A194|98020\nAlia|PA|A195|90021\nAliano|MT|A196|75010\nAlice Bel Colle|AL|A197|15010\nAlice Castello|VC|A198|13040\nAlife|CE|A200|81011\nAlimena|PA|A202|90020\nAliminusa|PA|A203|90020\nAllai|OR|A204|09080\nAlleghe|BL|A206|32022\nAllein|AO|A205|11010\nAllerona|TR|A207|05011\nAlliste|LE|A208|73040\nAllumiere|RM|A210|00051\nAlluvioni Piovera|AL|M397|15047\nAlmè|BG|A214|24011\nAlmenno San Bartolomeo|BG|A216|24030\nAlmenno San Salvatore|BG|A217|24031\nAlmese|TO|A218|10040\nAlonte|VI|A220|36045\nAlpago|BL|M375|32016\nAlpette|TO|A221|10080\nAlpignano|TO|A222|10091\nAlseno|PC|A223|29010\nAlserio|CO|A224|22040\nAlta Val Tidone|PC|M386|29031\nAlta Valle Intelvi|CO|M383|22024\nAltamura|BA|A225|70022\nAltare|SV|A226|17041\nAltavalle|TN|M349|38092\nAltavilla Irpina|AV|A228|83011\nAltavilla Milicia|PA|A229|90010\nAltavilla Monferrato|AL|A227|15041\nAltavilla Silentina|SA|A230|84045\nAltavilla Vicentina|VI|A231|36077\nAltidona|FM|A233|63824\nAltilia|CS|A234|87040\nAltino|CH|A235|66040\nAltissimo|VI|A236|36070\nAltivole|TV|A237|31030\nAlto Reno Terme|BO|M369|40046\nAlto Sermenza|VC|M389|13029\nAlto|CN|A238|12070\nAltofonte|PA|A239|90030\nAltomonte|CS|A240|87042\nAltopascio|LU|A241|55011\nAltopiano della Vigolana|TN|M350|38049\nAlviano|TR|A242|05020\nAlvignano|CE|A243|81012\nAlvito|FR|A244|03041\nAlzano Lombardo|BG|A246|24022\nAlzano Scrivia|AL|A245|15050\nAlzate Brianza|CO|A249|22040\nAmalfi|SA|A251|84011\nAmandola|FM|A252|63857\nAmantea|CS|A253|87032\nAmaro|UD|A254|33020\nAmaroni|CZ|A255|88050\nAmaseno|FR|A256|03021\nAmato|CZ|A257|88040\nAmatrice|RI|A258|02012\nAmbivere|BG|A259|24030\nAmblar-Don|TN|M351|38011\nAmeglia|SP|A261|19031\nAmelia|TR|A262|05022\nAmendolara|CS|A263|87071\nAmeno|NO|A264|28010\nAmorosi|BN|A265|82031\nAmpezzo|UD|A267|33021\nAnacapri|NA|A268|80071\nAnagni|FR|A269|03012\nAncarano|TE|A270|64010\nAncona|AN|A271|60121-60131\nAndali|CZ|A272|88050\nAndalo Valtellino|SO|A273|23014\nAndalo|TN|A274|38010\nAndezeno|TO|A275|10020\nAndora|SV|A278|17051\nAndorno Micca|BI|A280|13811\nAndrano|LE|A281|73032\nAndrate|TO|A282|10010\nAndreis|PN|A283|33080\nAndretta|AV|A284|83040\nAndria|BT|A285|76123\nAndriano|BZ|A286|39010\nAnela|SS|A287|07010\nAnfo|BS|A288|25070\nAngera|VA|A290|21021\nAnghiari|AR|A291|52031\nAngiari|VR|A292|37050\nAngolo Terme|BS|A293|25040\nAngri|SA|A294|84012\nAngrogna|TO|A295|10060\nAnguillara Sabazia|RM|A297|00061\nAnguillara Veneta|PD|A296|35022\nAnnicco|CR|A299|26021\nAnnone di Brianza|LC|A301|23841\nAnnone Veneto|VE|A302|30020\nAnoia|RC|A303|89020\nAntegnate|BG|A304|24051\nAnterivo|BZ|A306|39040\nAntey-Saint-André|AO|A305|11020\nAnticoli Corrado|RM|A309|00022\nAntignano|AT|A312|14010\nAntillo|ME|A313|98030\nAntonimina|RC|A314|89040\nAntrodoco|RI|A315|02013\nAntrona Schieranco|VB|A317|28841\nAnversa degli Abruzzi|AQ|A318|67030\nAnzano del Parco|CO|A319|22040\nAnzano di Puglia|FG|A320|71020\nAnzi|PZ|A321|85010\nAnzio|RM|A323|00042\nAnzola d'Ossola|VB|A325|28877\nAnzola dell'Emilia|BO|A324|40011\nAosta|AO|A326|11100\nApecchio|PU|A327|61042\nApice|BN|A328|82021\nApiro|MC|A329|62021\nApollosa|BN|A330|82030\nAppiano Gentile|CO|A333|22070\nAppiano sulla strada del vino|BZ|A332|39057\nAppignano del Tronto|AP|A335|63083\nAppignano|MC|A334|62010\nAprica|SO|A337|23031\nApricale|IM|A338|18035\nApricena|FG|A339|71011\nAprigliano|CS|A340|87051\nAprilia|LT|A341|04011\nAquara|SA|A343|84020\nAquila d'Arroscia|IM|A344|18020\nAquileia|UD|A346|33051\nAquilonia|AV|A347|83041\nAquino|FR|A348|03031\nAradeo|LE|A350|73040\nAragona|AG|A351|92021\nAramengo|AT|A352|14020\nArba|PN|A354|33090\nArborea|OR|A357|09092\nArborio|VC|A358|13031\nArbus|SU|A359|09031\nArcade|TV|A360|31030\nArce|FR|A363|03032\nArcene|BG|A365|24040\nArcevia|AN|A366|60011\nArchi|CH|A367|66044\nArcidosso|GR|A369|58031\nArcinazzo Romano|RM|A370|00020\nArcisate|VA|A371|21051\nArco|TN|A372|38062\nArcola|SP|A373|19021\nArcole|VR|A374|37040\nArconate|MI|A375|20020\nArcore|MB|A376|20862\nArcugnano|VI|A377|36057\nArdara|SS|A379|07010\nArdauli|OR|A380|09081\nArdea|RM|M213|00040\nArdenno|SO|A382|23011\nArdesio|BG|A383|24020\nArdore|RC|A385|89031\nArena Po|PV|A387|27040\nArena|VV|A386|89832\nArenzano|GE|A388|16011\nArese|MI|A389|20020\nArezzo|AR|A390|52100\nArgegno|CO|A391|22010\nArgelato|BO|A392|40050\nArgenta|FE|A393|44011\nArgentera|CN|A394|12010\nArguello|CN|A396|12050\nArgusto|CZ|A397|88060\nAri|CH|A398|66010\nAriano Irpino|AV|A399|83031\nAriano nel Polesine|RO|A400|45012\nAriccia|RM|A401|00072\nArielli|CH|A402|66030\nArienzo|CE|A403|81021\nArignano|TO|A405|10020\nAritzo|NU|A407|08031\nArizzano|VB|A409|28811\nArlena di Castro|VT|A412|01010\nArluno|MI|A413|20010\nArmeno|NO|A414|28011\nArmento|PZ|A415|85010\nArmo|IM|A418|18026\nArmungia|SU|A419|09040\nArnad|AO|A424|11020\nArnara|FR|A421|03020\nArnasco|SV|A422|17032\nArnesano|LE|A425|73010\nArola|VB|A427|28899\nArona|NO|A429|28041\nArosio|CO|A430|22060\nArpaia|BN|A431|82011\nArpaise|BN|A432|82010\nArpino|FR|A433|03033\nArquà Petrarca|PD|A434|35032\nArquà Polesine|RO|A435|45031\nArquata del Tronto|AP|A437|63096\nArquata Scrivia|AL|A436|15061\nArre|PD|A438|35020\nArrone|TR|A439|05031\nArsago Seprio|VA|A441|21010\nArsiè|BL|A443|32030\nArsiero|VI|A444|36011\nArsita|TE|A445|64031\nArsoli|RM|A446|00023\nArta Terme|UD|A447|33022\nArtegna|UD|A448|33011\nArtena|RM|A449|00031\nArtogne|BS|A451|25040\nArvier|AO|A452|11011\nArzachena|SS|A453|07021\nArzago d'Adda|BG|A440|24040\nArzana|NU|A454|08040\nArzano|NA|A455|80022\nArzergrande|PD|A458|35020\nArzignano|VI|A459|36071\nAscea|SA|A460|84046\nAsciano|SI|A461|53041\nAscoli Piceno|AP|A462|63100\nAscoli Satriano|FG|A463|71022\nAscrea|RI|A464|02020\nAsiago|VI|A465|36012\nAsigliano Veneto|VI|A467|36020\nAsigliano Vercellese|VC|A466|13032\nAsola|MN|A470|46041\nAsolo|TV|A471|31011\nAssago|MI|A473|20090\nAssemini|CA|A474|09032\nAssisi|PG|A475|06081\nAsso|CO|A476|22033\nAssolo|OR|A477|09080\nAssoro|EN|A478|94010\nAsti|AT|A479|14100\nAsuni|OR|A480|09080\nAteleta|AQ|A481|67030\nAtella|PZ|A482|85020\nAtena Lucana|SA|A484|84030\nAtessa|CH|A485|66041\nAtina|FR|A486|03042\nAtrani|SA|A487|84010\nAtri|TE|A488|64032\nAtripalda|AV|A489|83042\nAttigliano|TR|A490|05012\nAttimis|UD|A491|33040\nAtzara|NU|A492|08030\nAugusta|SR|A494|96011\nAuletta|SA|A495|84031\nAulla|MS|A496|54011\nAurano|VB|A497|28812\nAurigo|IM|A499|18020\nAuronzo di Cadore|BL|A501|32041\nAusonia|FR|A502|03040\nAustis|NU|A503|08030\nAvegno|GE|A506|16036\nAvelengo|BZ|A507|39010\nAvella|AV|A508|83021\nAvellino|AV|A509|83100\nAverara|BG|A511|24010\nAversa|CE|A512|81031\nAvetrana|TA|A514|74020\nAvezzano|AQ|A515|67051\nAviano|PN|A516|33081\nAviatico|BG|A517|24020\nAvigliana|TO|A518|10051\nAvigliano Umbro|TR|M258|05020\nAvigliano|PZ|A519|85021\nAvio|TN|A520|38063\nAvise|AO|A521|11010\nAvola|SR|A522|96012\nAvolasca|AL|A523|15050\nAyas|AO|A094|11020\nAymavilles|AO|A108|11010\nAzeglio|TO|A525|10010\nAzzanello|CR|A526|26010\nAzzano d'Asti|AT|A527|14030\nAzzano Decimo|PN|A530|33082\nAzzano Mella|BS|A529|25020\nAzzano San Paolo|BG|A528|24052\nAzzate|VA|A531|21022\nAzzio|VA|A532|21030\nAzzone|BG|A533|24020\nBaceno|VB|A534|28861\nBacoli|NA|A535|80070\nBadalucco|IM|A536|18010\nBadesi|SS|M214|07030\nBadia Calavena|VR|A540|37030\nBadia Pavese|PV|A538|27010\nBadia Polesine|RO|A539|45021\nBadia Tedalda|AR|A541|52032\nBadia|BZ|A537|39036\nBadolato|CZ|A542|88060\nBagaladi|RC|A544|89060\nBagheria|PA|A546|90011\nBagnacavallo|RA|A547|48012\nBagnara Calabra|RC|A552|89011\nBagnara di Romagna|RA|A551|48031\nBagnaria Arsa|UD|A553|33050\nBagnaria|PV|A550|27050\nBagnasco|CN|A555|12071\nBagnatica|BG|A557|24060\nBagni di Lucca|LU|A560|55022\nBagno a Ripoli|FI|A564|50012\nBagno di Romagna|FC|A565|47021\nBagnoli del Trigno|IS|A567|86091\nBagnoli di Sopra|PD|A568|35023\nBagnoli Irpino|AV|A566|83043\nBagnolo Cremasco|CR|A570|26010\nBagnolo del Salento|LE|A572|73020\nBagnolo di Po|RO|A574|45022\nBagnolo in Piano|RE|A573|42011\nBagnolo Mella|BS|A569|25021\nBagnolo Piemonte|CN|A571|12031\nBagnolo San Vito|MN|A575|46031\nBagnone|MS|A576|54021\nBagnoregio|VT|A577|01022\nBagolino|BS|A578|25072\nBaia e Latina|CE|A579|81010\nBaiano|AV|A580|83022\nBairo|TO|A584|10010\nBaiso|RE|A586|42031\nBajardo|IM|A581|18031\nBalangero|TO|A587|10070\nBaldichieri d'Asti|AT|A588|14011\nBaldissero Canavese|TO|A590|10080\nBaldissero d'Alba|CN|A589|12040\nBaldissero Torinese|TO|A591|10020\nBalestrate|PA|A592|90041\nBalestrino|SV|A593|17020\nBallabio|LC|A594|23811\nBallao|SU|A597|09040\nBalme|TO|A599|10070\nBalmuccia|VC|A600|13020\nBalocco|VC|A601|13040\nBalsorano|AQ|A603|67052\nBalvano|PZ|A604|85050\nBalzola|AL|A605|15031\nBanari|SS|A606|07040\nBanchette|TO|A607|10010\nBannio Anzino|VB|A610|28871\nBanzi|PZ|A612|85010\nBaone|PD|A613|35030\nBaradili|OR|A614|09090\nBaragiano|PZ|A615|85050\nBaranello|CB|A616|86011\nBarano d'Ischia|NA|A617|80072\nBaranzate|MI|A618|20021\nBarasso|VA|A619|21020\nBaratili San Pietro|OR|A621|09070\nBarbania|TO|A625|10070\nBarbara|AN|A626|60010\nBarbarano Mossano|VI|M401|36048\nBarbarano Romano|VT|A628|01010\nBarbaresco|CN|A629|12050\nBarbariga|BS|A630|25030\nBarbata|BG|A631|24040\nBarberino di Mugello|FI|A632|50031\nBarberino Tavarnelle|FI|M408|50028\nBarbianello|PV|A634|27041\nBarbiano|BZ|A635|39040\nBarbona|PD|A637|35040\nBarcellona Pozzo di Gotto|ME|A638|98051\nBarcis|PN|A640|33080\nBard|AO|A643|11020\nBardello|VA|A645|21020\nBardi|PR|A646|43032\nBardineto|SV|A647|17057\nBardolino|VR|A650|37011\nBardonecchia|TO|A651|10052\nBareggio|MI|A652|20010\nBarengo|NO|A653|28010\nBaressa|OR|A655|09090\nBarete|AQ|A656|67010\nBarga|LU|A657|55051\nBargagli|GE|A658|16021\nBarge|CN|A660|12032\nBarghe|BS|A661|25070\nBari Sardo|NU|A663|08042\nBari|BA|A662|70121-70132\nBariano|BG|A664|24050\nBaricella|BO|A665|40052\nBarile|PZ|A666|85022\nBarisciano|AQ|A667|67021\nBarlassina|MB|A668|20825\nBarletta|BT|A669|76121\nBarni|CO|A670|22030\nBarolo|CN|A671|12060\nBarone Canavese|TO|A673|10010\nBaronissi|SA|A674|84081\nBarrafranca|EN|A676|94012\nBarrali|SU|A677|09040\nBarrea|AQ|A678|67030\nBarumini|SU|A681|09021\nBarzago|LC|A683|23890\nBarzana|BG|A684|24030\nBarzanò|LC|A686|23891\nBarzio|LC|A687|23816\nBasaluzzo|AL|A689|15060\nBascapè|PV|A690|27010\nBaschi|TR|A691|05023\nBasciano|TE|A692|64030\nBaselga di Pinè|TN|A694|38042\nBaselice|BN|A696|82020\nBasiano|MI|A697|20060\nBasicò|ME|A698|98060\nBasiglio|MI|A699|20080\nBasiliano|UD|A700|33031\nBassano Bresciano|BS|A702|25020\nBassano del Grappa|VI|A703|36061\nBassano in Teverina|VT|A706|01030\nBassano Romano|VT|A704|01030\nBassiano|LT|A707|04010\nBassignana|AL|A708|15042\nBastia Mondovì|CN|A709|12060\nBastia Umbra|PG|A710|06083\nBastida Pancarana|PV|A712|27050\nBastiglia|MO|A713|41030\nBattaglia Terme|PD|A714|35041\nBattifollo|CN|A716|12070\nBattipaglia|SA|A717|84091\nBattuda|PV|A718|27020\nBaucina|PA|A719|90020\nBauladu|OR|A721|09070\nBaunei|NU|A722|08040\nBaveno|VB|A725|28831\nBedero Valcuvia|VA|A728|21039\nBedizzole|BS|A729|25081\nBedollo|TN|A730|38043\nBedonia|PR|A731|43041\nBedulita|BG|A732|24030\nBee|VB|A733|28813\nBeinasco|TO|A734|10092\nBeinette|CN|A735|12081\nBelcastro|CZ|A736|88050\nBelfiore|VR|A737|37050\nBelforte all'Isauro|PU|A740|61026\nBelforte del Chienti|MC|A739|62020\nBelforte Monferrato|AL|A738|15070\nBelgioioso|PV|A741|27011\nBelgirate|VB|A742|28832\nBella|PZ|A743|85051\nBellagio|CO|M335|22021\nBellano|LC|A745|23822\nBellante|TE|A746|64020\nBellaria-Igea Marina|RN|A747|47814\nBellegra|RM|A749|00030\nBellino|CN|A750|12020\nBellinzago Lombardo|MI|A751|20060\nBellinzago Novarese|NO|A752|28043\nBellizzi|SA|M294|84092\nBellona|CE|A755|81041\nBellosguardo|SA|A756|84020\nBelluno|BL|A757|32100\nBellusco|MB|A759|20882\nBelmonte Calabro|CS|A762|87033\nBelmonte Castello|FR|A763|03040\nBelmonte del Sannio|IS|A761|86080\nBelmonte in Sabina|RI|A765|02020\nBelmonte Mezzagno|PA|A764|90031\nBelmonte Piceno|FM|A760|63838\nBelpasso|CT|A766|95032\nBelsito|CS|A768|87030\nBelvedere di Spinello|KR|A772|88824\nBelvedere Langhe|CN|A774|12060\nBelvedere Marittimo|CS|A773|87021\nBelvedere Ostrense|AN|A769|60030\nBelveglio|AT|A770|14040\nBelvì|NU|A776|08030\nBema|SO|A777|23010\nBene Lario|CO|A778|22010\nBene Vagienna|CN|A779|12041\nBenestare|RC|A780|89030\nBenetutti|SS|A781|07010\nBenevello|CN|A782|12050\nBenevento|BN|A783|82100\nBenna|BI|A784|13871\nBentivoglio|BO|A785|40010\nBerbenno di Valtellina|SO|A787|23010\nBerbenno|BG|A786|24030\nBerceto|PR|A788|43042\nBerchidda|SS|A789|07022\nBeregazzo con Figliaro|CO|A791|22070\nBereguardo|PV|A792|27021\nBergamasco|AL|A793|15022\nBergamo|BG|A794|24121-24129\nBergantino|RO|A795|45032\nBergeggi|SV|A796|17028\nBergolo|CN|A798|12074\nBerlingo|BS|A799|25030\nBernalda|MT|A801|75012\nBernareggio|MB|A802|20881\nBernate Ticino|MI|A804|20010\nBernezzo|CN|A805|12010\nBertinoro|FC|A809|47032\nBertiolo|UD|A810|33032\nBertonico|LO|A811|26821\nBerzano di San Pietro|AT|A812|14020\nBerzano di Tortona|AL|A813|15050\nBerzo Demo|BS|A816|25040\nBerzo Inferiore|BS|A817|25040\nBerzo San Fermo|BG|A815|24060\nBesana in Brianza|MB|A818|20842\nBesano|VA|A819|21050\nBesate|MI|A820|20080\nBesenello|TN|A821|38060\nBesenzone|PC|A823|29010\nBesnate|VA|A825|21010\nBesozzo|VA|A826|21023\nBessude|SS|A827|07040\nBettola|PC|A831|29021\nBettona|PG|A832|06084\nBeura-Cardezza|VB|A834|28851\nBevagna|PG|A835|06031\nBeverino|SP|A836|19020\nBevilacqua|VR|A837|37040\nBiancavilla|CT|A841|95033\nBianchi|CS|A842|87050\nBianco|RC|A843|89032\nBiandrate|NO|A844|28061\nBiandronno|VA|A845|21024\nBianzano|BG|A846|24060\nBianzè|VC|A847|13041\nBianzone|SO|A848|23030\nBiassono|MB|A849|20853\nBibbiano|RE|A850|42021\nBibbiena|AR|A851|52011\nBibbona|LI|A852|57020\nBibiana|TO|A853|10060\nBiccari|FG|A854|71032\nBicinicco|UD|A855|33050\nBidonì|OR|A856|09080\nBiella|BI|A859|13900\nBienno|BS|A861|25040\nBieno|TN|A863|38050\nBientina|PI|A864|56031\nBinago|CO|A870|22070\nBinasco|MI|A872|20082\nBinetto|BA|A874|70020\nBioglio|BI|A876|13841\nBionaz|AO|A877|11010\nBione|BS|A878|25070\nBirori|NU|A880|08010\nBisaccia|AV|A881|83044\nBisacquino|PA|A882|90032\nBisceglie|BT|A883|76011\nBisegna|AQ|A884|67050\nBisenti|TE|A885|64033\nBisignano|CS|A887|87043\nBistagno|AL|A889|15012\nBisuschio|VA|A891|21050\nBitetto|BA|A892|70020\nBitonto|BA|A893|70032\nBitritto|BA|A894|70020\nBitti|NU|A895|08021\nBivona|AG|A896|92010\nBivongi|RC|A897|89040\nBizzarone|CO|A898|22020\nBleggio Superiore|TN|A902|38071\nBlello|BG|A903|24010\nBlera|VT|A857|01010\nBlessagno|CO|A904|22028\nBlevio|CO|A905|22020\nBlufi|PA|M268|90020\nBoara Pisani|PD|A906|35040\nBobbio Pellice|TO|A910|10060\nBobbio|PC|A909|29022\nBoca|NO|A911|28010\nBocchigliero|CS|A912|87060\nBoccioleto|VC|A914|13022\nBocenago|TN|A916|38080\nBodio Lomnago|VA|A918|21020\nBoffalora d'Adda|LO|A919|26811\nBoffalora sopra Ticino|MI|A920|20010\nBogliasco|GE|A922|16031\nBognanco|VB|A925|28842\nBogogno|NO|A929|28010\nBoissano|SV|A931|17054\nBojano|CB|A930|86021\nBolano|SP|A932|19020\nBolgare|BG|A937|24060\nBollate|MI|A940|20021\nBollengo|TO|A941|10012\nBologna|BO|A944|40121-40141\nBolognano|PE|A945|65020\nBolognetta|PA|A946|90030\nBolognola|MC|A947|62035\nBolotana|NU|A948|08011\nBolsena|VT|A949|01023\nBoltiere|BG|A950|24040\nBolzano Novarese|NO|A953|28010\nBolzano Vicentino|VI|A954|36050\nBolzano|BZ|A952|39100\nBomarzo|VT|A955|01020\nBomba|CH|A956|66042\nBompensiere|CL|A957|93010\nBompietro|PA|A958|90020\nBomporto|MO|A959|41030\nBonarcado|OR|A960|09070\nBonassola|SP|A961|19011\nBonate Sopra|BG|A963|24040\nBonate Sotto|BG|A962|24040\nBonavigo|VR|A964|37040\nBondeno|FE|A965|44012\nBondone|TN|A968|38080\nBonea|BN|A970|82013\nBonefro|CB|A971|86041\nBonemerse|CR|A972|26040\nBonifati|CS|A973|87020\nBonito|AV|A975|83032\nBonnanaro|SS|A976|07043\nBono|SS|A977|07011\nBonorva|SS|A978|07012\nBonvicino|CN|A979|12060\nBorbona|RI|A981|02010\nBorca di Cadore|BL|A982|32040\nBordano|UD|A983|33010\nBordighera|IM|A984|18012\nBordolano|CR|A986|26020\nBore|PR|A987|43030\nBoretto|RE|A988|42022\nBorgarello|PV|A989|27010\nBorgaro Torinese|TO|A990|10071\nBorgetto|PA|A991|90042\nBorghetto d'Arroscia|IM|A993|18020\nBorghetto di Borbera|AL|A998|15060\nBorghetto di Vara|SP|A992|19020\nBorghetto Lodigiano|LO|A995|26812\nBorghetto Santo Spirito|SV|A999|17052\nBorghi|FC|B001|47030\nBorgia|CZ|B002|88021\nBorgiallo|TO|B003|10080\nBorgio Verezzi|SV|B005|17022\nBorgo a Mozzano|LU|B007|55023\nBorgo Chiese|TN|M352|38083\nBorgo d'Ale|VC|B009|13040\nBorgo d'Anaunia|TN|M429|38013,38020\nBorgo di Terzo|BG|B010|24060\nBorgo Lares|TN|M353|38079\nBorgo Mantovano|MN|M396|46036\nBorgo Pace|PU|B026|61040\nBorgo Priolo|PV|B028|27040\nBorgo San Dalmazzo|CN|B033|12011\nBorgo San Giacomo|BS|B035|25022\nBorgo San Giovanni|LO|B017|26851\nBorgo San Lorenzo|FI|B036|50032\nBorgo San Martino|AL|B037|15032\nBorgo San Siro|PV|B038|27020\nBorgo Ticino|NO|B043|28040\nBorgo Tossignano|BO|B044|40021\nBorgo Val di Taro|PR|B042|43043\nBorgo Valbelluna|BL|M421|32026\nBorgo Valsugana|TN|B006|38051\nBorgo Velino|RI|A996|02010\nBorgo Veneto|PD|M402|35046\nBorgo Vercelli|VC|B046|13012\nBorgo Virgilio|MN|M340|46034\nBorgocarbonara|MN|M406|46021\nBorgofranco d'Ivrea|TO|B015|10013\nBorgolavezzaro|NO|B016|28071\nBorgomale|CN|B018|12050\nBorgomanero|NO|B019|28021\nBorgomaro|IM|B020|18021\nBorgomasino|TO|B021|10031\nBorgomezzavalle|VB|M370|28846\nBorgone Susa|TO|B024|10050\nBorgonovo Val Tidone|PC|B025|29011\nBorgoratto Alessandrino|AL|B029|15013\nBorgoratto Mormorolo|PV|B030|27040\nBorgoricco|PD|B031|35010\nBorgorose|RI|B008|02021\nBorgosatollo|BS|B040|25010\nBorgosesia|VC|B041|13011\nBormida|SV|B048|17045\nBormio|SO|B049|23032\nBornasco|PV|B051|27010\nBorno|BS|B054|25042\nBoroneddu|OR|B055|09080\nBorore|NU|B056|08016\nBorrello|CH|B057|66040\nBorriana|BI|B058|13872\nBorso del Grappa|TV|B061|31030\nBortigali|NU|B062|08012\nBortigiadas|SS|B063|07030\nBorutta|SS|B064|07040\nBorzonasca|GE|B067|16041\nBosa|OR|B068|09089\nBosaro|RO|B069|45033\nBoschi Sant'Anna|VR|B070|37040\nBosco Chiesanuova|VR|B073|37021\nBosco Marengo|AL|B071|15062\nBosconero|TO|B075|10080\nBoscoreale|NA|B076|80041\nBoscotrecase|NA|B077|80042\nBosia|CN|B079|12050\nBosio|AL|B080|15060\nBosisio Parini|LC|B081|23842\nBosnasco|PV|B082|27040\nBossico|BG|B083|24060\nBossolasco|CN|B084|12060\nBotricello|CZ|B085|88070\nBotrugno|LE|B086|73020\nBottanuco|BG|B088|24040\nBotticino|BS|B091|25082\nBottidda|SS|B094|07010\nBova Marina|RC|B099|89035\nBova|RC|B097|89033\nBovalino|RC|B098|89034\nBovegno|BS|B100|25061\nBoves|CN|B101|12012\nBovezzo|BS|B102|25073\nBoville Ernica|FR|A720|03022\nBovino|FG|B104|71023\nBovisio-Masciago|MB|B105|20813\nBovolenta|PD|B106|35024\nBovolone|VR|B107|37051\nBozzole|AL|B109|15040\nBozzolo|MN|B110|46012\nBra|CN|B111|12042\nBracca|BG|B112|24010\nBracciano|RM|B114|00062\nBracigliano|SA|B115|84082\nBraies|BZ|B116|39030\nBrallo di Pregola|PV|B117|27050\nBrancaleone|RC|B118|89036\nBrandico|BS|B120|25030\nBrandizzo|TO|B121|10032\nBranzi|BG|B123|24010\nBraone|BS|B124|25040\nBrebbia|VA|B126|21020\nBreda di Piave|TV|B128|31030\nBregano|VA|B131|21020\nBreganze|VI|B132|36042\nBregnano|CO|B134|22070\nBrembate di Sopra|BG|B138|24030\nBrembate|BG|B137|24041\nBrembio|LO|B141|26822\nBreme|PV|B142|27020\nBrendola|VI|B143|36040\nBrenna|CO|B144|22040\nBrennero|BZ|B145|39041\nBreno|BS|B149|25043\nBrenta|VA|B150|21030\nBrentino Belluno|VR|B152|37020\nBrentonico|TN|B153|38060\nBrenzone sul Garda|VR|B154|37010\nBrescello|RE|B156|42041\nBrescia|BS|B157|25121-25136\nBresimo|TN|B158|38020\nBressana Bottarone|PV|B159|27042\nBressanone|BZ|B160|39042\nBressanvido|VI|B161|36050\nBresso|MI|B162|20091\nBrezzo di Bedero|VA|B166|21010\nBriaglia|CN|B167|12080\nBriatico|VV|B169|89817\nBricherasio|TO|B171|10060\nBrienno|CO|B172|22010\nBrienza|PZ|B173|85050\nBriga Alta|CN|B175|18025\nBriga Novarese|NO|B176|28010\nBrignano Gera d'Adda|BG|B178|24053\nBrignano-Frascata|AL|B179|15050\nBrindisi Montagna|PZ|B181|85010\nBrindisi|BR|B180|72100\nBrinzio|VA|B182|21030\nBriona|NO|B183|28072\nBrione|BS|B184|25060\nBriosco|MB|B187|20836\nBrisighella|RA|B188|48013\nBrissago-Valtravaglia|VA|B191|21030\nBrissogne|AO|B192|11020\nBrittoli|PE|B193|65010\nBrivio|LC|B194|23883\nBroccostella|FR|B195|03030\nBrogliano|VI|B196|36070\nBrognaturo|VV|B197|89822\nBrolo|ME|B198|98061\nBrondello|CN|B200|12030\nBroni|PV|B201|27043\nBronte|CT|B202|95034\nBronzolo|BZ|B203|39051\nBrossasco|CN|B204|12020\nBrosso|TO|B205|10080\nBrovello-Carpugnino|VB|B207|28833\nBrozolo|TO|B209|10020\nBrugherio|MB|B212|20861\nBrugine|PD|B213|35020\nBrugnato|SP|B214|19020\nBrugnera|PN|B215|33070\nBruino|TO|B216|10090\nBrumano|BG|B217|24037\nBrunate|CO|B218|22034\nBrunello|VA|B219|21020\nBrunico|BZ|B220|39031\nBruno|AT|B221|14046\nBrusaporto|BG|B223|24060\nBrusasco|TO|B225|10020\nBrusciano|NA|B227|80031\nBrusimpiano|VA|B228|21050\nBrusnengo|BI|B229|13862\nBrusson|AO|B230|11022\nBruzolo|TO|B232|10050\nBruzzano Zeffirio|RC|B234|89030\nBubbiano|MI|B235|20080\nBubbio|AT|B236|14051\nBuccheri|SR|B237|96010\nBucchianico|CH|B238|66011\nBucciano|BN|B239|82010\nBuccinasco|MI|B240|20090\nBuccino|SA|B242|84021\nBucine|AR|B243|52021\nBuddusò|SS|B246|07020\nBudoia|PN|B247|33070\nBudoni|SS|B248|07051\nBudrio|BO|B249|40054\nBuggerru|SU|B250|09010\nBuggiano|PT|B251|51011\nBuglio in Monte|SO|B255|23010\nBugnara|AQ|B256|67030\nBuguggiate|VA|B258|21020\nBuja|UD|B259|33030\nBulciago|LC|B261|23892\nBulgarograsso|CO|B262|22070\nBultei|SS|B264|07010\nBulzi|SS|B265|07030\nBuonabitacolo|SA|B266|84032\nBuonalbergo|BN|B267|82020\nBuonconvento|SI|B269|53022\nBuonvicino|CS|B270|87020\nBurago di Molgora|MB|B272|20875\nBurcei|SU|B274|09040\nBurgio|AG|B275|92010\nBurgos|SS|B276|07010\nBuriasco|TO|B278|10060\nBurolo|TO|B279|10010\nBuronzo|VC|B280|13040\nBusachi|OR|B281|09082\nBusalla|GE|B282|16012\nBusano|TO|B284|10080\nBusca|CN|B285|12022\nBuscate|MI|B286|20010\nBuscemi|SR|B287|96010\nBuseto Palizzolo|TP|B288|91012\nBusnago|MB|B289|20874\nBussero|MI|B292|20060\nBusseto|PR|B293|43011\nBussi sul Tirino|PE|B294|65022\nBusso|CB|B295|86010\nBussolengo|VR|B296|37012\nBussoleno|TO|B297|10053\nBusto Arsizio|VA|B300|21052\nBusto Garolfo|MI|B301|20020\nButera|CL|B302|93011\nButi|PI|B303|56032\nButtapietra|VR|B304|37060\nButtigliera Alta|TO|B305|10090\nButtigliera d'Asti|AT|B306|14021\nButtrio|UD|B309|33042\nCabella Ligure|AL|B311|15060\nCabiate|CO|B313|22060\nCabras|OR|B314|09072\nCaccamo|PA|B315|90012\nCaccuri|KR|B319|88833\nCadegliano-Viconago|VA|B326|21031\nCadelbosco di Sopra|RE|B328|42023\nCadeo|PC|B332|29010\nCaderzone Terme|TN|B335|38080\nCadoneghe|PD|B345|35010\nCadorago|CO|B346|22071\nCadrezzate con Osmate|VA|M425|21062\nCaerano di San Marco|TV|B349|31031\nCafasse|TO|B350|10070\nCaggiano|SA|B351|84030\nCagli|PU|B352|61043\nCagliari|CA|B354|09121-09134\nCaglio|CO|B355|22030\nCagnano Amiterno|AQ|B358|67012\nCagnano Varano|FG|B357|71010\nCaianello|CE|B361|81059\nCaiazzo|CE|B362|81013\nCaines|BZ|B364|39010\nCaino|BS|B365|25070\nCaiolo|SO|B366|23010\nCairano|AV|B367|83040\nCairate|VA|B368|21050\nCairo Montenotte|SV|B369|17014\nCaivano|NA|B371|80023\nCalabritto|AV|B374|83040\nCalalzo di Cadore|BL|B375|32042\nCalamandrana|AT|B376|14042\nCalamonaci|AG|B377|92010\nCalangianus|SS|B378|07023\nCalanna|RC|B379|89050\nCalasca-Castiglione|VB|B380|28873\nCalascibetta|EN|B381|94010\nCalascio|AQ|B382|67020\nCalasetta|SU|B383|09011\nCalatabiano|CT|B384|95011\nCalatafimi-Segesta|TP|B385|91013\nCalcata|VT|B388|01030\nCalceranica al Lago|TN|B389|38050\nCalci|PI|B390|56011\nCalciano|MT|B391|75010\nCalcinaia|PI|B392|56012\nCalcinate|BG|B393|24050\nCalcinato|BS|B394|25011\nCalcio|BG|B395|24054\nCalco|LC|B396|23885\nCaldaro sulla strada del vino|BZ|B397|39052\nCaldarola|MC|B398|62020\nCalderara di Reno|BO|B399|40012\nCaldes|TN|B400|38022\nCaldiero|VR|B402|37042\nCaldogno|VI|B403|36030\nCaldonazzo|TN|B404|38052\nCalendasco|PC|B405|29010\nCalenzano|FI|B406|50041\nCalestano|PR|B408|43030\nCalice al Cornoviglio|SP|B410|19020\nCalice Ligure|SV|B409|17020\nCalimera|LE|B413|73021\nCalitri|AV|B415|83045\nCalizzano|SV|B416|17057\nCallabiana|BI|B417|13821\nCalliano|AT|B418|14031\nCalliano|TN|B419|38060\nCalolziocorte|LC|B423|23801\nCalopezzati|CS|B424|87060\nCalosso|AT|B425|14052\nCaloveto|CS|B426|87060\nCaltabellotta|AG|B427|92010\nCaltagirone|CT|B428|95041\nCaltanissetta|CL|B429|93100\nCaltavuturo|PA|B430|90022\nCaltignaga|NO|B431|28010\nCalto|RO|B432|45030\nCaltrano|VI|B433|36030\nCalusco d'Adda|BG|B434|24033\nCaluso|TO|B435|10014\nCalvagese della Riviera|BS|B436|25080\nCalvanico|SA|B437|84080\nCalvatone|CR|B439|26030\nCalvello|PZ|B440|85010\nCalvene|VI|B441|36030\nCalvenzano|BG|B442|24040\nCalvera|PZ|B443|85030\nCalvi dell'Umbria|TR|B446|05032\nCalvi Risorta|CE|B445|81042\nCalvi|BN|B444|82018\nCalvignano|PV|B447|27040\nCalvignasco|MI|B448|20080\nCalvisano|BS|B450|25012\nCalvizzano|NA|B452|80012\nCamagna Monferrato|AL|B453|15030\nCamaiore|LU|B455|55041\nCamandona|BI|B457|13821\nCamastra|AG|B460|92020\nCambiago|MI|B461|20040\nCambiano|TO|B462|10020\nCambiasca|VB|B463|28814\nCamburzano|BI|B465|13891\nCamerana|CN|B467|12072\nCamerano Casasco|AT|B469|14020\nCamerano|AN|B468|60021\nCamerata Cornello|BG|B471|24010\nCamerata Nuova|RM|B472|00020\nCamerata Picena|AN|B470|60020\nCameri|NO|B473|28062\nCamerino|MC|B474|62032\nCamerota|SA|B476|84059\nCamigliano|CE|B477|81050\nCamini|RC|B481|89040\nCamino al Tagliamento|UD|B483|33030\nCamino|AL|B482|15020\nCamisano Vicentino|VI|B485|36043\nCamisano|CR|B484|26010\nCammarata|AG|B486|92022\nCamogli|GE|B490|16032\nCampagna Lupia|VE|B493|30010\nCampagna|SA|B492|84022\nCampagnano di Roma|RM|B496|00063\nCampagnatico|GR|B497|58042\nCampagnola Cremasca|CR|B498|26010\nCampagnola Emilia|RE|B499|42012\nCampana|CS|B500|87061\nCamparada|MB|B501|20857\nCampegine|RE|B502|42040\nCampello sul Clitunno|PG|B504|06042\nCampertogno|VC|B505|13023\nCampi Bisenzio|FI|B507|50013\nCampi Salentina|LE|B506|73012\nCampiglia Cervo|BI|M373|13812\nCampiglia dei Berici|VI|B511|36020\nCampiglia Marittima|LI|B509|57021\nCampiglione Fenile|TO|B512|10060\nCampione d'Italia|CO|B513|22060\nCampitello di Fassa|TN|B514|38031\nCampli|TE|B515|64012\nCampo Calabro|RC|B516|89052\nCampo di Giove|AQ|B526|67030\nCampo di Trens|BZ|B529|39040\nCampo Ligure|GE|B538|16013\nCampo nell'Elba|LI|B553|57034\nCampo San Martino|PD|B564|35010\nCampo Tures|BZ|B570|39032\nCampobasso|CB|B519|86100\nCampobello di Licata|AG|B520|92023\nCampobello di Mazara|TP|B521|91021\nCampochiaro|CB|B522|86020\nCampodarsego|PD|B524|35011\nCampodenno|TN|B525|38010\nCampodimele|LT|B527|04020\nCampodipietra|CB|B528|86010\nCampodolcino|SO|B530|23021\nCampodoro|PD|B531|35010\nCampofelice di Fitalia|PA|B533|90030\nCampofelice di Roccella|PA|B532|90010\nCampofilone|FM|B534|63828\nCampofiorito|PA|B535|90030\nCampoformido|UD|B536|33030\nCampofranco|CL|B537|93010\nCampogalliano|MO|B539|41011\nCampolattaro|BN|B541|82020\nCampoli Appennino|FR|B543|03030\nCampoli del Monte Taburno|BN|B542|82030\nCampolieto|CB|B544|86040\nCampolongo Maggiore|VE|B546|30010\nCampolongo Tapogliano|UD|M311|33040\nCampomaggiore|PZ|B549|85010\nCampomarino|CB|B550|86042\nCampomorone|GE|B551|16014\nCamponogara|VE|B554|30010\nCampora|SA|B555|84040\nCamporeale|PA|B556|90043\nCamporgiano|LU|B557|55031\nCamporosso|IM|B559|18033\nCamporotondo di Fiastrone|MC|B562|62020\nCamporotondo Etneo|CT|B561|95040\nCamposampiero|PD|B563|35012\nCamposano|NA|B565|80030\nCamposanto|MO|B566|41031\nCampospinoso|PV|B567|27040\nCampotosto|AQ|B569|67013\nCamugnano|BO|B572|40032\nCanal San Bovo|TN|B577|38050\nCanale d'Agordo|BL|B574|32020\nCanale Monterano|RM|B576|00060\nCanale|CN|B573|12043\nCanaro|RO|B578|45034\nCanazei|TN|B579|38032\nCancellara|PZ|B580|85010\nCancello ed Arnone|CE|B581|81030\nCanda|RO|B582|45020\nCandela|FG|B584|71024\nCandelo|BI|B586|13878\nCandia Canavese|TO|B588|10010\nCandia Lomellina|PV|B587|27031\nCandiana|PD|B589|35020\nCandida|AV|B590|83040\nCandidoni|RC|B591|89020\nCandiolo|TO|B592|10060\nCanegrate|MI|B593|20010\nCanelli|AT|B594|14053\nCanepina|VT|B597|01030\nCaneva|PN|B598|33070\nCanicattì|AG|B602|92024\nCanicattini Bagni|SR|B603|96010\nCanino|VT|B604|01011\nCanischio|TO|B605|10080\nCanistro|AQ|B606|67050\nCanna|CS|B607|87070\nCannalonga|SA|B608|84040\nCannara|PG|B609|06033\nCannero Riviera|VB|B610|28821\nCanneto Pavese|PV|B613|27044\nCanneto sull'Oglio|MN|B612|46013\nCannobio|VB|B615|28822\nCannole|LE|B616|73020\nCanolo|RC|B617|89040\nCanonica d'Adda|BG|B618|24040\nCanosa di Puglia|BT|B619|76012\nCanosa Sannita|CH|B620|66010\nCanosio|CN|B621|12020\nCanossa|RE|C669|42026\nCansano|AQ|B624|67030\nCantagallo|PO|B626|59025\nCantalice|RI|B627|02014\nCantalupa|TO|B628|10060\nCantalupo in Sabina|RI|B631|02040\nCantalupo Ligure|AL|B629|15060\nCantalupo nel Sannio|IS|B630|86092\nCantarana|AT|B633|14010\nCantello|VA|B634|21050\nCanterano|RM|B635|00020\nCantiano|PU|B636|61044\nCantoira|TO|B637|10070\nCantù|CO|B639|22063\nCanzano|TE|B640|64020\nCanzo|CO|B641|22035\nCaorle|VE|B642|30021\nCaorso|PC|B643|29012\nCapaccio Paestum|SA|B644|84047\nCapaci|PA|B645|90040\nCapalbio|GR|B646|58011\nCapannoli|PI|B647|56033\nCapannori|LU|B648|55012\nCapena|RM|B649|00060\nCapergnanica|CR|B650|26010\nCapestrano|AQ|B651|67022\nCapiago Intimiano|CO|B653|22070\nCapistrano|VV|B655|89818\nCapistrello|AQ|B656|67053\nCapitignano|AQ|B658|67014\nCapizzi|ME|B660|98031\nCapizzone|BG|B661|24030\nCapo d'Orlando|ME|B666|98071\nCapo di Ponte|BS|B664|25044\nCapodimonte|VT|B663|01010\nCapodrise|CE|B667|81020\nCapoliveri|LI|B669|57031\nCapolona|AR|B670|52010\nCaponago|MB|B671|20867\nCaporciano|AQ|B672|67020\nCaposele|AV|B674|83040\nCapoterra|CA|B675|09012\nCapovalle|BS|B676|25070\nCappadocia|AQ|B677|67060\nCappella Cantone|CR|B679|26020\nCappella de' Picenardi|CR|B680|26030\nCappella Maggiore|TV|B678|31012\nCappelle sul Tavo|PE|B681|65010\nCapracotta|IS|B682|86082\nCapraia e Limite|FI|B684|50050\nCapraia Isola|LI|B685|57032\nCapralba|CR|B686|26010\nCapranica Prenestina|RM|B687|00030\nCapranica|VT|B688|01012\nCaprarica di Lecce|LE|B690|73010\nCaprarola|VT|B691|01032\nCaprauna|CN|B692|12070\nCaprese Michelangelo|AR|B693|52033\nCaprezzo|VB|B694|28815\nCapri Leone|ME|B695|98070\nCapri|NA|B696|80073\nCapriana|TN|B697|38030\nCapriano del Colle|BS|B698|25020\nCapriata d'Orba|AL|B701|15060\nCapriate San Gervasio|BG|B703|24042\nCapriati a Volturno|CE|B704|81014\nCaprie|TO|B705|10040\nCapriglia Irpina|AV|B706|83010\nCapriglio|AT|B707|14014\nCaprile|BI|B708|13864\nCaprino Bergamasco|BG|B710|24030\nCaprino Veronese|VR|B709|37013\nCapriolo|BS|B711|25031\nCapriva del Friuli|GO|B712|34070\nCapua|CE|B715|81043\nCapurso|BA|B716|70010\nCaraffa del Bianco|RC|B718|89030\nCaraffa di Catanzaro|CZ|B717|88050\nCaraglio|CN|B719|12023\nCaramagna Piemonte|CN|B720|12030\nCaramanico Terme|PE|B722|65023\nCarapelle Calvisio|AQ|B725|67020\nCarapelle|FG|B724|71041\nCarasco|GE|B726|16042\nCarassai|AP|B727|63063\nCarate Brianza|MB|B729|20841\nCarate Urio|CO|B730|22010\nCaravaggio|BG|B731|24043\nCaravate|VA|B732|21032\nCaravino|TO|B733|10010\nCaravonica|IM|B734|18020\nCarbognano|VT|B735|01030\nCarbonara al Ticino|PV|B741|27020\nCarbonara di Nola|NA|B740|80030\nCarbonara Scrivia|AL|B736|15050\nCarbonate|CO|B742|22070\nCarbone|PZ|B743|85030\nCarbonera|TV|B744|31030\nCarbonia|SU|B745|09013\nCarcare|SV|B748|17043\nCarceri|PD|B749|35040\nCarcoforo|VC|B752|13026\nCardano al Campo|VA|B754|21010\nCardè|CN|B755|12030\nCardedu|NU|M285|08040\nCardeto|RC|B756|89060\nCardinale|CZ|B758|88062\nCardito|NA|B759|80024\nCareggine|LU|B760|55030\nCarema|TO|B762|10010\nCarenno|LC|B763|23802\nCarentino|AL|B765|15026\nCareri|RC|B766|89030\nCaresana|VC|B767|13010\nCaresanablot|VC|B768|13030\nCarezzano|AL|B769|15051\nCarfizzi|KR|B771|88817\nCargeghe|SS|B772|07030\nCariati|CS|B774|87062\nCarife|AV|B776|83040\nCarignano|TO|B777|10041\nCarimate|CO|B778|22060\nCarinaro|CE|B779|81032\nCarini|PA|B780|90044\nCarinola|CE|B781|81030\nCarisio|VC|B782|13040\nCarisolo|TN|B783|38080\nCarlantino|FG|B784|71030\nCarlazzo|CO|B785|22010\nCarlentini|SR|B787|96013\nCarlino|UD|B788|33050\nCarloforte|SU|B789|09014\nCarlopoli|CZ|B790|88040\nCarmagnola|TO|B791|10022\nCarmiano|LE|B792|73041\nCarmignano di Brenta|PD|B795|35010\nCarmignano|PO|B794|59015\nCarnago|VA|B796|21040\nCarnate|MB|B798|20866\nCarobbio degli Angeli|BG|B801|24060\nCarolei|CS|B802|87030\nCarona|BG|B803|24010\nCaronia|ME|B804|98072\nCaronno Pertusella|VA|B805|21042\nCaronno Varesino|VA|B807|21040\nCarosino|TA|B808|74021\nCarovigno|BR|B809|72012\nCarovilli|IS|B810|86083\nCarpaneto Piacentino|PC|B812|29013\nCarpanzano|CS|B813|87050\nCarpegna|PU|B816|61021\nCarpenedolo|BS|B817|25013\nCarpeneto|AL|B818|15071\nCarpi|MO|B819|41012\nCarpiano|MI|B820|20080\nCarpignano Salentino|LE|B822|73020\nCarpignano Sesia|NO|B823|28064\nCarpineti|RE|B825|42033\nCarpineto della Nora|PE|B827|65010\nCarpineto Romano|RM|B828|00032\nCarpineto Sinello|CH|B826|66030\nCarpino|FG|B829|71010\nCarpinone|IS|B830|86093\nCarrara|MS|B832|54033\nCarrè|VI|B835|36010\nCarrega Ligure|AL|B836|15060\nCarro|SP|B838|19012\nCarrodano|SP|B839|19020\nCarrosio|AL|B840|15060\nCarrù|CN|B841|12061\nCarsoli|AQ|B842|67061\nCartigliano|VI|B844|36050\nCartignano|CN|B845|12020\nCartoceto|PU|B846|61030\nCartosio|AL|B847|15015\nCartura|PD|B848|35025\nCarugate|MI|B850|20061\nCarugo|CO|B851|22060\nCarunchio|CH|B853|66050\nCarvico|BG|B854|24030\nCarzano|TN|B856|38050\nCasabona|KR|B857|88822\nCasacalenda|CB|B858|86043\nCasacanditella|CH|B859|66010\nCasagiove|CE|B860|81022\nCasal Cermelli|AL|B870|15072\nCasal di Principe|CE|B872|81033\nCasal Velino|SA|B895|84040\nCasalanguida|CH|B861|66031\nCasalattico|FR|B862|03030\nCasalbeltrame|NO|B864|28060\nCasalbordino|CH|B865|66021\nCasalbore|AV|B866|83034\nCasalborgone|TO|B867|10020\nCasalbuono|SA|B868|84030\nCasalbuttano ed Uniti|CR|B869|26011\nCasalciprano|CB|B871|86010\nCasalduni|BN|B873|82027\nCasale Corte Cerro|VB|B876|28881\nCasale Cremasco-Vidolasco|CR|B881|26010\nCasale di Scodosia|PD|B877|35040\nCasale Litta|VA|B875|21020\nCasale Marittimo|PI|B878|56040\nCasale Monferrato|AL|B885|15033\nCasale sul Sile|TV|B879|31032\nCasalecchio di Reno|BO|B880|40033\nCasaleggio Boiro|AL|B882|15070\nCasaleggio Novara|NO|B883|28060\nCasaleone|VR|B886|37052\nCasaletto Ceredano|CR|B889|26010\nCasaletto di Sopra|CR|B890|26014\nCasaletto Lodigiano|LO|B887|26852\nCasaletto Spartano|SA|B888|84030\nCasaletto Vaprio|CR|B891|26010\nCasalfiumanese|BO|B892|40020\nCasalgrande|RE|B893|42013\nCasalgrasso|CN|B894|12030\nCasali del Manco|CS|M385|87059\nCasalincontrada|CH|B896|66012\nCasalino|NO|B897|28060\nCasalmaggiore|CR|B898|26041\nCasalmaiocco|LO|B899|26831\nCasalmorano|CR|B900|26020\nCasalmoro|MN|B901|46040\nCasalnoceto|AL|B902|15052\nCasalnuovo di Napoli|NA|B905|80013\nCasalnuovo Monterotaro|FG|B904|71033\nCasaloldo|MN|B907|46040\nCasalpusterlengo|LO|B910|26841\nCasalromano|MN|B911|46040\nCasalserugo|PD|B912|35020\nCasaluce|CE|B916|81030\nCasalvecchio di Puglia|FG|B917|71030\nCasalvecchio Siculo|ME|B918|98032\nCasalvieri|FR|B919|03034\nCasalvolone|NO|B920|28060\nCasalzuigno|VA|B921|21030\nCasamarciano|NA|B922|80032\nCasamassima|BA|B923|70010\nCasamicciola Terme|NA|B924|80074\nCasandrino|NA|B925|80025\nCasanova Elvo|VC|B928|13030\nCasanova Lerrone|SV|B927|17033\nCasanova Lonati|PV|B929|27041\nCasape|RM|B932|00010\nCasapesenna|CE|M260|81030\nCasapinta|BI|B933|13866\nCasaprota|RI|B934|02030\nCasapulla|CE|B935|81020\nCasarano|LE|B936|73042\nCasargo|LC|B937|23831\nCasarile|MI|B938|20080\nCasarsa della Delizia|PN|B940|33072\nCasarza Ligure|GE|B939|16030\nCasasco|AL|B941|15050\nCasatenovo|LC|B943|23880\nCasatisma|PV|B945|27040\nCasavatore|NA|B946|80020\nCasazza|BG|B947|24060\nCascia|PG|B948|06043\nCasciago|VA|B949|21020\nCasciana Terme Lari|PI|M327|56035\nCascina|PI|B950|56021\nCascinette d'Ivrea|TO|B953|10010\nCasei Gerola|PV|B954|27050\nCaselette|TO|B955|10040\nCasella|GE|B956|16015\nCaselle in Pittari|SA|B959|84030\nCaselle Landi|LO|B961|26842\nCaselle Lurani|LO|B958|26853\nCaselle Torinese|TO|B960|10072\nCaserta|CE|B963|81100\nCasier|TV|B965|31030\nCasignana|RC|B966|89030\nCasina|RE|B967|42034\nCasirate d'Adda|BG|B971|24040\nCaslino d'Erba|CO|B974|22030\nCasnate con Bernate|CO|B977|22070\nCasnigo|BG|B978|24020\nCasola di Napoli|NA|B980|80050\nCasola in Lunigiana|MS|B979|54014\nCasola Valsenio|RA|B982|48032\nCasole d'Elsa|SI|B984|53031\nCasoli|CH|B985|66043\nCasorate Primo|PV|B988|27022\nCasorate Sempione|VA|B987|21011\nCasorezzo|MI|B989|20010\nCasoria|NA|B990|80026\nCasorzo|AT|B991|14032\nCasperia|RI|A472|02041\nCaspoggio|SO|B993|23020\nCassacco|UD|B994|33010\nCassago Brianza|LC|B996|23893\nCassano all'Ionio|CS|C002|87011\nCassano d'Adda|MI|C003|20062\nCassano delle Murge|BA|B998|70020\nCassano Irpino|AV|B997|83040\nCassano Magnago|VA|C004|21012\nCassano Spinola|AL|M388|15063\nCassano Valcuvia|VA|B999|21030\nCassaro|SR|C006|96010\nCassiglio|BG|C007|24010\nCassina de' Pecchi|MI|C014|20060\nCassina Rizzardi|CO|C020|22070\nCassina Valsassina|LC|C024|23817\nCassinasco|AT|C022|14050\nCassine|AL|C027|15016\nCassinelle|AL|C030|15070\nCassinetta di Lugagnano|MI|C033|20081\nCassino|FR|C034|03043\nCassola|VI|C037|36022\nCassolnovo|PV|C038|27023\nCastagnaro|VR|C041|37043\nCastagneto Carducci|LI|C044|57022\nCastagneto Po|TO|C045|10090\nCastagnito|CN|C046|12050\nCastagnole delle Lanze|AT|C049|14054\nCastagnole Monferrato|AT|C047|14030\nCastagnole Piemonte|TO|C048|10060\nCastana|PV|C050|27040\nCastano Primo|MI|C052|20022\nCasteggio|PV|C053|27045\nCastegnato|BS|C055|25045\nCastegnero|VI|C056|36020\nCastel Baronia|AV|C058|83040\nCastel Boglione|AT|C064|14040\nCastel Bolognese|RA|C065|48014\nCastel Campagnano|CE|B494|81010\nCastel Castagna|TE|C040|64030\nCastel Condino|TN|C183|38082\nCastel d'Aiano|BO|C075|40034\nCastel d'Ario|MN|C076|46033\nCastel d'Azzano|VR|C078|37060\nCastel del Giudice|IS|C082|86080\nCastel del Monte|AQ|C083|67023\nCastel del Piano|GR|C085|58033\nCastel del Rio|BO|C086|40022\nCastel di Casio|BO|B969|40030\nCastel di Ieri|AQ|C090|67020\nCastel di Iudica|CT|C091|95040\nCastel di Lama|AP|C093|63082\nCastel di Lucio|ME|C094|98070\nCastel di Sangro|AQ|C096|67031\nCastel di Sasso|CE|C097|81040\nCastel di Tora|RI|C098|02020\nCastel Focognano|AR|C102|52016\nCastel Frentano|CH|C114|66032\nCastel Gabbiano|CR|C115|26010\nCastel Gandolfo|RM|C116|00073\nCastel Giorgio|TR|C117|05013\nCastel Goffredo|MN|C118|46042\nCastel Guelfo di Bologna|BO|C121|40023\nCastel Ivano|TN|M354|38059\nCastel Madama|RM|C203|00024\nCastel Maggiore|BO|C204|40013\nCastel Mella|BS|C208|25030\nCastel Morrone|CE|C211|81020\nCastel Ritaldi|PG|C252|06044\nCastel Rocchero|AT|C253|14044\nCastel Rozzone|BG|C255|24040\nCastel San Giorgio|SA|C259|84083\nCastel San Giovanni|PC|C261|29015\nCastel San Lorenzo|SA|C262|84049\nCastel San Niccolò|AR|C263|52018\nCastel San Pietro Romano|RM|C266|00030\nCastel San Pietro Terme|BO|C265|40024\nCastel San Vincenzo|IS|C270|86071\nCastel Sant'Angelo|RI|C268|02010\nCastel Sant'Elia|VT|C269|01030\nCastel Viscardo|TR|C289|05014\nCastel Vittorio|IM|C110|18030\nCastel Volturno|CE|C291|81030\nCastelbaldo|PD|C057|35040\nCastelbelforte|MN|C059|46032\nCastelbellino|AN|C060|60030\nCastelbello-Ciardes|BZ|C062|39020\nCastelbianco|SV|C063|17030\nCastelbottaccio|CB|C066|86030\nCastelbuono|PA|C067|90013\nCastelcivita|SA|C069|84020\nCastelcovati|BS|C072|25030\nCastelcucco|TV|C073|31030\nCasteldaccia|PA|C074|90014\nCasteldelci|RN|C080|47861\nCasteldelfino|CN|C081|12020\nCasteldidone|CR|C089|26030\nCastelfidardo|AN|C100|60022\nCastelfiorentino|FI|C101|50051\nCastelforte|LT|C104|04021\nCastelfranci|AV|C105|83040\nCastelfranco di Sotto|PI|C113|56022\nCastelfranco Emilia|MO|C107|41013\nCastelfranco in Miscano|BN|C106|82022\nCastelfranco Piandiscò|AR|M322|52026\nCastelfranco Veneto|TV|C111|31033\nCastelgerundo|LO|M393|26844\nCastelgomberto|VI|C119|36070\nCastelgrande|PZ|C120|85050\nCastelguglielmo|RO|C122|45020\nCastelguidone|CH|C123|66040\nCastell'Alfero|AT|C127|14033\nCastell'Arquato|PC|C145|29014\nCastell'Azzara|GR|C147|58034\nCastell'Umberto|ME|C051|98070\nCastellabate|SA|C125|84048\nCastellafiume|AQ|C126|67050\nCastellalto|TE|C128|64020\nCastellammare del Golfo|TP|C130|91014\nCastellammare di Stabia|NA|C129|80053\nCastellamonte|TO|C133|10081\nCastellana Grotte|BA|C134|70013\nCastellana Sicula|PA|C135|90020\nCastellaneta|TA|C136|74011\nCastellania Coppi|AL|C137|15051\nCastellanza|VA|C139|21053\nCastellar Guidobono|AL|C142|15050\nCastellarano|RE|C141|42014\nCastellaro|IM|C143|18011\nCastellazzo Bormida|AL|C148|15073\nCastellazzo Novarese|NO|C149|28060\nCastelleone di Suasa|AN|C152|60010\nCastelleone|CR|C153|26012\nCastellero|AT|C154|14013\nCastelletto Cervo|BI|C155|13851\nCastelletto d'Erro|AL|C156|15010\nCastelletto d'Orba|AL|C158|15060\nCastelletto di Branduzzo|PV|C157|27040\nCastelletto Merli|AL|C160|15020\nCastelletto Molina|AT|C161|14040\nCastelletto Monferrato|AL|C162|15040\nCastelletto sopra Ticino|NO|C166|28053\nCastelletto Stura|CN|C165|12040\nCastelletto Uzzone|CN|C167|12070\nCastelli Calepio|BG|C079|24060\nCastelli|TE|C169|64041\nCastellina in Chianti|SI|C172|53011\nCastellina Marittima|PI|C174|56040\nCastellinaldo d'Alba|CN|C173|12050\nCastellino del Biferno|CB|C175|86020\nCastellino Tanaro|CN|C176|12060\nCastelliri|FR|C177|03030\nCastello Cabiaglio|VA|B312|21030\nCastello d'Agogna|PV|C184|27030\nCastello d'Argile|BO|C185|40050\nCastello del Matese|CE|C178|81016\nCastello dell'Acqua|SO|C186|23030\nCastello di Annone|AT|A300|14034\nCastello di Brianza|LC|C187|23884\nCastello di Cisterna|NA|C188|80030\nCastello di Godego|TV|C190|31030\nCastello Tesino|TN|C194|38053\nCastello-Molina di Fiemme|TN|C189|38030\nCastellucchio|MN|C195|46014\nCastelluccio dei Sauri|FG|C198|71025\nCastelluccio Inferiore|PZ|C199|85040\nCastelluccio Superiore|PZ|C201|85040\nCastelluccio Valmaggiore|FG|C202|71020\nCastelmagno|CN|C205|12020\nCastelmarte|CO|C206|22030\nCastelmassa|RO|C207|45035\nCastelmauro|CB|C197|86031\nCastelmezzano|PZ|C209|85010\nCastelmola|ME|C210|98030\nCastelnovetto|PV|C213|27030\nCastelnovo Bariano|RO|C215|45030\nCastelnovo del Friuli|PN|C217|33090\nCastelnovo di Sotto|RE|C218|42024\nCastelnovo ne' Monti|RE|C219|42035\nCastelnuovo Belbo|AT|C226|14043\nCastelnuovo Berardenga|SI|C227|53019\nCastelnuovo Bocca d'Adda|LO|C228|26843\nCastelnuovo Bormida|AL|C229|15017\nCastelnuovo Bozzente|CO|C220|22070\nCastelnuovo Calcea|AT|C230|14040\nCastelnuovo Cilento|SA|C231|84040\nCastelnuovo del Garda|VR|C225|37014\nCastelnuovo della Daunia|FG|C222|71034\nCastelnuovo di Ceva|CN|C214|12070\nCastelnuovo di Conza|SA|C235|84020\nCastelnuovo di Farfa|RI|C224|02031\nCastelnuovo di Garfagnana|LU|C236|55032\nCastelnuovo di Porto|RM|C237|00060\nCastelnuovo di Val di Cecina|PI|C244|56041\nCastelnuovo Don Bosco|AT|C232|14022\nCastelnuovo Magra|SP|C240|19033\nCastelnuovo Nigra|TO|C241|10080\nCastelnuovo Parano|FR|C223|03040\nCastelnuovo Rangone|MO|C242|41051\nCastelnuovo Scrivia|AL|C243|15053\nCastelnuovo|TN|C216|38050\nCastelpagano|BN|C245|82024\nCastelpetroso|IS|C246|86090\nCastelpizzuto|IS|C247|86090\nCastelplanio|AN|C248|60031\nCastelpoto|BN|C250|82030\nCastelraimondo|MC|C251|62022\nCastelrotto|BZ|C254|39040\nCastelsantangelo sul Nera|MC|C267|62039\nCastelsaraceno|PZ|C271|85031\nCastelsardo|SS|C272|07031\nCastelseprio|VA|C273|21050\nCastelsilano|KR|B968|88834\nCastelspina|AL|C274|15070\nCasteltermini|AG|C275|92025\nCastelveccana|VA|C181|21010\nCastelvecchio Calvisio|AQ|C278|67020\nCastelvecchio di Rocca Barbena|SV|C276|17034\nCastelvecchio Subequo|AQ|C279|67024\nCastelvenere|BN|C280|82037\nCastelverde|CR|B129|26022\nCastelverrino|IS|C200|86080\nCastelvetere in Val Fortore|BN|C284|82023\nCastelvetere sul Calore|AV|C283|83040\nCastelvetrano|TP|C286|91022\nCastelvetro di Modena|MO|C287|41014\nCastelvetro Piacentino|PC|C288|29010\nCastelvisconti|CR|C290|26010\nCastenaso|BO|C292|40055\nCastenedolo|BS|C293|25014\nCastiadas|SU|M288|09040\nCastiglion Fibocchi|AR|C318|52029\nCastiglion Fiorentino|AR|C319|52043\nCastiglione a Casauria|PE|C308|65020\nCastiglione Chiavarese|GE|C302|16030\nCastiglione Cosentino|CS|C301|87040\nCastiglione d'Adda|LO|C304|26823\nCastiglione d'Orcia|SI|C313|53023\nCastiglione dei Pepoli|BO|C296|40035\nCastiglione del Genovesi|SA|C306|84090\nCastiglione del Lago|PG|C309|06061\nCastiglione della Pescaia|GR|C310|58043\nCastiglione delle Stiviere|MN|C312|46043\nCastiglione di Garfagnana|LU|C303|55033\nCastiglione di Sicilia|CT|C297|95012\nCastiglione Falletto|CN|C314|12060\nCastiglione in Teverina|VT|C315|01024\nCastiglione Messer Marino|CH|C298|66033\nCastiglione Messer Raimondo|TE|C316|64034\nCastiglione Olona|VA|C300|21043\nCastiglione Tinella|CN|C317|12053\nCastiglione Torinese|TO|C307|10090\nCastignano|AP|C321|63072\nCastilenti|TE|C322|64035\nCastino|CN|C323|12050\nCastione Andevenno|SO|C325|23012\nCastione della Presolana|BG|C324|24020\nCastions di Strada|UD|C327|33050\nCastiraga Vidardo|LO|C329|26866\nCasto|BS|C330|25070\nCastorano|AP|C331|63081\nCastrezzato|BS|C332|25030\nCastri di Lecce|LE|C334|73020\nCastrignano de' Greci|LE|C335|73020\nCastrignano del Capo|LE|C336|73040\nCastro dei Volsci|FR|C338|03020\nCastro|BG|C337|24063\nCastro|LE|M261|73030\nCastrocaro Terme e Terra del Sole|FC|C339|47011\nCastrocielo|FR|C340|03030\nCastrofilippo|AG|C341|92020\nCastrolibero|CS|C108|87040\nCastronno|VA|C343|21040\nCastronovo di Sicilia|PA|C344|90030\nCastronuovo di Sant'Andrea|PZ|C345|85030\nCastropignano|CB|C346|86010\nCastroreale|ME|C347|98053\nCastroregio|CS|C348|87070\nCastrovillari|CS|C349|87012\nCatania|CT|C351|95121-95131\nCatanzaro|CZ|C352|88100\nCatenanuova|EN|C353|94010\nCatignano|PE|C354|65011\nCattolica Eraclea|AG|C356|92011\nCattolica|RN|C357|47841\nCaulonia|RC|C285|89041\nCautano|BN|C359|82030\nCava de' Tirreni|SA|C361|84013\nCava Manara|PV|C360|27051\nCavaglià|BI|C363|13881\nCavaglietto|NO|C364|28010\nCavaglio d'Agogna|NO|C365|28010\nCavagnolo|TO|C369|10020\nCavaion Veronese|VR|C370|37010\nCavalese|TN|C372|38033\nCavallerleone|CN|C375|12030\nCavallermaggiore|CN|C376|12030\nCavallino-Treporti|VE|M308|30013\nCavallino|LE|C377|73020\nCavallirio|NO|C378|28010\nCavareno|TN|C380|38011\nCavargna|CO|C381|22010\nCavaria con Premezzo|VA|C382|21044\nCavarzere|VE|C383|30014\nCavaso del Tomba|TV|C384|31034\nCavasso Nuovo|PN|C385|33092\nCavatore|AL|C387|15010\nCavazzo Carnico|UD|C389|33020\nCave|RM|C390|00033\nCavedago|TN|C392|38010\nCavedine|TN|C393|38073\nCavenago d'Adda|LO|C394|26824\nCavenago di Brianza|MB|C395|20873\nCavernago|BG|C396|24050\nCavezzo|MO|C398|41032\nCavizzana|TN|C400|38022\nCavour|TO|C404|10061\nCavriago|RE|C405|42025\nCavriana|MN|C406|46040\nCavriglia|AR|C407|52022\nCazzago Brabbia|VA|C409|21020\nCazzago San Martino|BS|C408|25046\nCazzano di Tramigna|VR|C412|37030\nCazzano Sant'Andrea|BG|C410|24026\nCeccano|FR|C413|03023\nCecima|PV|C414|27050\nCecina|LI|C415|57023\nCedegolo|BS|C417|25051\nCedrasco|SO|C418|23010\nCefalà Diana|PA|C420|90030\nCefalù|PA|C421|90015\nCeggia|VE|C422|30022\nCeglie Messapica|BR|C424|72013\nCelano|AQ|C426|67043\nCelenza sul Trigno|CH|C428|66050\nCelenza Valfortore|FG|C429|71035\nCelico|CS|C430|87053\nCella Dati|CR|C435|26040\nCella Monte|AL|C432|15034\nCellamare|BA|C436|70010\nCellara|CS|C437|87050\nCellarengo|AT|C438|14010\nCellatica|BS|C439|25060\nCelle di Bulgheria|SA|C444|84040\nCelle di Macra|CN|C441|12020\nCelle di San Vito|FG|C442|71020\nCelle Enomondo|AT|C440|14010\nCelle Ligure|SV|C443|17015\nCelleno|VT|C446|01020\nCellere|VT|C447|01010\nCellino Attanasio|TE|C449|64036\nCellino San Marco|BR|C448|72020\nCellio con Breia|VC|M398|13024\nCellole|CE|M262|81030\nCembra Lisignago|TN|M355|38034\nCenadi|CZ|C453|88067\nCenate Sopra|BG|C456|24060\nCenate Sotto|BG|C457|24069\nCencenighe Agordino|BL|C458|32020\nCene|BG|C459|24020\nCeneselli|RO|C461|45030\nCengio|SV|C463|17056\nCentallo|CN|C466|12044\nCento|FE|C469|44042\nCentola|SA|C470|84051\nCentrache|CZ|C472|88067\nCentro Valle Intelvi|CO|M394|22023\nCenturipe|EN|C471|94010\nCepagatti|PE|C474|65012\nCeppaloni|BN|C476|82014\nCeppo Morelli|VB|C478|28875\nCeprano|FR|C479|03024\nCerami|EN|C480|94010\nCeranesi|GE|C481|16014\nCerano d'Intelvi|CO|C482|22020\nCerano|NO|C483|28065\nCeranova|PV|C484|27010\nCeraso|SA|C485|84052\nCercemaggiore|CB|C486|86012\nCercenasco|TO|C487|10060\nCercepiccola|CB|C488|86010\nCerchiara di Calabria|CS|C489|87070\nCerchio|AQ|C492|67044\nCercino|SO|C493|23016\nCercivento|UD|C494|33020\nCercola|NA|C495|80040\nCerda|PA|C496|90010\nCerea|VR|C498|37053\nCeregnano|RO|C500|45010\nCerenzia|KR|C501|88833\nCeres|TO|C497|10070\nCeresara|MN|C502|46040\nCereseto|AL|C503|15020\nCeresole Alba|CN|C504|12040\nCeresole Reale|TO|C505|10080\nCerete|BG|C506|24020\nCeretto Lomellina|PV|C508|27030\nCergnago|PV|C509|27020\nCeriale|SV|C510|17023\nCeriana|IM|C511|18034\nCeriano Laghetto|MB|C512|20816\nCerignale|PC|C513|29020\nCerignola|FG|C514|71042\nCerisano|CS|C515|87044\nCermenate|CO|C516|22072\nCermes|BZ|A022|39010\nCermignano|TE|C517|64037\nCernobbio|CO|C520|22012\nCernusco Lombardone|LC|C521|23870\nCernusco sul Naviglio|MI|C523|20063\nCerreto d'Asti|AT|C528|14020\nCerreto d'Esi|AN|C524|60043\nCerreto di Spoleto|PG|C527|06041\nCerreto Grue|AL|C507|15050\nCerreto Guidi|FI|C529|50050\nCerreto Laziale|RM|C518|00020\nCerreto Sannita|BN|C525|82032\nCerretto Langhe|CN|C530|12050\nCerrina Monferrato|AL|C531|15020\nCerrione|BI|C532|13882\nCerro al Lambro|MI|C536|20070\nCerro al Volturno|IS|C534|86072\nCerro Maggiore|MI|C537|20023\nCerro Tanaro|AT|C533|14030\nCerro Veronese|VR|C538|37020\nCersosimo|PZ|C539|85030\nCertaldo|FI|C540|50052\nCertosa di Pavia|PV|C541|27012\nCerva|CZ|C542|88050\nCervara di Roma|RM|C543|00020\nCervarese Santa Croce|PD|C544|35030\nCervaro|FR|C545|03044\nCervasca|CN|C547|12010\nCervatto|VC|C548|13025\nCerveno|BS|C549|25040\nCervere|CN|C550|12040\nCervesina|PV|C551|27050\nCerveteri|RM|C552|00052\nCervia|RA|C553|48015\nCervicati|CS|C554|87010\nCervignano d'Adda|LO|C555|26832\nCervignano del Friuli|UD|C556|33052\nCervinara|AV|C557|83012\nCervino|CE|C558|81023\nCervo|IM|C559|18010\nCerzeto|CS|C560|87040\nCesa|CE|C561|81030\nCesana Brianza|LC|C563|23861\nCesana Torinese|TO|C564|10054\nCesano Boscone|MI|C565|20090\nCesano Maderno|MB|C566|20811\nCesara|VB|C567|28891\nCesarò|ME|C568|98033\nCesate|MI|C569|20020\nCesena|FC|C573|47521-47522\nCesenatico|FC|C574|47042\nCesinali|AV|C576|83020\nCesio|IM|C578|18022\nCesiomaggiore|BL|C577|32030\nCessalto|TV|C580|31040\nCessaniti|VV|C581|89816\nCessapalombo|MC|C582|62020\nCessole|AT|C583|14050\nCetara|SA|C584|84010\nCeto|BS|C585|25040\nCetona|SI|C587|53040\nCetraro|CS|C588|87022\nCeva|CN|C589|12073\nCevo|BS|C591|25040\nChalland-Saint-Anselme|AO|C593|11020\nChalland-Saint-Victor|AO|C594|11020\nChambave|AO|C595|11023\nChamois|AO|B491|11020\nChampdepraz|AO|C596|11020\nChamporcher|AO|B540|11020\nCharvensod|AO|C598|11020\nChâtillon|AO|C294|11024\nCherasco|CN|C599|12062\nCheremule|SS|C600|07040\nChialamberto|TO|C604|10070\nChiampo|VI|C605|36072\nChianche|AV|C606|83010\nChianciano Terme|SI|C608|53042\nChianni|PI|C609|56034\nChianocco|TO|C610|10050\nChiaramonte Gulfi|RG|C612|97012\nChiaramonti|SS|C613|07030\nChiarano|TV|C614|31040\nChiaravalle Centrale|CZ|C616|88064\nChiaravalle|AN|C615|60033\nChiari|BS|C618|25032\nChiaromonte|PZ|C619|85032\nChiauci|IS|C620|86097\nChiavari|GE|C621|16043\nChiavenna|SO|C623|23022\nChiaverano|TO|C624|10010\nChienes|BZ|C625|39030\nChieri|TO|C627|10023\nChies d'Alpago|BL|C630|32010\nChiesa in Valmalenco|SO|C628|23023\nChiesanuova|TO|C629|10080\nChiesina Uzzanese|PT|C631|51013\nChieti|CH|C632|66100\nChieuti|FG|C633|71010\nChieve|CR|C634|26010\nChignolo d'Isola|BG|C635|24040\nChignolo Po|PV|C637|27013\nChioggia|VE|C638|30015\nChiomonte|TO|C639|10050\nChions|PN|C640|33083\nChiopris-Viscone|UD|C641|33048\nChitignano|AR|C648|52010\nChiuduno|BG|C649|24060\nChiuppano|VI|C650|36010\nChiuro|SO|C651|23030\nChiusa di Pesio|CN|C653|12013\nChiusa di San Michele|TO|C655|10050\nChiusa Sclafani|PA|C654|90033\nChiusa|BZ|C652|39043\nChiusaforte|UD|C656|33010\nChiusanico|IM|C657|18027\nChiusano d'Asti|AT|C658|14025\nChiusano di San Domenico|AV|C659|83040\nChiusavecchia|IM|C660|18027\nChiusdino|SI|C661|53012\nChiusi della Verna|AR|C663|52010\nChiusi|SI|C662|53043\nChivasso|TO|C665|10034\nCiampino|RM|M272|00043\nCianciana|AG|C668|92012\nCibiana di Cadore|BL|C672|32040\nCicagna|GE|C673|16044\nCicala|CZ|C674|88040\nCicciano|NA|C675|80033\nCicerale|SA|C676|84053\nCiciliano|RM|C677|00020\nCicognolo|CR|C678|26030\nCiconio|TO|C679|10080\nCigliano|VC|C680|13043\nCigliè|CN|C681|12060\nCigognola|PV|C684|27040\nCigole|BS|C685|25020\nCilavegna|PV|C686|27024\nCimadolmo|TV|C689|31010\nCimbergo|BS|C691|25050\nCiminà|RC|C695|89040\nCiminna|PA|C696|90023\nCimitile|NA|C697|80030\nCimolais|PN|C699|33080\nCimone|TN|C700|38060\nCinaglio|AT|C701|14020\nCineto Romano|RM|C702|00020\nCingia de' Botti|CR|C703|26042\nCingoli|MC|C704|62011\nCinigiano|GR|C705|58044\nCinisello Balsamo|MI|C707|20092\nCinisi|PA|C708|90045\nCino|SO|C709|23010\nCinquefrondi|RC|C710|89021\nCintano|TO|C711|10080\nCinte Tesino|TN|C712|38050\nCinto Caomaggiore|VE|C714|30020\nCinto Euganeo|PD|C713|35030\nCinzano|TO|C715|10090\nCiorlano|CE|C716|81010\nCipressa|IM|C718|18017\nCircello|BN|C719|82020\nCiriè|TO|C722|10073\nCirigliano|MT|C723|75010\nCirimido|CO|C724|22070\nCirò Marina|KR|C726|88811\nCirò|KR|C725|88813\nCis|TN|C727|38020\nCisano Bergamasco|BG|C728|24034\nCisano sul Neva|SV|C729|17035\nCiserano|BG|C730|24040\nCislago|VA|C732|21040\nCisliano|MI|C733|20080\nCison di Valmarino|TV|C735|31030\nCissone|CN|C738|12050\nCisterna d'Asti|AT|C739|14010\nCisterna di Latina|LT|C740|04012\nCisternino|BR|C741|72014\nCiterna|PG|C742|06010\nCittà della Pieve|PG|C744|06062\nCittà di Castello|PG|C745|06012\nCittà Sant'Angelo|PE|C750|65013\nCittadella|PD|C743|35013\nCittaducale|RI|C746|02015\nCittanova|RC|C747|89022\nCittareale|RI|C749|02010\nCittiglio|VA|C751|21033\nCivate|LC|C752|23862\nCivezza|IM|C755|18017\nCivezzano|TN|C756|38045\nCiviasco|VC|C757|13010\nCividale del Friuli|UD|C758|33043\nCividate al Piano|BG|C759|24050\nCividate Camuno|BS|C760|25040\nCivita Castellana|VT|C765|01033\nCivita d'Antino|AQ|C766|67050\nCivita|CS|C763|87010\nCivitacampomarano|CB|C764|86030\nCivitaluparella|CH|C768|66040\nCivitanova del Sannio|IS|C769|86094\nCivitanova Marche|MC|C770|62012\nCivitaquana|PE|C771|65010\nCivitavecchia|RM|C773|00053\nCivitella Alfedena|AQ|C778|67030\nCivitella Casanova|PE|C779|65010\nCivitella d'Agliano|VT|C780|01020\nCivitella del Tronto|TE|C781|64010\nCivitella di Romagna|FC|C777|47012\nCivitella in Val di Chiana|AR|C774|52041\nCivitella Messer Raimondo|CH|C776|66010\nCivitella Paganico|GR|C782|58045\nCivitella Roveto|AQ|C783|67054\nCivitella San Paolo|RM|C784|00060\nCivo|SO|C785|23010\nClaino con Osteno|CO|C787|22010\nClaut|PN|C790|33080\nClauzetto|PN|C791|33090\nClavesana|CN|C792|12060\nClaviere|TO|C793|10050\nCles|TN|C794|38023\nCleto|CS|C795|87030\nClivio|VA|C796|21050\nClusone|BG|C800|24023\nCoassolo Torinese|TO|C801|10070\nCoazze|TO|C803|10050\nCoazzolo|AT|C804|14054\nCoccaglio|BS|C806|25030\nCocconato|AT|C807|14023\nCocquio-Trevisago|VA|C810|21034\nCocullo|AQ|C811|67030\nCodevigo|PD|C812|35020\nCodevilla|PV|C813|27050\nCodigoro|FE|C814|44021\nCodognè|TV|C815|31013\nCodogno|LO|C816|26845\nCodroipo|UD|C817|33033\nCodrongianos|SS|C818|07040\nCoggiola|BI|C819|13863\nCogliate|MB|C820|20815\nCogne|AO|C821|11012\nCogoleto|GE|C823|16016\nCogollo del Cengio|VI|C824|36010\nCogorno|GE|C826|16030\nColazza|NO|C829|28010\nColceresa|VI|M426|36064\nColere|BG|C835|24020\nColfelice|FR|C836|03030\nColi|PC|C838|29020\nColico|LC|C839|23823\nCollalto Sabino|RI|C841|02022\nCollarmele|AQ|C844|67040\nCollazzone|PG|C845|06050\nColle Brianza|LC|C851|23886\nColle d'Anchise|CB|C854|86020\nColle di Tora|RI|C857|02020\nColle di Val d'Elsa|SI|C847|53034\nColle San Magno|FR|C870|03030\nColle Sannita|BN|C846|82024\nColle Santa Lucia|BL|C872|32020\nColle Umberto|TV|C848|31014\nCollebeato|BS|C850|25060\nCollecchio|PR|C852|43044\nCollecorvino|PE|C853|65010\nColledara|TE|C311|64042\nColledimacine|CH|C855|66010\nColledimezzo|CH|C856|66040\nColleferro|RM|C858|00034\nCollegiove|RI|C859|02020\nCollegno|TO|C860|10093\nCollelongo|AQ|C862|67050\nCollepardo|FR|C864|03010\nCollepasso|LE|C865|73040\nCollepietro|AQ|C866|67020\nColleretto Castelnuovo|TO|C867|10080\nColleretto Giacosa|TO|C868|10010\nCollesalvetti|LI|C869|57014\nCollesano|PA|C871|90016\nColletorto|CB|C875|86044\nCollevecchio|RI|C876|02042\nColli a Volturno|IS|C878|86073\nColli al Metauro|PU|M380|61036\nColli del Tronto|AP|C877|63079\nColli sul Velino|RI|C880|02010\nColli Verdi|PV|M419|27061\nColliano|SA|C879|84020\nCollinas|SU|C882|09020\nCollio|BS|C883|25060\nCollobiano|VC|C884|13030\nColloredo di Monte Albano|UD|C885|33010\nColmurano|MC|C886|62020\nColobraro|MT|C888|75021\nCologna Veneta|VR|C890|37044\nCologne|BS|C893|25033\nCologno al Serio|BG|C894|24055\nCologno Monzese|MI|C895|20093\nColognola ai Colli|VR|C897|37030\nColonna|RM|C900|00030\nColonnella|TE|C901|64010\nColonno|CO|C902|22010\nColorina|SO|C903|23010\nColorno|PR|C904|43052\nColosimi|CS|C905|87050\nColturano|MI|C908|20060\nColverde|CO|M336|22041\nColzate|BG|C910|24020\nComabbio|VA|C911|21020\nComacchio|FE|C912|44022\nComano Terme|TN|M314|38077\nComano|MS|C914|54015\nComazzo|LO|C917|26833\nComeglians|UD|C918|33023\nComelico Superiore|BL|C920|32040\nComerio|VA|C922|21025\nComezzano-Cizzago|BS|C925|25030\nComignago|NO|C926|28060\nComiso|RG|C927|97013\nComitini|AG|C928|92020\nComiziano|NA|C929|80030\nCommessaggio|MN|C930|46010\nCommezzadura|TN|C931|38020\nComo|CO|C933|22100\nCompiano|PR|C934|43053\nComun Nuovo|BG|C937|24040\nComunanza|AP|C935|63087\nCona|VE|C938|30010\nConca Casale|IS|C941|86070\nConca dei Marini|SA|C940|84010\nConca della Campania|CE|C939|81044\nConcamarise|VR|C943|37050\nConcerviano|RI|C946|02020\nConcesio|BS|C948|25062\nConcordia Sagittaria|VE|C950|30023\nConcordia sulla Secchia|MO|C951|41033\nConcorezzo|MB|C952|20863\nCondofuri|RC|C954|89030\nCondove|TO|C955|10055\nCondrò|ME|C956|98040\nConegliano|TV|C957|31015\nConfienza|PV|C958|27030\nConfigni|RI|C959|02040\nConflenti|CZ|C960|88040\nConiolo|AL|C962|15030\nConselice|RA|C963|48017\nConselve|PD|C964|35026\nContà|TN|M356|38093\nContessa Entellina|PA|C968|90030\nContigliano|RI|C969|02043\nContrada|AV|C971|83020\nControguerra|TE|C972|64010\nControne|SA|C973|84020\nContursi Terme|SA|C974|84024\nConversano|BA|C975|70014\nConza della Campania|AV|C976|83040\nConzano|AL|C977|15030\nCopertino|LE|C978|73043\nCopiano|PV|C979|27010\nCopparo|FE|C980|44034\nCorana|PV|C982|27050\nCorato|BA|C983|70033\nCorbara|SA|C984|84010\nCorbetta|MI|C986|20011\nCorbola|RO|C987|45015\nCorchiano|VT|C988|01030\nCorciano|PG|C990|06073\nCordenons|PN|C991|33084\nCordignano|TV|C992|31016\nCordovado|PN|C993|33075\nCoreglia Antelminelli|LU|C996|55025\nCoreglia Ligure|GE|C995|16040\nCoreno Ausonio|FR|C998|03040\nCorfinio|AQ|C999|67030\nCori|LT|D003|04010\nCoriano|RN|D004|47853\nCorigliano d'Otranto|LE|D006|73022\nCorigliano-Rossano|CS|M403|87064\nCorinaldo|AN|D007|60013\nCorio|TO|D008|10070\nCorleone|PA|D009|90034\nCorleto Monforte|SA|D011|84020\nCorleto Perticara|PZ|D010|85012\nCormano|MI|D013|20032\nCormons|GO|D014|34071\nCorna Imagna|BG|D015|24030\nCornalba|BG|D016|24017\nCornale e Bastida|PV|M338|27056\nCornaredo|MI|D018|20010\nCornate d'Adda|MB|D019|20872\nCornedo all'Isarco|BZ|B799|39053\nCornedo Vicentino|VI|D020|36073\nCornegliano Laudense|LO|D021|26854\nCorneliano d'Alba|CN|D022|12040\nCorniglio|PR|D026|43021\nCorno di Rosazzo|UD|D027|33040\nCorno Giovine|LO|D028|26846\nCornovecchio|LO|D029|26842\nCornuda|TV|D030|31041\nCorreggio|RE|D037|42015\nCorrezzana|MB|D038|20856\nCorrezzola|PD|D040|35020\nCorrido|CO|D041|22010\nCorridonia|MC|D042|62014\nCorropoli|TE|D043|64013\nCorsano|LE|D044|73033\nCorsico|MI|D045|20094\nCorsione|AT|D046|14020\nCortaccia sulla strada del vino|BZ|D048|39040\nCortale|CZ|D049|88020\nCortandone|AT|D050|14013\nCortanze|AT|D051|14020\nCortazzone|AT|D052|14010\nCorte Brugnatella|PC|D054|29020\nCorte de' Cortesi con Cignone|CR|D056|26020\nCorte de' Frati|CR|D057|26010\nCorte Franca|BS|D058|25040\nCorte Palasio|LO|D068|26834\nCortemaggiore|PC|D061|29016\nCortemilia|CN|D062|12074\nCorteno Golgi|BS|D064|25040\nCortenova|LC|D065|23813\nCortenuova|BG|D066|24050\nCorteolona e Genzone|PV|M372|27014\nCortiglione|AT|D072|14040\nCortina d'Ampezzo|BL|A266|32043\nCortina sulla strada del vino|BZ|D075|39040\nCortino|TE|D076|64040\nCortona|AR|D077|52044\nCorvara in Badia|BZ|D079|39033\nCorvara|PE|D078|65020\nCorvino San Quirico|PV|D081|27050\nCorzano|BS|D082|25030\nCoseano|UD|D085|33030\nCosenza|CS|D086|87100\nCosio d'Arroscia|IM|D087|18023\nCosio Valtellino|SO|D088|23013\nCosoleto|RC|D089|89050\nCossano Belbo|CN|D093|12054\nCossano Canavese|TO|D092|10010\nCossato|BI|D094|13836\nCosseria|SV|D095|17017\nCossignano|AP|D096|63067\nCossogno|VB|D099|28801\nCossoine|SS|D100|07010\nCossombrato|AT|D101|14020\nCosta de' Nobili|PV|D109|27010\nCosta di Mezzate|BG|D110|24060\nCosta di Rovigo|RO|D105|45023\nCosta Masnaga|LC|D112|23845\nCosta Serina|BG|D111|24010\nCosta Valle Imagna|BG|D103|24030\nCosta Vescovato|AL|D102|15050\nCosta Volpino|BG|D117|24062\nCostabissara|VI|D107|36030\nCostacciaro|PG|D108|06021\nCostanzana|VC|D113|13033\nCostarainera|IM|D114|18017\nCostermano sul Garda|VR|D118|37010\nCostigliole d'Asti|AT|D119|14055\nCostigliole Saluzzo|CN|D120|12024\nCotignola|RA|D121|48033\nCotronei|KR|D123|88836\nCottanello|RI|D124|02040\nCourmayeur|AO|D012|11013\nCovo|BG|D126|24050\nCozzo|PV|D127|27030\nCraco|MT|D128|75010\nCrandola Valsassina|LC|D131|23832\nCravagliana|VC|D132|13020\nCravanzana|CN|D133|12050\nCraveggia|VB|D134|28852\nCreazzo|VI|D136|36051\nCrecchio|CH|D137|66014\nCredaro|BG|D139|24060\nCredera Rubbiano|CR|D141|26010\nCrema|CR|D142|26013\nCremella|LC|D143|23894\nCremenaga|VA|D144|21030\nCremeno|LC|D145|23814\nCremia|CO|D147|22010\nCremolino|AL|D149|15010\nCremona|CR|D150|26100\nCremosano|CR|D151|26010\nCrescentino|VC|D154|13044\nCrespadoro|VI|D156|36070\nCrespiatica|LO|D159|26835\nCrespina Lorenzana|PI|M328|56042\nCrespino|RO|D161|45030\nCressa|NO|D162|28012\nCrevacuore|BI|D165|13864\nCrevalcore|BO|D166|40014\nCrevoladossola|VB|D168|28865\nCrispano|NA|D170|80020\nCrispiano|TA|D171|74012\nCrissolo|CN|D172|12030\nCrocefieschi|GE|D175|16010\nCrocetta del Montello|TV|C670|31035\nCrodo|VB|D177|28862\nCrognaleto|TE|D179|64043\nCropalati|CS|D180|87060\nCropani|CZ|D181|88051\nCrosia|CS|D184|87060\nCrosio della Valle|VA|D185|21020\nCrotone|KR|D122|88900\nCrotta d'Adda|CR|D186|26020\nCrova|VC|D187|13040\nCroviana|TN|D188|38027\nCrucoli|KR|D189|88812\nCuasso al Monte|VA|D192|21050\nCuccaro Vetere|SA|D195|84050\nCucciago|CO|D196|22060\nCuceglio|TO|D197|10090\nCuggiono|MI|D198|20012\nCugliate-Fabiasco|VA|D199|21030\nCuglieri|OR|D200|09073\nCugnoli|PE|D201|65020\nCumiana|TO|D202|10040\nCumignano sul Naviglio|CR|D203|26020\nCunardo|VA|D204|21035\nCuneo|CN|D205|12100\nCunico|AT|D207|14026\nCuorgnè|TO|D208|10082\nCupello|CH|D209|66051\nCupra Marittima|AP|D210|63064\nCupramontana|AN|D211|60034\nCura Carpignano|PV|B824|27010\nCurcuris|OR|D214|09090\nCureggio|NO|D216|28060\nCuriglia con Monteviasco|VA|D217|21010\nCuringa|CZ|D218|88022\nCurino|BI|D219|13865\nCurno|BG|D221|24035\nCuron Venosta|BZ|D222|39027\nCursi|LE|D223|73020\nCurtarolo|PD|D226|35010\nCurtatone|MN|D227|46010\nCurti|CE|D228|81040\nCusago|MI|D229|20090\nCusano Milanino|MI|D231|20095\nCusano Mutri|BN|D230|82033\nCusino|CO|D232|22010\nCusio|BG|D233|24010\nCustonaci|TP|D234|91015\nCutro|KR|D236|88842\nCutrofiano|LE|D237|73020\nCuveglio|VA|D238|21030\nCuvio|VA|D239|21030\nDairago|MI|D244|20020\nDalmine|BG|D245|24044\nDambel|TN|D246|38010\nDanta di Cadore|BL|D247|32040\nDarfo Boario Terme|BS|D251|25047\nDasà|VV|D253|89832\nDavagna|GE|D255|16022\nDaverio|VA|D256|21020\nDavoli|CZ|D257|88060\nDazio|SO|D258|23010\nDecimomannu|CA|D259|09033\nDecimoputzu|SU|D260|09010\nDecollatura|CZ|D261|88041\nDego|SV|D264|17058\nDeiva Marina|SP|D265|19013\nDelebio|SO|D266|23014\nDelia|CL|D267|93010\nDelianuova|RC|D268|89012\nDeliceto|FG|D269|71026\nDello|BS|D270|25020\nDemonte|CN|D271|12014\nDenice|AL|D272|15010\nDenno|TN|D273|38010\nDernice|AL|D277|15056\nDerovere|CR|D278|26040\nDeruta|PG|D279|06053\nDervio|LC|D280|23824\nDesana|VC|D281|13034\nDesenzano del Garda|BS|D284|25015\nDesio|MB|D286|20832\nDesulo|NU|D287|08032\nDiamante|CS|D289|87023\nDiano Arentino|IM|D293|18013\nDiano Castello|IM|D296|18013\nDiano d'Alba|CN|D291|12055\nDiano Marina|IM|D297|18013\nDiano San Pietro|IM|D298|18013\nDicomano|FI|D299|50062\nDignano|UD|D300|33030\nDimaro Folgarida|TN|M366|38025\nDinami|VV|D303|89833\nDipignano|CS|D304|87045\nDiso|LE|D305|73030\nDivignano|NO|D309|28010\nDizzasco|CO|D310|22020\nDobbiaco|BZ|D311|39034\nDoberdò del Lago|GO|D312|34070\nDogliani|CN|D314|12063\nDogliola|CH|D315|66050\nDogna|UD|D316|33010\nDolcè|VR|D317|37020\nDolceacqua|IM|D318|18035\nDolcedo|IM|D319|18020\nDolegna del Collio|GO|D321|34070\nDolianova|SU|D323|09041\nDolo|VE|D325|30031\nDolzago|LC|D327|23843\nDomanico|CS|D328|87030\nDomaso|CO|D329|22013\nDomegge di Cadore|BL|D330|32040\nDomicella|AV|D331|83020\nDomodossola|VB|D332|28845\nDomus de Maria|SU|D333|09010\nDomusnovas|SU|D334|09015\nDonato|BI|D339|13893\nDongo|CO|D341|22014\nDonnas|AO|D338|11020\nDonori|SU|D344|09040\nDorgali|NU|D345|08022\nDorio|LC|D346|23824\nDormelletto|NO|D347|28040\nDorno|PV|D348|27020\nDorzano|BI|D350|13881\nDosolo|MN|D351|46030\nDossena|BG|D352|24010\nDosso del Liro|CO|D355|22010\nDoues|AO|D356|11010\nDovadola|FC|D357|47013\nDovera|CR|D358|26010\nDozza|BO|D360|40060\nDragoni|CE|D361|81010\nDrapia|VV|D364|89862\nDrena|TN|D365|38074\nDrenchia|UD|D366|33040\nDresano|MI|D367|20070\nDro|TN|D371|38074\nDronero|CN|D372|12025\nDruento|TO|D373|10040\nDruogno|VB|D374|28853\nDualchi|NU|D376|08010\nDubino|SO|D377|23015\nDue Carrare|PD|M300|35020\nDueville|VI|D379|36031\nDugenta|BN|D380|82030\nDuino Aurisina|TS|D383|34011\nDumenza|VA|D384|21010\nDuno|VA|D385|21030\nDurazzano|BN|D386|82015\nDuronia|CB|C772|86020\nDusino San Michele|AT|D388|14010\nEboli|SA|D390|84025\nEdolo|BS|D391|25048\nEgna|BZ|D392|39044\nElice|PE|D394|65010\nElini|NU|D395|08040\nEllo|LC|D398|23848\nElmas|CA|D399|09067\nElva|CN|D401|12020\nEmarèse|AO|D402|11020\nEmpoli|FI|D403|50053\nEndine Gaiano|BG|D406|24060\nEnego|VI|D407|36052\nEnemonzo|UD|D408|33020\nEnna|EN|C342|94100\nEntracque|CN|D410|12010\nEntratico|BG|D411|24060\nEnvie|CN|D412|12030\nEpiscopia|PZ|D414|85033\nEraclea|VE|D415|30020\nErba|CO|D416|22036\nErbè|VR|D419|37060\nErbezzo|VR|D420|37020\nErbusco|BS|D421|25030\nErchie|BR|D422|72020\nErcolano|NA|H243|80056\nErice|TP|D423|91016\nErli|SV|D424|17030\nErto e Casso|PN|D426|33080\nErula|SS|M292|07030\nErve|LC|D428|23805\nEsanatoglia|MC|D429|62024\nEscalaplano|SU|D430|09051\nEscolca|SU|D431|09052\nEsine|BS|D434|25040\nEsino Lario|LC|D436|23825\nEsperia|FR|D440|03045\nEsporlatu|SS|D441|07010\nEste|PD|D442|35042\nEsterzili|SU|D443|09053\nEtroubles|AO|D444|11014\nEupilio|CO|D445|22030\nExilles|TO|D433|10050\nFabbrica Curone|AL|D447|15054\nFabbriche di Vergemoli|LU|M319|55021\nFabbrico|RE|D450|42042\nFabriano|AN|D451|60044\nFabrica di Roma|VT|D452|01034\nFabrizia|VV|D453|89823\nFabro|TR|D454|05015\nFaedis|UD|D455|33040\nFaedo Valtellino|SO|D456|23020\nFaenza|RA|D458|48018\nFaeto|FG|D459|71020\nFagagna|UD|D461|33034\nFaggeto Lario|CO|D462|22020\nFaggiano|TA|D463|74020\nFagnano Alto|AQ|D465|67020\nFagnano Castello|CS|D464|87013\nFagnano Olona|VA|D467|21054\nFai della Paganella|TN|D468|38010\nFaicchio|BN|D469|82030\nFalcade|BL|D470|32020\nFalciano del Massico|CE|D471|81030\nFalconara Albanese|CS|D473|87030\nFalconara Marittima|AN|D472|60015\nFalcone|ME|D474|98060\nFaleria|VT|D475|01030\nFalerna|CZ|D476|88042\nFalerone|FM|D477|63837\nFallo|CH|D480|66040\nFaloppio|CO|D482|22020\nFalvaterra|FR|D483|03020\nFalzes|BZ|D484|39030\nFanano|MO|D486|41021\nFanna|PN|D487|33092\nFano Adriano|TE|D489|64044\nFano|PU|D488|61032\nFara Filiorum Petri|CH|D494|66010\nFara Gera d'Adda|BG|D490|24045\nFara in Sabina|RI|D493|02032\nFara Novarese|NO|D492|28073\nFara Olivana con Sola|BG|D491|24058\nFara San Martino|CH|D495|66015\nFara Vicentino|VI|D496|36030\nFardella|PZ|D497|85034\nFarigliano|CN|D499|12060\nFarindola|PE|D501|65010\nFarini|PC|D502|29023\nFarnese|VT|D503|01010\nFarra d'Isonzo|GO|D504|34072\nFarra di Soligo|TV|D505|31010\nFasano|BR|D508|72015\nFascia|GE|D509|16020\nFauglia|PI|D510|56043\nFaule|CN|D511|12030\nFavale di Malvaro|GE|D512|16040\nFavara|AG|D514|92026\nFavignana|TP|D518|91023\nFavria|TO|D520|10083\nFeisoglio|CN|D523|12050\nFeletto|TO|D524|10080\nFelino|PR|D526|43035\nFelitto|SA|D527|84055\nFelizzano|AL|D528|15023\nFeltre|BL|D530|32032\nFenegrò|CO|D531|22070\nFenestrelle|TO|D532|10060\nFénis|AO|D537|11020\nFerentillo|TR|D538|05034\nFerentino|FR|D539|03013\nFerla|SR|D540|96010\nFermignano|PU|D541|61033\nFermo|FM|D542|63900\nFerno|VA|D543|21010\nFeroleto Antico|CZ|D544|88040\nFeroleto della Chiesa|RC|D545|89050\nFerrandina|MT|D547|75013\nFerrara di Monte Baldo|VR|D549|37020\nFerrara|FE|D548|44121-44124\nFerrazzano|CB|D550|86010\nFerrera di Varese|VA|D551|21030\nFerrera Erbognone|PV|D552|27032\nFerrere|AT|D554|14012\nFerriere|PC|D555|29024\nFerruzzano|RC|D557|89030\nFiamignano|RI|D560|02023\nFiano Romano|RM|D561|00065\nFiano|TO|D562|10070\nFiastra|MC|D564|62035\nFiavè|TN|D565|38075\nFicarazzi|PA|D567|90010\nFicarolo|RO|D568|45036\nFicarra|ME|D569|98062\nFiculle|TR|D570|05016\nFidenza|PR|B034|43036\nFiè allo Sciliar|BZ|D571|39050\nFierozzo|TN|D573|38050\nFiesco|CR|D574|26010\nFiesole|FI|D575|50014\nFiesse|BS|D576|25020\nFiesso d'Artico|VE|D578|30032\nFiesso Umbertiano|RO|D577|45024\nFigino Serenza|CO|D579|22060\nFigline e Incisa Valdarno|FI|M321|50063\nFigline Vegliaturo|CS|D582|87050\nFilacciano|RM|D586|00060\nFiladelfia|VV|D587|89814\nFilago|BG|D588|24040\nFilandari|VV|D589|89841\nFilattiera|MS|D590|54023\nFilettino|FR|D591|03010\nFiletto|CH|D592|66030\nFiliano|PZ|D593|85020\nFilighera|PV|D594|27010\nFilignano|IS|D595|86074\nFilogaso|VV|D596|89843\nFilottrano|AN|D597|60024\nFinale Emilia|MO|D599|41034\nFinale Ligure|SV|D600|17024\nFino del Monte|BG|D604|24020\nFino Mornasco|CO|D605|22073\nFiorano al Serio|BG|D606|24020\nFiorano Canavese|TO|D608|10010\nFiorano Modenese|MO|D607|41042\nFiorenzuola d'Arda|PC|D611|29017\nFirenze|FI|D612|50121-50145\nFirenzuola|FI|D613|50033\nFirmo|CS|D614|87010\nFiscaglia|FE|M323|44027\nFisciano|SA|D615|84084\nFiuggi|FR|A310|03014\nFiumalbo|MO|D617|41022\nFiumara|RC|D619|89050\nFiume Veneto|PN|D621|33080\nFiumedinisi|ME|D622|98022\nFiumefreddo Bruzio|CS|D624|87030\nFiumefreddo di Sicilia|CT|D623|95013\nFiumicello Villa Vicentina|UD|M400|33059\nFiumicino|RM|M297|00054\nFiuminata|MC|D628|62025\nFivizzano|MS|D629|54013\nFlaibano|UD|D630|33030\nFlero|BS|D634|25020\nFloresta|ME|D635|98030\nFloridia|SR|D636|96014\nFlorinas|SS|D637|07030\nFlumeri|AV|D638|83040\nFluminimaggiore|SU|D639|09010\nFlussio|OR|D640|09090\nFobello|VC|D641|13025\nFoggia|FG|D643|71121-71122\nFoglianise|BN|D644|82030\nFogliano Redipuglia|GO|D645|34070\nFoglizzo|TO|D646|10090\nFoiano della Chiana|AR|D649|52045\nFoiano di Val Fortore|BN|D650|82020\nFolgaria|TN|D651|38064\nFolignano|AP|D652|63084\nFoligno|PG|D653|06034\nFollina|TV|D654|31051\nFollo|SP|D655|19020\nFollonica|GR|D656|58022\nFombio|LO|D660|26861\nFondachelli-Fantina|ME|D661|98050\nFondi|LT|D662|04022\nFonni|NU|D665|08023\nFontainemore|AO|D666|11020\nFontana Liri|FR|D667|03035\nFontanafredda|PN|D670|33074\nFontanarosa|AV|D671|83040\nFontanelice|BO|D668|40025\nFontanella|BG|D672|24056\nFontanellato|PR|D673|43012\nFontanelle|TV|D674|31043\nFontaneto d'Agogna|NO|D675|28010\nFontanetto Po|VC|D676|13040\nFontanigorda|GE|D677|16023\nFontanile|AT|D678|14044\nFontaniva|PD|D679|35014\nFonte Nuova|RM|M309|00013\nFonte|TV|D680|31010\nFontecchio|AQ|D681|67020\nFontechiari|FR|D682|03030\nFontegreca|CE|D683|81014\nFonteno|BG|D684|24060\nFontevivo|PR|D685|43010\nFonzaso|BL|D686|32030\nFoppolo|BG|D688|24010\nForano|RI|D689|02044\nForce|AP|D691|63086\nForchia|BN|D693|82011\nForcola|SO|D694|23010\nFordongianus|OR|D695|09083\nForenza|PZ|D696|85023\nForesto Sparso|BG|D697|24060\nForgaria nel Friuli|UD|D700|33030\nForino|AV|D701|83020\nForio|NA|D702|80075\nForlì del Sannio|IS|D703|86084\nForlì|FC|D704|47121-47122\nForlimpopoli|FC|D705|47034\nFormazza|VB|D706|28863\nFormello|RM|D707|00060\nFormia|LT|D708|04023\nFormicola|CE|D709|81040\nFormigara|CR|D710|26020\nFormigine|MO|D711|41043\nFormigliana|VC|D712|13030\nFornace|TN|D714|38040\nFornelli|IS|D715|86070\nForni Avoltri|UD|D718|33020\nForni di Sopra|UD|D719|33024\nForni di Sotto|UD|D720|33020\nForno Canavese|TO|D725|10084\nFornovo di Taro|PR|D728|43045\nFornovo San Giovanni|BG|D727|24040\nForte dei Marmi|LU|D730|55042\nFortezza|BZ|D731|39045\nFortunago|PV|D732|27040\nForza d'Agrò|ME|D733|98030\nFosciandora|LU|D734|55020\nFosdinovo|MS|D735|54035\nFossa|AQ|D736|67020\nFossacesia|CH|D738|66022\nFossalta di Piave|VE|D740|30020\nFossalta di Portogruaro|VE|D741|30025\nFossalto|CB|D737|86020\nFossano|CN|D742|12045\nFossato di Vico|PG|D745|06022\nFossato Serralta|CZ|D744|88050\nFossò|VE|D748|30030\nFossombrone|PU|D749|61034\nFoza|VI|D750|36010\nFrabosa Soprana|CN|D751|12082\nFrabosa Sottana|CN|D752|12083\nFraconalto|AL|D559|15060\nFragagnano|TA|D754|74022\nFragneto l'Abate|BN|D755|82020\nFragneto Monforte|BN|D756|82020\nFraine|CH|D757|66050\nFramura|SP|D758|19014\nFrancavilla al Mare|CH|D763|66023\nFrancavilla Angitola|VV|D762|89815\nFrancavilla Bisio|AL|D759|15060\nFrancavilla d'Ete|FM|D760|63816\nFrancavilla di Sicilia|ME|D765|98034\nFrancavilla Fontana|BR|D761|72021\nFrancavilla in Sinni|PZ|D766|85034\nFrancavilla Marittima|CS|D764|87072\nFrancica|VV|D767|89851\nFrancofonte|SR|D768|96015\nFrancolise|CE|D769|81050\nFrascaro|AL|D770|15010\nFrascarolo|PV|D771|27030\nFrascati|RM|D773|00044\nFrascineto|CS|D774|87010\nFrassilongo|TN|D775|38050\nFrassinelle Polesine|RO|D776|45030\nFrassinello Monferrato|AL|D777|15035\nFrassineto Po|AL|D780|15040\nFrassinetto|TO|D781|10080\nFrassino|CN|D782|12020\nFrassinoro|MO|D783|41044\nFrasso Sabino|RI|D785|02030\nFrasso Telesino|BN|D784|82030\nFratta Polesine|RO|D788|45025\nFratta Todina|PG|D787|06054\nFrattamaggiore|NA|D789|80027\nFrattaminore|NA|D790|80020\nFratte Rosa|PU|D791|61040\nFrazzanò|ME|D793|98070\nFregona|TV|D794|31010\nFresagrandinaria|CH|D796|66050\nFresonara|AL|D797|15064\nFrigento|AV|D798|83040\nFrignano|CE|D799|81030\nFrinco|AT|D802|14030\nFrisa|CH|D803|66030\nFrisanco|PN|D804|33080\nFront|TO|D805|10070\nFrontino|PU|D807|61021\nFrontone|PU|D808|61040\nFrosinone|FR|D810|03100\nFrosolone|IS|D811|86095\nFrossasco|TO|D812|10060\nFrugarolo|AL|D813|15065\nFubine Monferrato|AL|D814|15043\nFucecchio|FI|D815|50054\nFuipiano Valle Imagna|BG|D817|24030\nFumane|VR|D818|37022\nFumone|FR|D819|03010\nFunes|BZ|D821|39040\nFurci Siculo|ME|D824|98023\nFurci|CH|D823|66050\nFurnari|ME|D825|98054\nFurore|SA|D826|84010\nFurtei|SU|D827|09040\nFuscaldo|CS|D828|87024\nFusignano|RA|D829|48034\nFusine|SO|D830|23010\nFutani|SA|D832|84050\nGabbioneta-Binanuova|CR|D834|26030\nGabiano|AL|D835|15020\nGabicce Mare|PU|D836|61011\nGaby|AO|D839|11020\nGadesco-Pieve Delmona|CR|D841|26030\nGadoni|NU|D842|08030\nGaeta|LT|D843|04024\nGaggi|ME|D844|98030\nGaggiano|MI|D845|20083\nGaggio Montano|BO|D847|40041\nGaglianico|BI|D848|13894\nGagliano Aterno|AQ|D850|67020\nGagliano Castelferrato|EN|D849|94010\nGagliano del Capo|LE|D851|73034\nGagliato|CZ|D852|88060\nGagliole|MC|D853|62022\nGaiarine|TV|D854|31018\nGaiba|RO|D855|45030\nGaiola|CN|D856|12010\nGaiole in Chianti|SI|D858|53013\nGairo|NU|D859|08040\nGais|BZ|D860|39030\nGalati Mamertino|ME|D861|98070\nGalatina|LE|D862|73013\nGalatone|LE|D863|73044\nGalatro|RC|D864|89054\nGalbiate|LC|D865|23851\nGaleata|FC|D867|47010\nGalgagnano|LO|D868|26832\nGallarate|VA|D869|21013\nGallese|VT|D870|01035\nGalliate Lombardo|VA|D871|21020\nGalliate|NO|D872|28066\nGalliavola|PV|D873|27034\nGallicano nel Lazio|RM|D875|00010\nGallicano|LU|D874|55027\nGallicchio|PZ|D876|85010\nGalliera Veneta|PD|D879|35015\nGalliera|BO|D878|40015\nGallinaro|FR|D881|03040\nGallio|VI|D882|36032\nGallipoli|LE|D883|73014\nGallo Matese|CE|D884|81010\nGallodoro|ME|D885|98030\nGalluccio|CE|D886|81044\nGaltellì|NU|D888|08020\nGalzignano Terme|PD|D889|35030\nGamalero|AL|D890|15010\nGambara|BS|D891|25020\nGambarana|PV|D892|27030\nGambasca|CN|D894|12030\nGambassi Terme|FI|D895|50050\nGambatesa|CB|D896|86013\nGambellara|VI|D897|36053\nGamberale|CH|D898|66040\nGambettola|FC|D899|47035\nGambolò|PV|D901|27025\nGambugliano|VI|D902|36050\nGandellino|BG|D903|24020\nGandino|BG|D905|24024\nGandosso|BG|D906|24060\nGangi|PA|D907|90024\nGaraguso|MT|D909|75010\nGarbagna Novarese|NO|D911|28070\nGarbagna|AL|D910|15050\nGarbagnate Milanese|MI|D912|20024\nGarbagnate Monastero|LC|D913|23846\nGarda|VR|D915|37016\nGardone Riviera|BS|D917|25083\nGardone Val Trompia|BS|D918|25063\nGaressio|CN|D920|12075\nGargallo|NO|D921|28010\nGargazzone|BZ|D923|39010\nGargnano|BS|D924|25084\nGarlasco|PV|D925|27026\nGarlate|LC|D926|23852\nGarlenda|SV|D927|17033\nGarniga Terme|TN|D928|38060\nGarzeno|CO|D930|22010\nGarzigliana|TO|D931|10060\nGasperina|CZ|D932|88060\nGassino Torinese|TO|D933|10090\nGattatico|RE|D934|42043\nGatteo|FC|D935|47043\nGattico-Veruno|NO|M416|28013\nGattinara|VC|D938|13045\nGavardo|BS|D940|25085\nGavello|RO|D942|45010\nGaverina Terme|BG|D943|24060\nGavi|AL|D944|15066\nGavignano|RM|D945|00030\nGavirate|VA|D946|21026\nGavoi|NU|D947|08020\nGavorrano|GR|D948|58023\nGazoldo degli Ippoliti|MN|D949|46040\nGazzada Schianno|VA|D951|21045\nGazzaniga|BG|D952|24025\nGazzo Veronese|VR|D957|37060\nGazzo|PD|D956|35010\nGazzola|PC|D958|29010\nGazzuolo|MN|D959|46010\nGela|CL|D960|93012\nGemmano|RN|D961|47855\nGemona del Friuli|UD|D962|33013\nGemonio|VA|D963|21036\nGenazzano|RM|D964|00030\nGenga|AN|D965|60040\nGenivolta|CR|D966|26020\nGenola|CN|D967|12040\nGenoni|SU|D968|09054\nGenova|GE|D969|16121-16167\nGenuri|SU|D970|09020\nGenzano di Lucania|PZ|D971|85013\nGenzano di Roma|RM|D972|00045\nGera Lario|CO|D974|22010\nGerace|RC|D975|89040\nGeraci Siculo|PA|D977|90010\nGerano|RM|D978|00025\nGerenzago|PV|D980|27010\nGerenzano|VA|D981|21040\nGergei|SU|D982|09055\nGermagnano|TO|D983|10070\nGermagno|VB|D984|28887\nGermignaga|VA|D987|21010\nGerocarne|VV|D988|89831\nGerola Alta|SO|D990|23010\nGerre de' Caprioli|CR|D993|26040\nGesico|SU|D994|09040\nGessate|MI|D995|20060\nGessopalena|CH|D996|66010\nGesturi|SU|D997|09020\nGesualdo|AV|D998|83040\nGhedi|BS|D999|25016\nGhemme|NO|E001|28074\nGhiffa|VB|E003|28823\nGhilarza|OR|E004|09074\nGhisalba|BG|E006|24050\nGhislarengo|VC|E007|13030\nGiacciano con Baruchella|RO|E008|45020\nGiaglione|TO|E009|10050\nGianico|BS|E010|25040\nGiano dell'Umbria|PG|E012|06030\nGiano Vetusto|CE|E011|81042\nGiardinello|PA|E013|90040\nGiardini-Naxos|ME|E014|98035\nGiarole|AL|E015|15036\nGiarratana|RG|E016|97010\nGiarre|CT|E017|95014\nGiave|SS|E019|07010\nGiaveno|TO|E020|10094\nGiavera del Montello|TV|E021|31040\nGiba|SU|E022|09010\nGibellina|TP|E023|91024\nGifflenga|BI|E024|13874\nGiffone|RC|E025|89020\nGiffoni Sei Casali|SA|E026|84090\nGiffoni Valle Piana|SA|E027|84095\nGignese|VB|E028|28836\nGignod|AO|E029|11010\nGildone|CB|E030|86010\nGimigliano|CZ|E031|88045\nGinestra degli Schiavoni|BN|E034|82020\nGinestra|PZ|E033|85020\nGinosa|TA|E036|74013\nGioi|SA|E037|84056\nGioia dei Marsi|AQ|E040|67055\nGioia del Colle|BA|E038|70023\nGioia Sannitica|CE|E039|81010\nGioia Tauro|RC|E041|89013\nGioiosa Ionica|RC|E044|89042\nGioiosa Marea|ME|E043|98063\nGiove|TR|E045|05024\nGiovinazzo|BA|E047|70054\nGiovo|TN|E048|38030\nGirasole|NU|E049|08040\nGirifalco|CZ|E050|88024\nGissi|CH|E052|66052\nGiuggianello|LE|E053|73030\nGiugliano in Campania|NA|E054|80014\nGiuliana|PA|E055|90030\nGiuliano di Roma|FR|E057|03020\nGiuliano Teatino|CH|E056|66010\nGiulianova|TE|E058|64021\nGiungano|SA|E060|84050\nGiurdignano|LE|E061|73020\nGiussago|PV|E062|27010\nGiussano|MB|E063|20833\nGiustenice|SV|E064|17027\nGiustino|TN|E065|38086\nGiusvalla|SV|E066|17010\nGivoletto|TO|E067|10040\nGizzeria|CZ|E068|88040\nGlorenza|BZ|E069|39020\nGodega di Sant'Urbano|TV|E071|31010\nGodiasco Salice Terme|PV|E072|27052\nGodrano|PA|E074|90030\nGoito|MN|E078|46044\nGolasecca|VA|E079|21010\nGolferenzo|PV|E081|27047\nGolfo Aranci|SS|M274|07020\nGombito|CR|E082|26020\nGonars|UD|E083|33050\nGoni|SU|E084|09040\nGonnesa|SU|E086|09010\nGonnoscodina|OR|E087|09090\nGonnosfanadiga|SU|E085|09035\nGonnosnò|OR|D585|09090\nGonnostramatza|OR|E088|09093\nGonzaga|MN|E089|46023\nGordona|SO|E090|23020\nGorga|RM|E091|00030\nGorgo al Monticano|TV|E092|31040\nGorgoglione|MT|E093|75010\nGorgonzola|MI|E094|20064\nGoriano Sicoli|AQ|E096|67030\nGorizia|GO|E098|34170\nGorla Maggiore|VA|E101|21050\nGorla Minore|VA|E102|21055\nGorlago|BG|E100|24060\nGorle|BG|E103|24020\nGornate Olona|VA|E104|21040\nGorno|BG|E106|24020\nGoro|FE|E107|44020\nGorreto|GE|E109|16020\nGorzegno|CN|E111|12070\nGosaldo|BL|E113|32020\nGossolengo|PC|E114|29020\nGottasecca|CN|E115|12070\nGottolengo|BS|E116|25023\nGovone|CN|E118|12040\nGozzano|NO|E120|28024\nGradara|PU|E122|61012\nGradisca d'Isonzo|GO|E124|34072\nGrado|GO|E125|34073\nGradoli|VT|E126|01010\nGraffignana|LO|E127|26813\nGraffignano|VT|E128|01020\nGraglia|BI|E130|13895\nGragnano Trebbiense|PC|E132|29010\nGragnano|NA|E131|80054\nGrammichele|CT|E133|95042\nGrana|AT|E134|14031\nGranarolo dell'Emilia|BO|E136|40057\nGrandate|CO|E139|22070\nGrandola ed Uniti|CO|E141|22010\nGraniti|ME|E142|98036\nGranozzo con Monticello|NO|E143|28060\nGrantola|VA|E144|21030\nGrantorto|PD|E145|35010\nGranze|PD|E146|35040\nGrassano|MT|E147|75014\nGrassobbio|BG|E148|24050\nGratteri|PA|E149|90010\nGravedona ed Uniti|CO|M315|22015\nGravellona Lomellina|PV|E152|27020\nGravellona Toce|VB|E153|28883\nGravere|TO|E154|10050\nGravina di Catania|CT|E156|95030\nGravina in Puglia|BA|E155|70024\nGrazzanise|CE|E158|81046\nGrazzano Badoglio|AT|E159|14035\nGreccio|RI|E160|02045\nGreci|AV|E161|83030\nGreggio|VC|E163|13030\nGremiasco|AL|E164|15056\nGressan|AO|E165|11020\nGressoney-La-Trinité|AO|E167|11020\nGressoney-Saint-Jean|AO|E168|11025\nGreve in Chianti|FI|E169|50022\nGrezzago|MI|E170|20056\nGrezzana|VR|E171|37023\nGriante|CO|E172|22011\nGricignano di Aversa|CE|E173|81030\nGrignasco|NO|E177|28075\nGrigno|TN|E178|38055\nGrimacco|UD|E179|33040\nGrimaldi|CS|E180|87034\nGrinzane Cavour|CN|E182|12060\nGrisignano di Zocco|VI|E184|36040\nGrisolia|CS|E185|87020\nGrizzana Morandi|BO|E187|40030\nGrognardo|AL|E188|15010\nGromo|BG|E189|24020\nGrondona|AL|E191|15060\nGrone|BG|E192|24060\nGrontardo|CR|E193|26044\nGropello Cairoli|PV|E195|27027\nGropparello|PC|E196|29025\nGroscavallo|TO|E199|10070\nGrosio|SO|E200|23033\nGrosotto|SO|E201|23034\nGrosseto|GR|E202|58100\nGrosso|TO|E203|10070\nGrottaferrata|RM|E204|00046\nGrottaglie|TA|E205|74023\nGrottaminarda|AV|E206|83035\nGrottammare|AP|E207|63066\nGrottazzolina|FM|E208|63844\nGrotte di Castro|VT|E210|01025\nGrotte|AG|E209|92020\nGrotteria|RC|E212|89043\nGrottole|MT|E213|75010\nGrottolella|AV|E214|83010\nGruaro|VE|E215|30020\nGrugliasco|TO|E216|10095\nGrumello Cremonese ed Uniti|CR|E217|26023\nGrumello del Monte|BG|E219|24064\nGrumento Nova|PZ|E221|85050\nGrumo Appula|BA|E223|70025\nGrumo Nevano|NA|E224|80028\nGrumolo delle Abbadesse|VI|E226|36040\nGuagnano|LE|E227|73010\nGualdo Cattaneo|PG|E229|06035\nGualdo Tadino|PG|E230|06023\nGualdo|MC|E228|62020\nGualtieri Sicaminò|ME|E233|98040\nGualtieri|RE|E232|42044\nGuamaggiore|SU|E234|09040\nGuanzate|CO|E235|22070\nGuarcino|FR|E236|03016\nGuarda Veneta|RO|E240|45030\nGuardabosone|VC|E237|13010\nGuardamiglio|LO|E238|26862\nGuardavalle|CZ|E239|88065\nGuardea|TR|E241|05025\nGuardia Lombardi|AV|E245|83040\nGuardia Perticara|PZ|E246|85010\nGuardia Piemontese|CS|E242|87020\nGuardia Sanframondi|BN|E249|82034\nGuardiagrele|CH|E243|66016\nGuardialfiera|CB|E244|86030\nGuardiaregia|CB|E248|86014\nGuardistallo|PI|E250|56040\nGuarene|CN|E251|12050\nGuasila|SU|E252|09040\nGuastalla|RE|E253|42016\nGuazzora|AL|E255|15050\nGubbio|PG|E256|06024\nGudo Visconti|MI|E258|20088\nGuglionesi|CB|E259|86034\nGuidizzolo|MN|E261|46040\nGuidonia Montecelio|RM|E263|00012\nGuiglia|MO|E264|41052\nGuilmi|CH|E266|66050\nGurro|VB|E269|28828\nGuspini|SU|E270|09036\nGussago|BS|E271|25064\nGussola|CR|E272|26040\nHône|AO|E273|11020\nIdro|BS|E280|25074\nIglesias|SU|E281|09016\nIgliano|CN|E282|12060\nIlbono|NU|E283|08040\nIllasi|VR|E284|37031\nIllorai|SS|E285|07010\nImbersago|LC|E287|23898\nImer|TN|E288|38050\nImola|BO|E289|40026\nImperia|IM|E290|18100\nImpruneta|FI|E291|50023\nInarzo|VA|E292|21020\nIncisa Scapaccino|AT|E295|14045\nIncudine|BS|E297|25040\nInduno Olona|VA|E299|21056\nIngria|TO|E301|10080\nIntragna|VB|E304|28816\nIntrobio|LC|E305|23815\nIntrod|AO|E306|11010\nIntrodacqua|AQ|E307|67030\nInverigo|CO|E309|22044\nInverno e Monteleone|PV|E310|27010\nInverso Pinasca|TO|E311|10060\nInveruno|MI|E313|20010\nInvorio|NO|E314|28045\nInzago|MI|E317|20065\nIonadi|VV|E321|89851\nIrgoli|NU|E323|08020\nIrma|BS|E325|25061\nIrsina|MT|E326|75022\nIsasca|CN|E327|12020\nIsca sullo Ionio|CZ|E328|88060\nIschia di Castro|VT|E330|01010\nIschia|NA|E329|80077\nIschitella|FG|E332|71010\nIseo|BS|E333|25049\nIsera|TN|E334|38060\nIsernia|IS|E335|86170\nIsili|SU|E336|09056\nIsnello|PA|E337|90010\nIsola d'Asti|AT|E338|14057\nIsola del Cantone|GE|E341|16017\nIsola del Giglio|GR|E348|58012\nIsola del Gran Sasso d'Italia|TE|E343|64045\nIsola del Liri|FR|E340|03036\nIsola del Piano|PU|E351|61030\nIsola della Scala|VR|E349|37063\nIsola delle Femmine|PA|E350|90040\nIsola di Capo Rizzuto|KR|E339|88841\nIsola di Fondra|BG|E353|24010\nIsola Dovarese|CR|E356|26031\nIsola Rizza|VR|E358|37050\nIsola Sant'Antonio|AL|E360|15050\nIsola Vicentina|VI|E354|36033\nIsolabella|TO|E345|10046\nIsolabona|IM|E346|18035\nIsole Tremiti|FG|E363|71051\nIsorella|BS|E364|25010\nIspani|SA|E365|84050\nIspica|RG|E366|97014\nIspra|VA|E367|21027\nIssiglio|TO|E368|10080\nIssime|AO|E369|11020\nIsso|BG|E370|24040\nIssogne|AO|E371|11020\nIstrana|TV|E373|31036\nItala|ME|E374|98025\nItri|LT|E375|04020\nIttireddu|SS|E376|07010\nIttiri|SS|E377|07044\nIvrea|TO|E379|10015\nIzano|CR|E380|26010\nJacurso|CZ|E274|88020\nJelsi|CB|E381|86015\nJenne|RM|E382|00020\nJerago con Orago|VA|E386|21040\nJerzu|NU|E387|08044\nJesi|AN|E388|60035\nJesolo|VE|C388|30016\nJolanda di Savoia|FE|E320|44037\nJoppolo Giancaxio|AG|E390|92010\nJoppolo|VV|E389|89863\nJovençan|AO|E391|11020\nL'Aquila|AQ|A345|67100\nLa Cassa|TO|E394|10040\nLa Loggia|TO|E423|10040\nLa Maddalena|SS|E425|07024\nLa Magdeleine|AO|A308|11020\nLa Morra|CN|E430|12064\nLa Salle|AO|E458|11015\nLa Spezia|SP|E463|19121-19137\nLa Thuile|AO|E470|11016\nLa Valle Agordina|BL|E490|32020\nLa Valle|BZ|E491|39030\nLa Valletta Brianza|LC|M348|23888\nLabico|RM|E392|00030\nLabro|RI|E393|02010\nLacchiarella|MI|E395|20084\nLacco Ameno|NA|E396|80076\nLacedonia|AV|E397|83046\nLaces|BZ|E398|39021\nLaconi|OR|E400|09090\nLadispoli|RM|M212|00055\nLaerru|SS|E401|07030\nLaganadi|RC|E402|89050\nLaghi|VI|E403|36010\nLaglio|CO|E405|22010\nLagnasco|CN|E406|12030\nLago|CS|E407|87035\nLagonegro|PZ|E409|85042\nLagosanto|FE|E410|44023\nLagundo|BZ|E412|39022\nLaigueglia|SV|E414|17053\nLainate|MI|E415|20020\nLaino Borgo|CS|E417|87014\nLaino Castello|CS|E419|87015\nLaino|CO|E416|22020\nLaion|BZ|E420|39040\nLaives|BZ|E421|39055\nLajatico|PI|E413|56030\nLallio|BG|E422|24040\nLama dei Peligni|CH|E424|66010\nLama Mocogno|MO|E426|41023\nLambrugo|CO|E428|22045\nLamezia Terme|CZ|M208|88046\nLamon|BL|E429|32033\nLampedusa e Linosa|AG|E431|92031\nLamporecchio|PT|E432|51035\nLamporo|VC|E433|13046\nLana|BZ|E434|39011\nLanciano|CH|E435|66034\nLandiona|NO|E436|28064\nLandriano|PV|E437|27015\nLanghirano|PR|E438|43013\nLangosco|PV|E439|27030\nLanusei|NU|E441|08045\nLanuvio|RM|C767|00075\nLanzada|SO|E443|23020\nLanzo Torinese|TO|E445|10074\nLapedona|FM|E447|63823\nLapio|AV|E448|83030\nLappano|CS|E450|87050\nLarciano|PT|E451|51036\nLardirago|PV|E454|27016\nLariano|RM|M207|00076\nLarino|CB|E456|86035\nLas Plassas|SU|E464|09020\nLasa|BZ|E457|39023\nLascari|PA|E459|90010\nLasnigo|CO|E462|22030\nLastebasse|VI|E465|36040\nLastra a Signa|FI|E466|50055\nLatera|VT|E467|01010\nLaterina Pergine Valdarno|AR|M392|52019\nLaterza|TA|E469|74014\nLatiano|BR|E471|72022\nLatina|LT|E472|04100\nLatisana|UD|E473|33053\nLatronico|PZ|E474|85043\nLattarico|CS|E475|87010\nLauco|UD|E476|33029\nLaureana Cilento|SA|E480|84050\nLaureana di Borrello|RC|E479|89023\nLauregno|BZ|E481|39040\nLaurenzana|PZ|E482|85014\nLauria|PZ|E483|85044\nLauriano|TO|E484|10020\nLaurino|SA|E485|84057\nLaurito|SA|E486|84050\nLauro|AV|E487|83023\nLavagna|GE|E488|16033\nLavagno|VR|E489|37030\nLavarone|TN|E492|38046\nLavello|PZ|E493|85024\nLavena Ponte Tresa|VA|E494|21037\nLaveno-Mombello|VA|E496|21014\nLavenone|BS|E497|25074\nLaviano|SA|E498|84020\nLavis|TN|E500|38015\nLazise|VR|E502|37017\nLazzate|MB|E504|20824\nLecce nei Marsi|AQ|E505|67050\nLecce|LE|E506|73100\nLecco|LC|E507|23900\nLedro|TN|M313|38067\nLeffe|BG|E509|24026\nLeggiuno|VA|E510|21038\nLegnago|VR|E512|37045\nLegnano|MI|E514|20025\nLegnaro|PD|E515|35020\nLei|NU|E517|08010\nLeini|TO|E518|10040\nLeivi|GE|E519|16040\nLemie|TO|E520|10070\nLendinara|RO|E522|45026\nLeni|ME|E523|98050\nLenna|BG|E524|24010\nLeno|BS|E526|25024\nLenola|LT|E527|04025\nLenta|VC|E528|13035\nLentate sul Seveso|MB|E530|20823\nLentella|CH|E531|66050\nLentini|SR|E532|96016\nLeonessa|RI|E535|02016\nLeonforte|EN|E536|94013\nLeporano|TA|E537|74020\nLequile|LE|E538|73010\nLequio Berria|CN|E540|12050\nLequio Tanaro|CN|E539|12060\nLercara Friddi|PA|E541|90025\nLerici|SP|E542|19032\nLerma|AL|E543|15070\nLesa|NO|E544|28040\nLesegno|CN|E546|12076\nLesignano de' Bagni|PR|E547|43037\nLesina|FG|E549|71010\nLesmo|MB|E550|20855\nLessolo|TO|E551|10010\nLessona|BI|M371|13853\nLestizza|UD|E553|33050\nLetino|CE|E554|81010\nLetojanni|ME|E555|98037\nLettere|NA|E557|80050\nLettomanoppello|PE|E558|65020\nLettopalena|CH|E559|66010\nLevanto|SP|E560|19015\nLevate|BG|E562|24040\nLeverano|LE|E563|73045\nLevice|CN|E564|12070\nLevico Terme|TN|E565|38056\nLevone|TO|E566|10070\nLezzeno|CO|E569|22025\nLiberi|CE|E570|81040\nLibrizzi|ME|E571|98064\nLicata|AG|E573|92027\nLicciana Nardi|MS|E574|54016\nLicenza|RM|E576|00026\nLicodia Eubea|CT|E578|95040\nLierna|LC|E581|23827\nLignana|VC|E583|13034\nLignano Sabbiadoro|UD|E584|33054\nLillianes|AO|E587|11020\nLimana|BL|E588|32020\nLimatola|BN|E589|82030\nLimbadi|VV|E590|89844\nLimbiate|MB|E591|20812\nLimena|PD|E592|35010\nLimido Comasco|CO|E593|22070\nLimina|ME|E594|98030\nLimone Piemonte|CN|E597|12015\nLimone sul Garda|BS|E596|25010\nLimosano|CB|E599|86022\nLinarolo|PV|E600|27010\nLinguaglossa|CT|E602|95015\nLioni|AV|E605|83047\nLipari|ME|E606|98055\nLipomo|CO|E607|22030\nLirio|PV|E608|27040\nLiscate|MI|E610|20060\nLiscia|CH|E611|66050\nLisciano Niccone|PG|E613|06060\nLisio|CN|E615|12070\nLissone|MB|E617|20851\nLiveri|NA|E620|80030\nLivigno|SO|E621|23030\nLivinallongo del Col di Lana|BL|E622|32020\nLivo|CO|E623|22010\nLivo|TN|E624|38020\nLivorno Ferraris|VC|E626|13046\nLivorno|LI|E625|57121-57128\nLivraga|LO|E627|26814\nLizzanello|LE|E629|73023\nLizzano in Belvedere|BO|A771|40042\nLizzano|TA|E630|74020\nLoano|SV|E632|17025\nLoazzolo|AT|E633|14051\nLocana|TO|E635|10080\nLocate di Triulzi|MI|E639|20085\nLocate Varesino|CO|E638|22070\nLocatello|BG|E640|24030\nLoceri|NU|E644|08040\nLocorotondo|BA|E645|70010\nLocri|RC|D976|89044\nLoculi|NU|E646|08020\nLodè|NU|E647|08020\nLodi Vecchio|LO|E651|26855\nLodi|LO|E648|26900\nLodine|NU|E649|08020\nLodrino|BS|E652|25060\nLograto|BS|E654|25030\nLoiano|BO|E655|40050\nLoiri Porto San Paolo|SS|M275|07020\nLomagna|LC|E656|23871\nLomazzo|CO|E659|22074\nLombardore|TO|E660|10040\nLombriasco|TO|E661|10040\nLomello|PV|E662|27034\nLona-Lases|TN|E664|38040\nLonate Ceppino|VA|E665|21050\nLonate Pozzolo|VA|E666|21015\nLonato del Garda|BS|M312|25017\nLonda|FI|E668|50060\nLongano|IS|E669|86090\nLongare|VI|E671|36023\nLongarone|BL|M342|32013\nLonghena|BS|E673|25030\nLongi|ME|E674|98070\nLongiano|FC|E675|47020\nLongobardi|CS|E677|87030\nLongobucco|CS|E678|87066\nLongone al Segrino|CO|E679|22030\nLongone Sabino|RI|E681|02020\nLonigo|VI|E682|36045\nLoranzè|TO|E683|10010\nLoreggia|PD|E684|35010\nLoreglia|VB|E685|28893\nLorenzago di Cadore|BL|E687|32040\nLoreo|RO|E689|45017\nLoreto Aprutino|PE|E691|65014\nLoreto|AN|E690|60025\nLoria|TV|E692|31037\nLoro Ciuffenna|AR|E693|52024\nLoro Piceno|MC|E694|62020\nLorsica|GE|E695|16045\nLosine|BS|E698|25050\nLotzorai|NU|E700|08040\nLovere|BG|E704|24065\nLovero|SO|E705|23030\nLozio|BS|E706|25040\nLozza|VA|E707|21040\nLozzo Atestino|PD|E709|35034\nLozzo di Cadore|BL|E708|32040\nLozzolo|VC|E711|13045\nLu e Cuccaro Monferrato|AL|M420|15037\nLubriano|VT|E713|01020\nLucca Sicula|AG|E714|92010\nLucca|LU|E715|55100\nLucera|FG|E716|71036\nLucignano|AR|E718|52046\nLucinasco|IM|E719|18020\nLucito|CB|E722|86030\nLuco dei Marsi|AQ|E723|67056\nLucoli|AQ|E724|67045\nLugagnano Val d'Arda|PC|E726|29018\nLugnano in Teverina|TR|E729|05020\nLugo di Vicenza|VI|E731|36030\nLugo|RA|E730|48022\nLuino|VA|E734|21016\nLuisago|CO|E735|22070\nLula|NU|E736|08020\nLumarzo|GE|E737|16024\nLumezzane|BS|E738|25065\nLunamatrona|SU|E742|09022\nLunano|PU|E743|61026\nLungavilla|PV|B387|27053\nLungro|CS|E745|87010\nLuni|SP|G143|19034\nLuogosano|AV|E746|83040\nLuogosanto|SS|E747|07020\nLupara|CB|E748|86030\nLurago d'Erba|CO|E749|22040\nLurago Marinone|CO|E750|22070\nLurano|BG|E751|24050\nLuras|SS|E752|07025\nLurate Caccivio|CO|E753|22075\nLusciano|CE|E754|81030\nLuserna San Giovanni|TO|E758|10062\nLuserna|TN|E757|38040\nLusernetta|TO|E759|10060\nLusevera|UD|E760|33010\nLusia|RO|E761|45020\nLusiana Conco|VI|M427|36046\nLusigliè|TO|E763|10080\nLuson|BZ|E764|39040\nLustra|SA|E767|84050\nLuvinate|VA|E769|21020\nLuzzana|BG|E770|24069\nLuzzara|RE|E772|42045\nLuzzi|CS|E773|87040\nMaccagno con Pino e Veddasca|VA|M339|21061\nMaccastorna|LO|E777|26843\nMacchia d'Isernia|IS|E778|86070\nMacchia Valfortore|CB|E780|86040\nMacchiagodena|IS|E779|86096\nMacello|TO|E782|10060\nMacerata Campania|CE|E784|81047\nMacerata Feltria|PU|E785|61023\nMacerata|MC|E783|62100\nMacherio|MB|E786|20846\nMaclodio|BS|E787|25030\nMacomer|NU|E788|08015\nMacra|CN|E789|12020\nMacugnaga|VB|E790|28876\nMaddaloni|CE|E791|81024\nMadesimo|SO|E342|23024\nMadignano|CR|E793|26020\nMadone|BG|E794|24040\nMadonna del Sasso|VB|E795|28894\nMadruzzo|TN|M357|38076\nMaenza|LT|E798|04010\nMafalda|CB|E799|86030\nMagasa|BS|E800|25080\nMagenta|MI|E801|20013\nMaggiora|NO|E803|28014\nMagherno|PV|E804|27010\nMagione|PG|E805|06063\nMagisano|CZ|E806|88050\nMagliano Alfieri|CN|E809|12050\nMagliano Alpi|CN|E808|12060\nMagliano de' Marsi|AQ|E811|67062\nMagliano di Tenna|FM|E807|63832\nMagliano in Toscana|GR|E810|58051\nMagliano Romano|RM|E813|00060\nMagliano Sabina|RI|E812|02046\nMagliano Vetere|SA|E814|84050\nMaglie|LE|E815|73024\nMagliolo|SV|E816|17020\nMaglione|TO|E817|10030\nMagnacavallo|MN|E818|46020\nMagnago|MI|E819|20020\nMagnano in Riviera|UD|E820|33010\nMagnano|BI|E821|13887\nMagomadas|OR|E825|09090\nMagrè sulla strada del vino|BZ|E829|39040\nMagreglio|CO|E830|22030\nMaida|CZ|E834|88025\nMaierà|CS|E835|87020\nMaierato|VV|E836|89843\nMaiolati Spontini|AN|E837|60030\nMaiolo|RN|E838|47862\nMaiori|SA|E839|84010\nMairago|LO|E840|26825\nMairano|BS|E841|25030\nMaissana|SP|E842|19010\nMajano|UD|E833|33030\nMalagnino|CR|E843|26030\nMalalbergo|BO|E844|40051\nMalborghetto Valbruna|UD|E847|33010\nMalcesine|VR|E848|37018\nMalé|TN|E850|38027\nMalegno|BS|E851|25053\nMaleo|LO|E852|26847\nMalesco|VB|E853|28854\nMaletto|CT|E854|95035\nMalfa|ME|E855|98050\nMalgesso|VA|E856|21020\nMalgrate|LC|E858|23864\nMalito|CS|E859|87030\nMallare|SV|E860|17045\nMalles Venosta|BZ|E862|39024\nMalnate|VA|E863|21046\nMalo|VI|E864|36034\nMalonno|BS|E865|25040\nMaltignano|AP|E868|63085\nMalvagna|ME|E869|98030\nMalvicino|AL|E870|15015\nMalvito|CS|E872|87010\nMammola|RC|E873|89045\nMamoiada|NU|E874|08024\nManciano|GR|E875|58014\nMandanici|ME|E876|98020\nMandas|SU|E877|09040\nMandatoriccio|CS|E878|87060\nMandela|RM|B632|00020\nMandello del Lario|LC|E879|23826\nMandello Vitta|NO|E880|28060\nManduria|TA|E882|74024\nManerba del Garda|BS|E883|25080\nManerbio|BS|E884|25025\nManfredonia|FG|E885|71043\nMango|CN|E887|12056\nMangone|CS|E888|87050\nManiace|CT|M283|95030\nManiago|PN|E889|33085\nManocalzati|AV|E891|83030\nManoppello|PE|E892|65024\nMansuè|TV|E893|31040\nManta|CN|E894|12030\nMantello|SO|E896|23016\nMantova|MN|E897|46100\nManzano|UD|E899|33044\nManziana|RM|E900|00066\nMapello|BG|E901|24030\nMappano|TO|M316|10079\nMara|SS|E902|07010\nMaracalagonis|CA|E903|09069\nMaranello|MO|E904|41053\nMarano di Napoli|NA|E906|80016\nMarano di Valpolicella|VR|E911|37020\nMarano Equo|RM|E908|00020\nMarano Lagunare|UD|E910|33050\nMarano Marchesato|CS|E914|87040\nMarano Principato|CS|E915|87040\nMarano sul Panaro|MO|E905|41054\nMarano Ticino|NO|E907|28040\nMarano Vicentino|VI|E912|36035\nMaranzana|AT|E917|14040\nMaratea|PZ|E919|85046\nMarcallo con Casone|MI|E921|20010\nMarcaria|MN|E922|46010\nMarcedusa|CZ|E923|88050\nMarcellina|RM|E924|00010\nMarcellinara|CZ|E925|88044\nMarcetelli|RI|E927|02020\nMarcheno|BS|E928|25060\nMarchirolo|VA|E929|21030\nMarciana Marina|LI|E931|57033\nMarciana|LI|E930|57030\nMarcianise|CE|E932|81025\nMarciano della Chiana|AR|E933|52047\nMarcignago|PV|E934|27020\nMarcon|VE|E936|30020\nMarebbe|BZ|E938|39030\nMarene|CN|E939|12030\nMareno di Piave|TV|E940|31010\nMarentino|TO|E941|10020\nMaretto|AT|E944|14018\nMargarita|CN|E945|12040\nMargherita di Savoia|BT|E946|76016\nMargno|LC|E947|23832\nMariana Mantovana|MN|E949|46010\nMariano Comense|CO|E951|22066\nMariano del Friuli|GO|E952|34070\nMarianopoli|CL|E953|93010\nMariglianella|NA|E954|80030\nMarigliano|NA|E955|80034\nMarina di Gioiosa Ionica|RC|E956|89046\nMarineo|PA|E957|90035\nMarino|RM|E958|00047\nMarlengo|BZ|E959|39020\nMarliana|PT|E960|51010\nMarmentino|BS|E961|25060\nMarmirolo|MN|E962|46045\nMarmora|CN|E963|12020\nMarnate|VA|E965|21050\nMarone|BS|E967|25054\nMaropati|RC|E968|89020\nMarostica|VI|E970|36063\nMarradi|FI|E971|50034\nMarrubiu|OR|E972|09094\nMarsaglia|CN|E973|12060\nMarsala|TP|E974|91025\nMarsciano|PG|E975|06055\nMarsico Nuovo|PZ|E976|85052\nMarsicovetere|PZ|E977|85050\nMarta|VT|E978|01010\nMartano|LE|E979|73025\nMartellago|VE|E980|30030\nMartello|BZ|E981|39020\nMartignacco|UD|E982|33035\nMartignana di Po|CR|E983|26040\nMartignano|LE|E984|73020\nMartina Franca|TA|E986|74015\nMartinengo|BG|E987|24057\nMartiniana Po|CN|E988|12030\nMartinsicuro|TE|E989|64014\nMartirano Lombardo|CZ|E991|88040\nMartirano|CZ|E990|88040\nMartis|SS|E992|07030\nMartone|RC|E993|89040\nMarudo|LO|E994|26866\nMaruggio|TA|E995|74020\nMarzabotto|BO|B689|40043\nMarzano Appio|CE|E998|81035\nMarzano di Nola|AV|E997|83020\nMarzano|PV|E999|27010\nMarzi|CS|F001|87050\nMarzio|VA|F002|21030\nMasainas|SU|M270|09010\nMasate|MI|F003|20060\nMascali|CT|F004|95016\nMascalucia|CT|F005|95030\nMaschito|PZ|F006|85020\nMasciago Primo|VA|F007|21030\nMaser|TV|F009|31010\nMaserà di Padova|PD|F011|35020\nMasera|VB|F010|28855\nMaserada sul Piave|TV|F012|31052\nMasi Torello|FE|F016|44020\nMasi|PD|F013|35040\nMasio|AL|F015|15024\nMaslianico|CO|F017|22026\nMasone|GE|F020|16010\nMassa d'Albe|AQ|F022|67050\nMassa di Somma|NA|M289|80040\nMassa e Cozzile|PT|F025|51010\nMassa Fermana|FM|F021|63834\nMassa Lombarda|RA|F029|48024\nMassa Lubrense|NA|F030|80061\nMassa Marittima|GR|F032|58024\nMassa Martana|PG|F024|06056\nMassa|MS|F023|54100\nMassafra|TA|F027|74016\nMassalengo|LO|F028|26815\nMassanzago|PD|F033|35010\nMassarosa|LU|F035|55054\nMassazza|BI|F037|13873\nMassello|TO|F041|10060\nMasserano|BI|F042|13866\nMassignano|AP|F044|63061\nMassimeno|TN|F045|38086\nMassimino|SV|F046|12071\nMassino Visconti|NO|F047|28040\nMassiola|VB|F048|28895\nMasullas|OR|F050|09090\nMatelica|MC|F051|62024\nMatera|MT|F052|75100\nMathi|TO|F053|10075\nMatino|LE|F054|73046\nMatrice|CB|F055|86030\nMattie|TO|F058|10050\nMattinata|FG|F059|71030\nMazara del Vallo|TP|F061|91026\nMazzano Romano|RM|F064|00060\nMazzano|BS|F063|25080\nMazzarino|CL|F065|93013\nMazzarrà Sant'Andrea|ME|F066|98056\nMazzarrone|CT|M271|95040\nMazzè|TO|F067|10035\nMazzin|TN|F068|38030\nMazzo di Valtellina|SO|F070|23030\nMeana di Susa|TO|F074|10050\nMeana Sardo|NU|F073|08030\nMeda|MB|F078|20821\nMede|PV|F080|27035\nMedea|GO|F081|34076\nMedesano|PR|F082|43014\nMedicina|BO|F083|40059\nMediglia|MI|F084|20060\nMedolago|BG|F085|24030\nMedole|MN|F086|46046\nMedolla|MO|F087|41036\nMeduna di Livenza|TV|F088|31040\nMeduno|PN|F089|33092\nMegliadino San Vitale|PD|F092|35040\nMeina|NO|F093|28046\nMelara|RO|F095|45037\nMelazzo|AL|F096|15010\nMeldola|FC|F097|47014\nMele|GE|F098|16010\nMelegnano|MI|F100|20077\nMelendugno|LE|F101|73026\nMeleti|LO|F102|26843\nMelfi|PZ|F104|85025\nMelicuccà|RC|F105|89020\nMelicucco|RC|F106|89020\nMelilli|SR|F107|96010\nMelissa|KR|F108|88814\nMelissano|LE|F109|73040\nMelito di Napoli|NA|F111|80017\nMelito di Porto Salvo|RC|F112|89063\nMelito Irpino|AV|F110|83030\nMelizzano|BN|F113|82030\nMelle|CN|F114|12020\nMello|SO|F115|23010\nMelpignano|LE|F117|73020\nMeltina|BZ|F118|39010\nMelzo|MI|F119|20066\nMenaggio|CO|F120|22017\nMenconico|PV|F122|27050\nMendatica|IM|F123|18025\nMendicino|CS|F125|87040\nMenfi|AG|F126|92013\nMentana|RM|F127|00013\nMeolo|VE|F130|30020\nMerana|AL|F131|15010\nMerano|BZ|F132|39012\nMerate|LC|F133|23807\nMercallo|VA|F134|21020\nMercatello sul Metauro|PU|F135|61040\nMercatino Conca|PU|F136|61013\nMercato San Severino|SA|F138|84085\nMercato Saraceno|FC|F139|47025\nMercenasco|TO|F140|10010\nMercogliano|AV|F141|83013\nMereto di Tomba|UD|F144|33036\nMergo|AN|F145|60030\nMergozzo|VB|F146|28802\nMerì|ME|F147|98040\nMerlara|PD|F148|35040\nMerlino|LO|F149|26833\nMerone|CO|F151|22046\nMesagne|BR|F152|72023\nMese|SO|F153|23020\nMesenzana|VA|F154|21030\nMesero|MI|F155|20010\nMesola|FE|F156|44026\nMesoraca|KR|F157|88838\nMessina|ME|F158|98121-98168\nMestrino|PD|F161|35035\nMeta|NA|F162|80062\nMezzago|MB|F165|20883\nMezzana Bigli|PV|F170|27030\nMezzana Mortigliengo|BI|F167|13831\nMezzana Rabattone|PV|F171|27030\nMezzana|TN|F168|38020\nMezzane di Sotto|VR|F172|37030\nMezzanego|GE|F173|16046\nMezzanino|PV|F175|27040\nMezzano|TN|F176|38050\nMezzenile|TO|F182|10070\nMezzocorona|TN|F183|38016\nMezzojuso|PA|F184|90030\nMezzoldo|BG|F186|24010\nMezzolombardo|TN|F187|38017\nMezzomerico|NO|F188|28040\nMiagliano|BI|F189|13816\nMiane|TV|F190|31050\nMiasino|NO|F191|28010\nMiazzina|VB|F192|28817\nMicigliano|RI|F193|02010\nMiggiano|LE|F194|73035\nMiglianico|CH|F196|66010\nMiglierina|CZ|F200|88040\nMiglionico|MT|F201|75010\nMignanego|GE|F202|16018\nMignano Monte Lungo|CE|F203|81049\nMilano|MI|F205|20121-20162\nMilazzo|ME|F206|98057\nMilena|CL|E618|93010\nMileto|VV|F207|89852\nMilis|OR|F208|09070\nMilitello in Val di Catania|CT|F209|95043\nMilitello Rosmarino|ME|F210|98070\nMillesimo|SV|F213|17017\nMilo|CT|F214|95010\nMilzano|BS|F216|25020\nMineo|CT|F217|95044\nMinerbe|VR|F218|37046\nMinerbio|BO|F219|40061\nMinervino di Lecce|LE|F221|73027\nMinervino Murge|BT|F220|76013\nMinori|SA|F223|84010\nMinturno|LT|F224|04026\nMinucciano|LU|F225|55034\nMioglia|SV|F226|17040\nMira|VE|F229|30034\nMirabella Eclano|AV|F230|83036\nMirabella Imbaccari|CT|F231|95040\nMirabello Monferrato|AL|F232|15040\nMirabello Sannitico|CB|F233|86010\nMiradolo Terme|PV|F238|27010\nMiranda|IS|F239|86080\nMirandola|MO|F240|41037\nMirano|VE|F241|30035\nMirto|ME|F242|98070\nMisano Adriatico|RN|F244|47843\nMisano di Gera d'Adda|BG|F243|24040\nMisilmeri|PA|F246|90036\nMisinto|MB|F247|20826\nMissaglia|LC|F248|23873\nMissanello|PZ|F249|85010\nMisterbianco|CT|F250|95045\nMistretta|ME|F251|98073\nMoasca|AT|F254|14050\nMoconesi|GE|F256|16047\nModena|MO|F257|41121-41126\nModica|RG|F258|97015\nModigliana|FC|F259|47015\nModolo|OR|F261|09090\nModugno|BA|F262|70026\nMoena|TN|F263|38035\nMoggio Udinese|UD|F266|33015\nMoggio|LC|F265|23817\nMoglia|MN|F267|46024\nMogliano Veneto|TV|F269|31021\nMogliano|MC|F268|62010\nMogorella|OR|F270|09080\nMogoro|OR|F272|09095\nMoiano|BN|F274|82010\nMoimacco|UD|F275|33040\nMoio Alcantara|ME|F277|98030\nMoio de' Calvi|BG|F276|24010\nMoio della Civitella|SA|F278|84060\nMoiola|CN|F279|12010\nMola di Bari|BA|F280|70042\nMolare|AL|F281|15074\nMolazzana|LU|F283|55020\nMolfetta|BA|F284|70056\nMolina Aterno|AQ|M255|67020\nMolinara|BN|F287|82020\nMolinella|BO|F288|40062\nMolini di Triora|IM|F290|18010\nMolino dei Torti|AL|F293|15050\nMolise|CB|F294|86020\nMoliterno|PZ|F295|85047\nMollia|VC|F297|13020\nMolochio|RC|F301|89010\nMolteno|LC|F304|23847\nMoltrasio|CO|F305|22010\nMolveno|TN|F307|38018\nMombaldone|AT|F308|14050\nMombarcaro|CN|F309|12070\nMombaroccio|PU|F310|61024\nMombaruzzo|AT|F311|14046\nMombasiglio|CN|F312|12070\nMombello di Torino|TO|F315|10020\nMombello Monferrato|AL|F313|15020\nMombercelli|AT|F316|14047\nMomo|NO|F317|28015\nMompantero|TO|F318|10059\nMompeo|RI|F319|02040\nMomperone|AL|F320|15050\nMonacilioni|CB|F322|86040\nMonale|AT|F323|14013\nMonasterace|RC|F324|89040\nMonastero Bormida|AT|F325|14058\nMonastero di Lanzo|TO|F327|10070\nMonastero di Vasco|CN|F326|12080\nMonasterolo Casotto|CN|F329|12080\nMonasterolo del Castello|BG|F328|24060\nMonasterolo di Savigliano|CN|F330|12030\nMonastier di Treviso|TV|F332|31050\nMonastir|SU|F333|09023\nMoncalieri|TO|F335|10024\nMoncalvo|AT|F336|14036\nMoncenisio|TO|D553|10050\nMoncestino|AL|F337|15020\nMonchiero|CN|F338|12060\nMonchio delle Corti|PR|F340|43010\nMoncrivello|VC|F342|13040\nMoncucco Torinese|AT|F343|14024\nMondaino|RN|F346|47836\nMondavio|PU|F347|61040\nMondolfo|PU|F348|61037\nMondovì|CN|F351|12084\nMondragone|CE|F352|81034\nMoneglia|GE|F354|16030\nMonesiglio|CN|F355|12077\nMonfalcone|GO|F356|34074\nMonforte d'Alba|CN|F358|12065\nMonforte San Giorgio|ME|F359|98041\nMonfumo|TV|F360|31010\nMongardino|AT|F361|14040\nMonghidoro|BO|F363|40063\nMongiana|VV|F364|89823\nMongiardino Ligure|AL|F365|15060\nMongiuffi Melia|ME|F368|98030\nMongrando|BI|F369|13888\nMongrassano|CS|F370|87040\nMonguelfo-Tesido|BZ|F371|39035\nMonguzzo|CO|F372|22040\nMoniga del Garda|BS|F373|25080\nMonleale|AL|F374|15059\nMonno|BS|F375|25040\nMonopoli|BA|F376|70043\nMonreale|PA|F377|90046\nMonrupino|TS|F378|34016\nMonsampietro Morico|FM|F379|63842\nMonsampolo del Tronto|AP|F380|63077\nMonsano|AN|F381|60030\nMonselice|PD|F382|35043\nMonserrato|CA|F383|09042\nMonsummano Terme|PT|F384|51015\nMontà|CN|F385|12046\nMontabone|AT|F386|14040\nMontacuto|AL|F387|15050\nMontafia|AT|F390|14014\nMontagano|CB|F391|86023\nMontagna in Valtellina|SO|F393|23020\nMontagna|BZ|F392|39040\nMontagnana|PD|F394|35044\nMontagnareale|ME|F395|98060\nMontaguto|AV|F397|83030\nMontaione|FI|F398|50050\nMontalbano Elicona|ME|F400|98065\nMontalbano Jonico|MT|F399|75023\nMontalcino|SI|M378|53024\nMontaldeo|AL|F403|15060\nMontaldo Bormida|AL|F404|15010\nMontaldo di Mondovì|CN|F405|12080\nMontaldo Roero|CN|F408|12040\nMontaldo Scarampi|AT|F409|14048\nMontaldo Torinese|TO|F407|10020\nMontale|PT|F410|51037\nMontalenghe|TO|F411|10090\nMontallegro|AG|F414|92010\nMontalto Carpasio|IM|M387|18028\nMontalto delle Marche|AP|F415|63068\nMontalto di Castro|VT|F419|01014\nMontalto Dora|TO|F420|10016\nMontalto Pavese|PV|F417|27040\nMontalto Uffugo|CS|F416|87046\nMontanaro|TO|F422|10017\nMontanaso Lombardo|LO|F423|26836\nMontanera|CN|F424|12040\nMontano Antilia|SA|F426|84060\nMontano Lucino|CO|F427|22070\nMontappone|FM|F428|63835\nMontaquila|IS|F429|86070\nMontasola|RI|F430|02040\nMontauro|CZ|F432|88060\nMontazzoli|CH|F433|66030\nMonte Argentario|GR|F437|58019\nMonte Castello di Vibio|PG|F456|06057\nMonte Cavallo|MC|F460|62036\nMonte Cerignone|PU|F467|61010\nMonte Compatri|RM|F477|00077\nMonte Cremasco|CR|F434|26010\nMonte di Malo|VI|F486|36030\nMonte di Procida|NA|F488|80070\nMonte Giberto|FM|F517|63846\nMonte Grimano Terme|PU|F524|61010\nMonte Isola|BS|F532|25050\nMonte Marenzo|LC|F561|23804\nMonte Porzio Catone|RM|F590|00078\nMonte Porzio|PU|F589|61040\nMonte Rinaldo|FM|F599|63852\nMonte Roberto|AN|F600|60030\nMonte Romano|VT|F603|01010\nMonte San Biagio|LT|F616|04020\nMonte San Giacomo|SA|F618|84030\nMonte San Giovanni Campano|FR|F620|03025\nMonte San Giovanni in Sabina|RI|F619|02040\nMonte San Giusto|MC|F621|62015\nMonte San Martino|MC|F622|62020\nMonte San Pietrangeli|FM|F626|63815\nMonte San Pietro|BO|F627|40050\nMonte San Savino|AR|F628|52048\nMonte San Vito|AN|F634|60037\nMonte Sant'Angelo|FG|F631|71037\nMonte Santa Maria Tiberina|PG|F629|06010\nMonte Urano|FM|F653|63813\nMonte Vidon Combatte|FM|F664|63847\nMonte Vidon Corrado|FM|F665|63836\nMontebello della Battaglia|PV|F440|27054\nMontebello di Bertona|PE|F441|65010\nMontebello Jonico|RC|D746|89064\nMontebello sul Sangro|CH|B268|66040\nMontebello Vicentino|VI|F442|36054\nMontebelluna|TV|F443|31044\nMontebruno|GE|F445|16025\nMontebuono|RI|F446|02040\nMontecalvo in Foglia|PU|F450|61020\nMontecalvo Irpino|AV|F448|83037\nMontecalvo Versiggia|PV|F449|27047\nMontecarlo|LU|F452|55015\nMontecarotto|AN|F453|60036\nMontecassiano|MC|F454|62010\nMontecastello|AL|F455|15040\nMontecastrilli|TR|F457|05026\nMontecatini Val di Cecina|PI|F458|56040\nMontecatini-Terme|PT|A561|51016\nMontecchia di Crosara|VR|F461|37030\nMontecchio Emilia|RE|F463|42027\nMontecchio Maggiore|VI|F464|36075\nMontecchio Precalcino|VI|F465|36030\nMontecchio|TR|F462|05020\nMontechiaro d'Acqui|AL|F469|15010\nMontechiaro d'Asti|AT|F468|14025\nMontechiarugolo|PR|F473|43022\nMonteciccardo|PU|F474|61024\nMontecilfone|CB|F475|86032\nMontecopiolo|PU|F478|61014\nMontecorice|SA|F479|84060\nMontecorvino Pugliano|SA|F480|84090\nMontecorvino Rovella|SA|F481|84096\nMontecosaro|MC|F482|62010\nMontecrestese|VB|F483|28864\nMontecreto|MO|F484|41025\nMontedinove|AP|F487|63069\nMontedoro|CL|F489|93010\nMontefalcione|AV|F491|83030\nMontefalco|PG|F492|06036\nMontefalcone Appennino|FM|F493|63855\nMontefalcone di Val Fortore|BN|F494|82025\nMontefalcone nel Sannio|CB|F495|86033\nMontefano|MC|F496|62010\nMontefelcino|PU|F497|61030\nMonteferrante|CH|F498|66040\nMontefiascone|VT|F499|01027\nMontefino|TE|F500|64030\nMontefiore Conca|RN|F502|47834\nMontefiore dell'Aso|AP|F501|63062\nMontefiorino|MO|F503|41045\nMonteflavio|RM|F504|00010\nMonteforte Cilento|SA|F507|84060\nMonteforte d'Alpone|VR|F508|37032\nMonteforte Irpino|AV|F506|83024\nMontefortino|FM|F509|63858\nMontefranco|TR|F510|05030\nMontefredane|AV|F511|83030\nMontefusco|AV|F512|83030\nMontegabbione|TR|F513|05010\nMontegalda|VI|F514|36047\nMontegaldella|VI|F515|36047\nMontegallo|AP|F516|63094\nMontegioco|AL|F518|15050\nMontegiordano|CS|F519|87070\nMontegiorgio|FM|F520|63833\nMontegranaro|FM|F522|63812\nMontegridolfo|RN|F523|47837\nMontegrino Valtravaglia|VA|F526|21010\nMontegrosso d'Asti|AT|F527|14048\nMontegrosso Pian Latte|IM|F528|18025\nMontegrotto Terme|PD|F529|35036\nMonteiasi|TA|F531|74020\nMontelabbate|PU|F533|61025\nMontelanico|RM|F534|00030\nMontelapiano|CH|F535|66040\nMonteleone d'Orvieto|TR|F543|05017\nMonteleone di Fermo|FM|F536|63841\nMonteleone di Puglia|FG|F538|71020\nMonteleone di Spoleto|PG|F540|06045\nMonteleone Rocca Doria|SS|F542|07010\nMonteleone Sabino|RI|F541|02033\nMontelepre|PA|F544|90040\nMontelibretti|RM|F545|00010\nMontella|AV|F546|83048\nMontello|BG|F547|24060\nMontelongo|CB|F548|86040\nMontelparo|FM|F549|63853\nMontelupo Albese|CN|F550|12050\nMontelupo Fiorentino|FI|F551|50056\nMontelupone|MC|F552|62010\nMontemaggiore Belsito|PA|F553|90020\nMontemagno|AT|F556|14030\nMontemale di Cuneo|CN|F558|12025\nMontemarano|AV|F559|83040\nMontemarciano|AN|F560|60018\nMontemarzino|AL|F562|15050\nMontemesola|TA|F563|74020\nMontemezzo|CO|F564|22010\nMontemignaio|AR|F565|52010\nMontemiletto|AV|F566|83038\nMontemilone|PZ|F568|85020\nMontemitro|CB|F569|86030\nMontemonaco|AP|F570|63088\nMontemurlo|PO|F572|59013\nMontemurro|PZ|F573|85053\nMontenars|UD|F574|33010\nMontenero di Bisaccia|CB|F576|86036\nMontenero Sabino|RI|F579|02040\nMontenero Val Cocchiara|IS|F580|86080\nMontenerodomo|CH|F578|66010\nMonteodorisio|CH|F582|66050\nMontepaone|CZ|F586|88060\nMonteparano|TA|F587|74020\nMonteprandone|AP|F591|63076\nMontepulciano|SI|F592|53045\nMonterchi|AR|F594|52035\nMontereale Valcellina|PN|F596|33086\nMontereale|AQ|F595|67015\nMonterenzio|BO|F597|40050\nMonteriggioni|SI|F598|53035\nMonteroduni|IS|F601|86075\nMonteroni d'Arbia|SI|F605|53014\nMonteroni di Lecce|LE|F604|73047\nMonterosi|VT|F606|01030\nMonterosso al Mare|SP|F609|19016\nMonterosso Almo|RG|F610|97010\nMonterosso Calabro|VV|F607|89819\nMonterosso Grana|CN|F608|12020\nMonterotondo Marittimo|GR|F612|58025\nMonterotondo|RM|F611|00015\nMonterubbiano|FM|F614|63825\nMontesano Salentino|LE|F623|73030\nMontesano sulla Marcellana|SA|F625|84033\nMontesarchio|BN|F636|82016\nMontescaglioso|MT|F637|75024\nMontescano|PV|F638|27040\nMontescheno|VB|F639|28843\nMontescudaio|PI|F640|56040\nMontescudo-Monte Colombo|RN|M368|47854\nMontese|MO|F642|41055\nMontesegale|PV|F644|27052\nMontesilvano|PE|F646|65015\nMontespertoli|FI|F648|50025\nMonteu da Po|TO|F651|10020\nMonteu Roero|CN|F654|12040\nMontevago|AG|F655|92010\nMontevarchi|AR|F656|52025\nMontevecchia|LC|F657|23874\nMonteverde|AV|F660|83049\nMonteverdi Marittimo|PI|F661|56040\nMonteviale|VI|F662|36050\nMontezemolo|CN|F666|12070\nMonti|SS|F667|07020\nMontiano|FC|F668|47020\nMonticelli Brusati|BS|F672|25040\nMonticelli d'Ongina|PC|F671|29010\nMonticelli Pavese|PV|F670|27010\nMonticello Brianza|LC|F674|23876\nMonticello Conte Otto|VI|F675|36010\nMonticello d'Alba|CN|F669|12066\nMontichiari|BS|F471|25018\nMonticiano|SI|F676|53015\nMontieri|GR|F677|58026\nMontiglio Monferrato|AT|M302|14026\nMontignoso|MS|F679|54038\nMontirone|BS|F680|25010\nMontjovet|AO|F367|11020\nMontodine|CR|F681|26010\nMontoggio|GE|F682|16026\nMontone|PG|F685|06014\nMontopoli di Sabina|RI|F687|02034\nMontopoli in Val d'Arno|PI|F686|56020\nMontorfano|CO|F688|22030\nMontorio al Vomano|TE|F690|64046\nMontorio nei Frentani|CB|F689|86040\nMontorio Romano|RM|F692|00010\nMontoro|AV|M330|83025\nMontorso Vicentino|VI|F696|36050\nMontottone|FM|F697|63843\nMontresta|OR|F698|09090\nMontù Beccaria|PV|F701|27040\nMonvalle|VA|F703|21020\nMonza|MB|F704|20900\nMonzambano|MN|F705|46040\nMonzuno|BO|F706|40036\nMorano Calabro|CS|F708|87016\nMorano sul Po|AL|F707|15025\nMoransengo|AT|F709|14023\nMoraro|GO|F710|34070\nMorazzone|VA|F711|21040\nMorbegno|SO|F712|23017\nMorbello|AL|F713|15010\nMorciano di Leuca|LE|F716|73040\nMorciano di Romagna|RN|F715|47833\nMorcone|BN|F717|82026\nMordano|BO|F718|40027\nMorengo|BG|F720|24050\nMores|SS|F721|07013\nMoresco|FM|F722|63826\nMoretta|CN|F723|12033\nMorfasso|PC|F724|29020\nMorgano|TV|F725|31050\nMorgex|AO|F726|11017\nMorgongiori|OR|F727|09090\nMori|TN|F728|38065\nMoriago della Battaglia|TV|F729|31010\nMoricone|RM|F730|00010\nMorigerati|SA|F731|84030\nMorimondo|MI|D033|20081\nMorino|AQ|F732|67050\nMoriondo Torinese|TO|F733|10020\nMorlupo|RM|F734|00067\nMormanno|CS|F735|87026\nMornago|VA|F736|21020\nMornese|AL|F737|15075\nMornico al Serio|BG|F738|24050\nMornico Losana|PV|F739|27040\nMorolo|FR|F740|03017\nMorozzo|CN|F743|12040\nMorra De Sanctis|AV|F744|83040\nMorro d'Alba|AN|F745|60030\nMorro d'Oro|TE|F747|64020\nMorro Reatino|RI|F746|02010\nMorrone del Sannio|CB|F748|86040\nMorrovalle|MC|F749|62010\nMorsano al Tagliamento|PN|F750|33075\nMorsasco|AL|F751|15010\nMortara|PV|F754|27036\nMortegliano|UD|F756|33050\nMorterone|LC|F758|23811\nMoruzzo|UD|F760|33030\nMoscazzano|CR|F761|26010\nMoschiano|AV|F762|83020\nMosciano Sant'Angelo|TE|F764|64023\nMoscufo|PE|F765|65010\nMoso in Passiria|BZ|F766|39013\nMossa|GO|F767|34070\nMotta Baluffi|CR|F771|26045\nMotta Camastra|ME|F772|98030\nMotta d'Affermo|ME|F773|98070\nMotta de' Conti|VC|F774|13010\nMotta di Livenza|TV|F770|31045\nMotta Montecorvino|FG|F777|71030\nMotta San Giovanni|RC|F779|89065\nMotta Sant'Anastasia|CT|F781|95040\nMotta Santa Lucia|CZ|F780|88040\nMotta Visconti|MI|F783|20086\nMottafollone|CS|F775|87010\nMottalciata|BI|F776|13874\nMotteggiana|MN|B012|46020\nMottola|TA|F784|74017\nMozzagrogna|CH|F785|66030\nMozzanica|BG|F786|24050\nMozzate|CO|F788|22076\nMozzecane|VR|F789|37060\nMozzo|BG|F791|24030\nMuccia|MC|F793|62034\nMuggia|TS|F795|34015\nMuggiò|MB|F797|20835\nMugnano del Cardinale|AV|F798|83027\nMugnano di Napoli|NA|F799|80018\nMulazzano|LO|F801|26837\nMulazzo|MS|F802|54026\nMura|BS|F806|25070\nMuravera|SU|F808|09043\nMurazzano|CN|F809|12060\nMurello|CN|F811|12030\nMurialdo|SV|F813|17013\nMurisengo|AL|F814|15020\nMurlo|SI|F815|53016\nMuro Leccese|LE|F816|73036\nMuro Lucano|PZ|F817|85054\nMuros|SS|F818|07030\nMuscoline|BS|F820|25080\nMusei|SU|F822|09010\nMusile di Piave|VE|F826|30024\nMusso|CO|F828|22010\nMussolente|VI|F829|36065\nMussomeli|CL|F830|93014\nMuzzana del Turgnano|UD|F832|33055\nMuzzano|BI|F833|13895\nNago-Torbole|TN|F835|38069\nNalles|BZ|F836|39010\nNanto|VI|F838|36024\nNapoli|NA|F839|80121-80147\nNarbolia|OR|F840|09070\nNarcao|SU|F841|09010\nNardò|LE|F842|73048\nNardodipace|VV|F843|89824\nNarni|TR|F844|05035\nNaro|AG|F845|92028\nNarzole|CN|F846|12068\nNasino|SV|F847|17030\nNaso|ME|F848|98074\nNaturno|BZ|F849|39025\nNave|BS|F851|25075\nNavelli|AQ|F852|67020\nNaz-Sciaves|BZ|F856|39040\nNazzano|RM|F857|00060\nNe|GE|F858|16040\nNebbiuno|NO|F859|28010\nNegrar di Valpolicella|VR|F861|37024\nNeirone|GE|F862|16040\nNeive|CN|F863|12052\nNembro|BG|F864|24027\nNemi|RM|F865|00074\nNemoli|PZ|F866|85040\nNeoneli|OR|F867|09080\nNepi|VT|F868|01036\nNereto|TE|F870|64015\nNerola|RM|F871|00017\nNervesa della Battaglia|TV|F872|31040\nNerviano|MI|F874|20014\nNespolo|RI|F876|02020\nNesso|CO|F877|22020\nNetro|BI|F878|13896\nNettuno|RM|F880|00048\nNeviano degli Arduini|PR|F882|43024\nNeviano|LE|F881|73040\nNeviglie|CN|F883|12050\nNiardo|BS|F884|25050\nNibbiola|NO|F886|28070\nNibionno|LC|F887|23895\nNichelino|TO|F889|10042\nNicolosi|CT|F890|95030\nNicorvo|PV|F891|27020\nNicosia|EN|F892|94014\nNicotera|VV|F893|89844\nNiella Belbo|CN|F894|12050\nNiella Tanaro|CN|F895|12060\nNimis|UD|F898|33045\nNiscemi|CL|F899|93015\nNissoria|EN|F900|94010\nNizza di Sicilia|ME|F901|98026\nNizza Monferrato|AT|F902|14049\nNoale|VE|F904|30033\nNoasca|TO|F906|10080\nNocara|CS|F907|87070\nNocciano|PE|F908|65010\nNocera Inferiore|SA|F912|84014\nNocera Superiore|SA|F913|84015\nNocera Terinese|CZ|F910|88047\nNocera Umbra|PG|F911|06025\nNoceto|PR|F914|43015\nNoci|BA|F915|70015\nNociglia|LE|F916|73020\nNoepoli|PZ|F917|85035\nNogara|VR|F918|37054\nNogaredo|TN|F920|38060\nNogarole Rocca|VR|F921|37060\nNogarole Vicentino|VI|F922|36070\nNoicattaro|BA|F923|70016\nNola|NA|F924|80035\nNole|TO|F925|10076\nNoli|SV|F926|17026\nNomaglio|TO|F927|10010\nNomi|TN|F929|38060\nNonantola|MO|F930|41015\nNone|TO|F931|10060\nNonio|VB|F932|28891\nNoragugume|NU|F933|08010\nNorbello|OR|F934|09070\nNorcia|PG|F935|06046\nNorma|LT|F937|04010\nNosate|MI|F939|20020\nNotaresco|TE|F942|64024\nNoto|SR|F943|96017\nNova Levante|BZ|F949|39056\nNova Milanese|MB|F944|20834\nNova Ponente|BZ|F950|39050\nNova Siri|MT|A942|75020\nNovafeltria|RN|F137|47863\nNovaledo|TN|F947|38050\nNovalesa|TO|F948|10050\nNovara di Sicilia|ME|F951|98058\nNovara|NO|F952|28100\nNovate Mezzola|SO|F956|23025\nNovate Milanese|MI|F955|20026\nNove|VI|F957|36055\nNovedrate|CO|F958|22060\nNovella|TN|M430|38020-38021,38028\nNovellara|RE|F960|42017\nNovello|CN|F961|12060\nNoventa di Piave|VE|F963|30020\nNoventa Padovana|PD|F962|35027\nNoventa Vicentina|VI|F964|36025\nNovi di Modena|MO|F966|41016\nNovi Ligure|AL|F965|15067\nNovi Velia|SA|F967|84060\nNoviglio|MI|F968|20082\nNovoli|LE|F970|73051\nNucetto|CN|F972|12070\nNughedu San Nicolò|SS|F975|07010\nNughedu Santa Vittoria|OR|F974|09080\nNule|SS|F976|07010\nNulvi|SS|F977|07032\nNumana|AN|F978|60026\nNuoro|NU|F979|08100\nNurachi|OR|F980|09070\nNuragus|SU|F981|09057\nNurallao|SU|F982|09058\nNuraminis|SU|F983|09024\nNureci|OR|F985|09080\nNurri|SU|F986|09059\nNus|AO|F987|11020\nNusco|AV|F988|83051\nNuvolento|BS|F989|25080\nNuvolera|BS|F990|25080\nNuxis|SU|F991|09010\nOcchieppo Inferiore|BI|F992|13897\nOcchieppo Superiore|BI|F993|13898\nOcchiobello|RO|F994|45030\nOccimiano|AL|F995|15040\nOcre|AQ|F996|67040\nOdalengo Grande|AL|F997|15020\nOdalengo Piccolo|AL|F998|15020\nOderzo|TV|F999|31046\nOdolo|BS|G001|25076\nOfena|AQ|G002|67025\nOffagna|AN|G003|60020\nOffanengo|CR|G004|26010\nOffida|AP|G005|63073\nOfflaga|BS|G006|25020\nOggebbio|VB|G007|28824\nOggiona con Santo Stefano|VA|G008|21040\nOggiono|LC|G009|23848\nOglianico|TO|G010|10080\nOgliastro Cilento|SA|G011|84061\nOlbia|SS|G015|07026\nOlcenengo|VC|G016|13047\nOldenico|VC|G018|13030\nOleggio Castello|NO|G020|28040\nOleggio|NO|G019|28047\nOlevano di Lomellina|PV|G021|27020\nOlevano Romano|RM|G022|00035\nOlevano sul Tusciano|SA|G023|84062\nOlgiate Comasco|CO|G025|22077\nOlgiate Molgora|LC|G026|23887\nOlgiate Olona|VA|G028|21057\nOlginate|LC|G030|23854\nOliena|NU|G031|08025\nOliva Gessi|PV|G032|27050\nOlivadi|CZ|G034|88067\nOliveri|ME|G036|98060\nOliveto Citra|SA|G039|84020\nOliveto Lario|LC|G040|23865\nOliveto Lucano|MT|G037|75010\nOlivetta San Michele|IM|G041|18030\nOlivola|AL|G042|15030\nOllastra|OR|G043|09088\nOllolai|NU|G044|08020\nOllomont|AO|G045|11010\nOlmedo|SS|G046|07040\nOlmeneta|CR|G047|26010\nOlmo al Brembo|BG|G049|24010\nOlmo Gentile|AT|G048|14050\nOltre il Colle|BG|G050|24013\nOltressenda Alta|BG|G054|24020\nOltrona di San Mamette|CO|G056|22070\nOlzai|NU|G058|08020\nOme|BS|G061|25050\nOmegna|VB|G062|28887\nOmignano|SA|G063|84060\nOnanì|NU|G064|08020\nOnano|VT|G065|01010\nOncino|CN|G066|12030\nOneta|BG|G068|24020\nOnifai|NU|G070|08020\nOniferi|NU|G071|08020\nOno San Pietro|BS|G074|25040\nOnore|BG|G075|24020\nOnzo|SV|G076|17037\nOpera|MI|G078|20090\nOpi|AQ|G079|67030\nOppeano|VR|G080|37050\nOppido Lucano|PZ|G081|85015\nOppido Mamertina|RC|G082|89014\nOra|BZ|G083|39040\nOrani|NU|G084|08026\nOratino|CB|G086|86010\nOrbassano|TO|G087|10043\nOrbetello|GR|G088|58015\nOrciano Pisano|PI|G090|56040\nOrco Feglino|SV|D522|17024\nOrdona|FG|M266|71040\nOrero|GE|G093|16040\nOrgiano|VI|G095|36040\nOrgosolo|NU|G097|08027\nOria|BR|G098|72024\nOricola|AQ|G102|67063\nOriggio|VA|G103|21040\nOrino|VA|G105|21030\nOrio al Serio|BG|G108|24050\nOrio Canavese|TO|G109|10010\nOrio Litta|LO|G107|26863\nOriolo Romano|VT|G111|01010\nOriolo|CS|G110|87073\nOristano|OR|G113|09170\nOrmea|CN|G114|12078\nOrmelle|TV|G115|31024\nOrnago|MB|G116|20876\nOrnavasso|VB|G117|28877\nOrnica|BG|G118|24010\nOrosei|NU|G119|08028\nOrotelli|NU|G120|08020\nOrria|SA|G121|84060\nOrroli|SU|G122|09061\nOrsago|TV|G123|31010\nOrsara Bormida|AL|G124|15010\nOrsara di Puglia|FG|G125|71027\nOrsenigo|CO|G126|22030\nOrsogna|CH|G128|66036\nOrsomarso|CS|G129|87020\nOrta di Atella|CE|G130|81030\nOrta Nova|FG|G131|71045\nOrta San Giulio|NO|G134|28016\nOrtacesus|SU|G133|09040\nOrte|VT|G135|01028\nOrtelle|LE|G136|73030\nOrtezzano|FM|G137|63851\nOrtignano Raggiolo|AR|G139|52010\nOrtisei|BZ|G140|39046\nOrtona dei Marsi|AQ|G142|67050\nOrtona|CH|G141|66026\nOrtovero|SV|G144|17037\nOrtucchio|AQ|G145|67050\nOrtueri|NU|G146|08036\nOrune|NU|G147|08020\nOrvieto|TR|G148|05018\nOrvinio|RI|B595|02035\nOrzinuovi|BS|G149|25034\nOrzivecchi|BS|G150|25030\nOsasco|TO|G151|10060\nOsasio|TO|G152|10040\nOschiri|SS|G153|07027\nOsidda|NU|G154|08020\nOsiglia|SV|G155|17010\nOsilo|SS|G156|07033\nOsimo|AN|G157|60027\nOsini|NU|G158|08040\nOsio Sopra|BG|G159|24040\nOsio Sotto|BG|G160|24046\nOsnago|LC|G161|23875\nOsoppo|UD|G163|33010\nOspedaletti|IM|G164|18014\nOspedaletto d'Alpinolo|AV|G165|83014\nOspedaletto Euganeo|PD|G167|35045\nOspedaletto Lodigiano|LO|G166|26864\nOspedaletto|TN|G168|38050\nOspitale di Cadore|BL|G169|32010\nOspitaletto|BS|G170|25035\nOssago Lodigiano|LO|G171|26816\nOssana|TN|G173|38026\nOssi|SS|G178|07045\nOssimo|BS|G179|25050\nOssona|MI|G181|20010\nOstana|CN|G183|12030\nOstellato|FE|G184|44020\nOstiano|CR|G185|26032\nOstiglia|MN|G186|46035\nOstra Vetere|AN|F581|60010\nOstra|AN|F401|60010\nOstuni|BR|G187|72017\nOtranto|LE|G188|73028\nOtricoli|TR|G189|05030\nOttana|NU|G191|08020\nOttati|SA|G192|84020\nOttaviano|NA|G190|80044\nOttiglio|AL|G193|15038\nOttobiano|PV|G194|27030\nOttone|PC|G195|29026\nOulx|TO|G196|10056\nOvada|AL|G197|15076\nOvaro|UD|G198|33025\nOviglio|AL|G199|15026\nOvindoli|AQ|G200|67046\nOvodda|NU|G201|08020\nOyace|AO|G012|11010\nOzegna|TO|G202|10080\nOzieri|SS|G203|07014\nOzzano dell'Emilia|BO|G205|40064\nOzzano Monferrato|AL|G204|15039\nOzzero|MI|G206|20080\nPabillonis|SU|G207|09030\nPace del Mela|ME|G209|98042\nPaceco|TP|G208|91027\nPacentro|AQ|G210|67030\nPachino|SR|G211|96018\nPaciano|PG|G212|06060\nPadenghe sul Garda|BS|G213|25080\nPaderna|AL|G215|15050\nPaderno d'Adda|LC|G218|23877\nPaderno Dugnano|MI|G220|20037\nPaderno Franciacorta|BS|G217|25050\nPaderno Ponchielli|CR|G222|26024\nPadova|PD|G224|35121-35143\nPadria|SS|G225|07015\nPadru|SS|M301|07020\nPadula|SA|G226|84034\nPaduli|BN|G227|82020\nPaesana|CN|G228|12034\nPaese|TV|G229|31038\nPagani|SA|G230|84016\nPaganico Sabino|RI|G232|02020\nPagazzano|BG|G233|24040\nPagliara|ME|G234|98020\nPaglieta|CH|G237|66020\nPagnacco|UD|G238|33010\nPagno|CN|G240|12030\nPagnona|LC|G241|23833\nPago del Vallo di Lauro|AV|G242|83020\nPago Veiano|BN|G243|82020\nPaisco Loveno|BS|G247|25050\nPaitone|BS|G248|25080\nPaladina|BG|G249|24030\nPalagano|MO|G250|41046\nPalagianello|TA|G251|74018\nPalagiano|TA|G252|74019\nPalagonia|CT|G253|95046\nPalaia|PI|G254|56036\nPalanzano|PR|G255|43025\nPalata|CB|G257|86037\nPalau|SS|G258|07020\nPalazzago|BG|G259|24030\nPalazzo Adriano|PA|G263|90030\nPalazzo Canavese|TO|G262|10010\nPalazzo Pignano|CR|G260|26020\nPalazzo San Gervasio|PZ|G261|85026\nPalazzolo Acreide|SR|G267|96010\nPalazzolo dello Stella|UD|G268|33056\nPalazzolo sull'Oglio|BS|G264|25036\nPalazzolo Vercellese|VC|G266|13040\nPalazzuolo sul Senio|FI|G270|50035\nPalena|CH|G271|66017\nPalermiti|CZ|G272|88050\nPalermo|PA|G273|90121-90151\nPalestrina|RM|G274|00036\nPalestro|PV|G275|27030\nPaliano|FR|G276|03018\nPalizzi|RC|G277|89038\nPallagorio|KR|G278|88818\nPallanzeno|VB|G280|28884\nPallare|SV|G281|17043\nPalma Campania|NA|G283|80036\nPalma di Montechiaro|AG|G282|92020\nPalmanova|UD|G284|33057\nPalmariggi|LE|G285|73020\nPalmas Arborea|OR|G286|09090\nPalmi|RC|G288|89015\nPalmiano|AP|G289|63092\nPalmoli|CH|G290|66050\nPalo del Colle|BA|G291|70027\nPalombara Sabina|RM|G293|00018\nPalombaro|CH|G294|66010\nPalomonte|SA|G292|84020\nPalosco|BG|G295|24050\nPalù del Fersina|TN|G296|38050\nPalù|VR|G297|37050\nPaludi|CS|G298|87060\nPaluzza|UD|G300|33026\nPamparato|CN|G302|12087\nPancalieri|TO|G303|10060\nPancarana|PV|G304|27050\nPanchià|TN|G305|38030\nPandino|CR|G306|26025\nPanettieri|CS|G307|87050\nPanicale|PG|G308|06064\nPannarano|BN|G311|82017\nPanni|FG|G312|71020\nPantelleria|TP|G315|91017\nPantigliate|MI|G316|20090\nPaola|CS|G317|87027\nPaolisi|BN|G318|82011\nPapasidero|CS|G320|87020\nPapozze|RO|G323|45010\nParabiago|MI|G324|20015\nParabita|LE|G325|73052\nParatico|BS|G327|25030\nParcines|BZ|G328|39020\nParella|TO|G330|10010\nParenti|CS|G331|87040\nParete|CE|G333|81030\nPareto|AL|G334|15010\nParghelia|VV|G335|89861\nParlasco|LC|G336|23837\nParma|PR|G337|43121-43126\nParodi Ligure|AL|G338|15060\nParoldo|CN|G339|12070\nParolise|AV|G340|83050\nParona|PV|G342|27020\nParrano|TR|G344|05010\nParre|BG|G346|24020\nPartanna|TP|G347|91028\nPartinico|PA|G348|90047\nParuzzaro|NO|G349|28040\nParzanica|BG|G350|24060\nPasian di Prato|UD|G352|33037\nPasiano di Pordenone|PN|G353|33087\nPaspardo|BS|G354|25050\nPasserano Marmorito|AT|G358|14020\nPassignano sul Trasimeno|PG|G359|06065\nPassirano|BS|G361|25050\nPastena|FR|G362|03020\nPastorano|CE|G364|81050\nPastrengo|VR|G365|37010\nPasturana|AL|G367|15060\nPasturo|LC|G368|23818\nPaterno Calabro|CS|G372|87040\nPaternò|CT|G371|95047\nPaterno|PZ|M269|85050\nPaternopoli|AV|G370|83052\nPatrica|FR|G374|03010\nPattada|SS|G376|07016\nPatti|ME|G377|98066\nPatù|LE|G378|73053\nPau|OR|G379|09090\nPaularo|UD|G381|33027\nPauli Arbarei|SU|G382|09020\nPaulilatino|OR|G384|09070\nPaullo|MI|G385|20067\nPaupisi|BN|G386|82030\nPavarolo|TO|G387|10020\nPavia di Udine|UD|G389|33050\nPavia|PV|G388|27100\nPavone Canavese|TO|G392|10018\nPavone del Mella|BS|G391|25020\nPavullo nel Frignano|MO|G393|41026\nPazzano|RC|G394|89040\nPeccioli|PI|G395|56037\nPecetto di Valenza|AL|G397|15040\nPecetto Torinese|TO|G398|10020\nPedara|CT|G402|95030\nPedaso|FM|G403|63827\nPedavena|BL|G404|32034\nPedemonte|VI|G406|36040\nPederobba|TV|G408|31040\nPedesina|SO|G410|23010\nPedivigliano|CS|G411|87050\nPedrengo|BG|G412|24066\nPeglio|CO|G415|22010\nPeglio|PU|G416|61049\nPegognaga|MN|G417|46020\nPeia|BG|G418|24020\nPeio|TN|G419|38024\nPelago|FI|G420|50060\nPella|NO|G421|28010\nPellegrino Parmense|PR|G424|43047\nPellezzano|SA|G426|84080\nPellizzano|TN|G428|38020\nPelugo|TN|G429|38079\nPenango|AT|G430|14030\nPenna in Teverina|TR|G432|05028\nPenna San Giovanni|MC|G436|62020\nPenna Sant'Andrea|TE|G437|64039\nPennabilli|RN|G433|47864\nPennadomo|CH|G434|66040\nPennapiedimonte|CH|G435|66010\nPenne|PE|G438|65017\nPentone|CZ|G439|88050\nPerano|CH|G441|66040\nPerarolo di Cadore|BL|G442|32010\nPerca|BZ|G443|39030\nPercile|RM|G444|00020\nPerdasdefogu|NU|G445|08046\nPerdaxius|SU|G446|09010\nPerdifumo|SA|G447|84060\nPereto|AQ|G449|67064\nPerfugas|SS|G450|07034\nPergine Valsugana|TN|G452|38057\nPergola|PU|G453|61045\nPerinaldo|IM|G454|18032\nPerito|SA|G455|84060\nPerledo|LC|G456|23828\nPerletto|CN|G457|12070\nPerlo|CN|G458|12070\nPerloz|AO|G459|11020\nPernumia|PD|G461|35020\nPero|MI|C013|20016\nPerosa Argentina|TO|G463|10063\nPerosa Canavese|TO|G462|10010\nPerrero|TO|G465|10060\nPersico Dosimo|CR|G469|26043\nPertengo|VC|G471|13030\nPertica Alta|BS|G474|25070\nPertica Bassa|BS|G475|25078\nPertosa|SA|G476|84030\nPertusio|TO|G477|10080\nPerugia|PG|G478|06121-06135\nPesaro|PU|G479|61121-61122\nPescaglia|LU|G480|55064\nPescantina|VR|G481|37026\nPescara|PE|G482|65121-65129\nPescarolo ed Uniti|CR|G483|26033\nPescasseroli|AQ|G484|67032\nPescate|LC|G485|23855\nPesche|IS|G486|86090\nPeschici|FG|G487|71010\nPeschiera Borromeo|MI|G488|20068\nPeschiera del Garda|VR|G489|37019\nPescia|PT|G491|51017\nPescina|AQ|G492|67057\nPesco Sannita|BN|G494|82020\nPescocostanzo|AQ|G493|67033\nPescolanciano|IS|G495|86097\nPescopagano|PZ|G496|85020\nPescopennataro|IS|G497|86080\nPescorocchiano|RI|G498|02024\nPescosansonesco|PE|G499|65020\nPescosolido|FR|G500|03030\nPessano con Bornago|MI|G502|20060\nPessina Cremonese|CR|G504|26030\nPessinetto|TO|G505|10070\nPetacciato|CB|G506|86038\nPetilia Policastro|KR|G508|88837\nPetina|SA|G509|84020\nPetralia Soprana|PA|G510|90026\nPetralia Sottana|PA|G511|90027\nPetrella Salto|RI|G513|02025\nPetrella Tifernina|CB|G512|86024\nPetriano|PU|G514|61020\nPetriolo|MC|G515|62014\nPetritoli|FM|G516|63848\nPetrizzi|CZ|G517|88060\nPetronà|CZ|G518|88050\nPetrosino|TP|M281|91020\nPetruro Irpino|AV|G519|83010\nPettenasco|NO|G520|28028\nPettinengo|BI|G521|13843\nPettineo|ME|G522|98070\nPettoranello del Molise|IS|G523|86090\nPettorano sul Gizio|AQ|G524|67034\nPettorazza Grimani|RO|G525|45010\nPeveragno|CN|G526|12016\nPezzana|VC|G528|13010\nPezzaze|BS|G529|25060\nPezzolo Valle Uzzone|CN|G532|12070\nPiacenza d'Adige|PD|G534|35040\nPiacenza|PC|G535|29121-29122\nPiadena Drizzona|CR|M418|26034\nPiaggine|SA|G538|84065\nPian Camuno|BS|G546|25050\nPiana Crixia|SV|G542|17058\nPiana degli Albanesi|PA|G543|90037\nPiana di Monte Verna|CE|G541|81013\nPiancastagnaio|SI|G547|53025\nPiancogno|BS|G549|25052\nPiandimeleto|PU|G551|61026\nPiane Crati|CS|G553|87050\nPianella|PE|G555|65019\nPianello del Lario|CO|G556|22010\nPianello Val Tidone|PC|G557|29010\nPianengo|CR|G558|26010\nPianezza|TO|G559|10044\nPianezze|VI|G560|36060\nPianfei|CN|G561|12080\nPianico|BG|G564|24060\nPianiga|VE|G565|30030\nPiano di Sorrento|NA|G568|80063\nPianopoli|CZ|D546|88040\nPianoro|BO|G570|40065\nPiansano|VT|G571|01010\nPiantedo|SO|G572|23010\nPiario|BG|G574|24020\nPiasco|CN|G575|12026\nPiateda|SO|G576|23020\nPiatto|BI|G577|13844\nPiazza al Serchio|LU|G582|55035\nPiazza Armerina|EN|G580|94015\nPiazza Brembana|BG|G579|24014\nPiazzatorre|BG|G583|24010\nPiazzola sul Brenta|PD|G587|35016\nPiazzolo|BG|G588|24010\nPicciano|PE|G589|65010\nPicerno|PZ|G590|85055\nPicinisco|FR|G591|03040\nPico|FR|G592|03020\nPiea|AT|G593|14020\nPiedicavallo|BI|G594|13812\nPiedimonte Etneo|CT|G597|95017\nPiedimonte Matese|CE|G596|81016\nPiedimonte San Germano|FR|G598|03030\nPiedimulera|VB|G600|28885\nPiegaro|PG|G601|06066\nPienza|SI|G602|53026\nPieranica|CR|G603|26017\nPietra de' Giorgi|PV|G612|27040\nPietra Ligure|SV|G605|17027\nPietra Marazzi|AL|G619|15040\nPietrabbondante|IS|G606|86085\nPietrabruna|IM|G607|18010\nPietracamela|TE|G608|64047\nPietracatella|CB|G609|86040\nPietracupa|CB|G610|86020\nPietradefusi|AV|G611|83030\nPietraferrazzana|CH|G613|66040\nPietrafitta|CS|G615|87050\nPietragalla|PZ|G616|85016\nPietralunga|PG|G618|06026\nPietramelara|CE|G620|81051\nPietramontecorvino|FG|G604|71038\nPietranico|PE|G621|65020\nPietrapaola|CS|G622|87060\nPietrapertosa|PZ|G623|85010\nPietraperzia|EN|G624|94016\nPietraporzio|CN|G625|12010\nPietraroja|BN|G626|82030\nPietrarubbia|PU|G627|61023\nPietrasanta|LU|G628|55045\nPietrastornina|AV|G629|83015\nPietravairano|CE|G630|81040\nPietrelcina|BN|G631|82020\nPieve a Nievole|PT|G636|51018\nPieve Albignola|PV|G635|27030\nPieve d'Olmi|CR|G647|26040\nPieve del Cairo|PV|G639|27037\nPieve del Grappa|TV|M422|31017\nPieve di Bono-Prezzo|TN|M365|38085\nPieve di Cadore|BL|G642|32044\nPieve di Cento|BO|G643|40066\nPieve di Soligo|TV|G645|31053\nPieve di Teco|IM|G632|18026\nPieve Emanuele|MI|G634|20090\nPieve Fissiraga|LO|G096|26854\nPieve Fosciana|LU|G648|55036\nPieve Ligure|GE|G646|16031\nPieve Porto Morone|PV|G650|27017\nPieve San Giacomo|CR|G651|26035\nPieve Santo Stefano|AR|G653|52036\nPieve Tesino|TN|G656|38050\nPieve Torina|MC|G657|62036\nPieve Vergonte|VB|G658|28886\nPievepelago|MO|G649|41027\nPiglio|FR|G659|03010\nPigna|IM|G660|18037\nPignataro Interamna|FR|G662|03040\nPignataro Maggiore|CE|G661|81052\nPignola|PZ|G663|85010\nPignone|SP|G664|19020\nPigra|CO|G665|22020\nPila|VC|G666|13020\nPimentel|SU|G669|09020\nPimonte|NA|G670|80050\nPinarolo Po|PV|G671|27040\nPinasca|TO|G672|10060\nPincara|RO|G673|45020\nPinerolo|TO|G674|10064\nPineto|TE|F831|64025\nPino d'Asti|AT|G676|14020\nPino Torinese|TO|G678|10025\nPinzano al Tagliamento|PN|G680|33094\nPinzolo|TN|G681|38086\nPiobbico|PU|G682|61046\nPiobesi d'Alba|CN|G683|12040\nPiobesi Torinese|TO|G684|10040\nPiode|VC|G685|13020\nPioltello|MI|G686|20096\nPiombino Dese|PD|G688|35017\nPiombino|LI|G687|57025\nPioraco|MC|G690|62025\nPiossasco|TO|G691|10045\nPiovà Massaia|AT|G692|14026\nPiove di Sacco|PD|G693|35028\nPiovene Rocchette|VI|G694|36013\nPiozzano|PC|G696|29010\nPiozzo|CN|G697|12060\nPiraino|ME|G699|98060\nPisa|PI|G702|56121-56128\nPisano|NO|G703|28010\nPiscina|TO|G705|10060\nPiscinas|SU|M291|09010\nPisciotta|SA|G707|84066\nPisogne|BS|G710|25055\nPisoniano|RM|G704|00020\nPisticci|MT|G712|75015\nPistoia|PT|G713|51100\nPitigliano|GR|G716|58017\nPiubega|MN|G717|46040\nPiuro|SO|G718|23020\nPiverone|TO|G719|10010\nPizzale|PV|G720|27050\nPizzighettone|CR|G721|26026\nPizzo|VV|G722|89812\nPizzoferrato|CH|G724|66040\nPizzoli|AQ|G726|67017\nPizzone|IS|G727|86071\nPizzoni|VV|G728|89834\nPlacanica|RC|G729|89040\nPlataci|CS|G733|87070\nPlatania|CZ|G734|88040\nPlatì|RC|G735|89039\nPlaus|BZ|G299|39025\nPlesio|CO|G737|22010\nPloaghe|SS|G740|07017\nPlodio|SV|G741|17043\nPocapaglia|CN|G742|12060\nPocenia|UD|G743|33050\nPodenzana|MS|G746|54010\nPodenzano|PC|G747|29027\nPofi|FR|G749|03026\nPoggiardo|LE|G751|73037\nPoggibonsi|SI|G752|53036\nPoggio a Caiano|PO|G754|59016\nPoggio Bustone|RI|G756|02018\nPoggio Catino|RI|G757|02040\nPoggio Imperiale|FG|G761|71010\nPoggio Mirteto|RI|G763|02047\nPoggio Moiano|RI|G764|02037\nPoggio Nativo|RI|G765|02030\nPoggio Picenze|AQ|G766|67026\nPoggio Renatico|FE|G768|44028\nPoggio Rusco|MN|G753|46025\nPoggio San Lorenzo|RI|G770|02030\nPoggio San Marcello|AN|G771|60030\nPoggio San Vicino|MC|D566|62021\nPoggio Sannita|IS|B317|86086\nPoggio Torriana|RN|M324|47824\nPoggiodomo|PG|G758|06040\nPoggiofiorito|CH|G760|66030\nPoggiomarino|NA|G762|80040\nPoggioreale|TP|G767|91020\nPoggiorsini|BA|G769|70020\nPoggiridenti|SO|G431|23020\nPogliano Milanese|MI|G772|20010\nPognana Lario|CO|G773|22020\nPognano|BG|G774|24040\nPogno|NO|G775|28076\nPoirino|TO|G777|10046\nPojana Maggiore|VI|G776|36026\nPolaveno|BS|G779|25060\nPolcenigo|PN|G780|33070\nPolesella|RO|G782|45038\nPolesine Zibello|PR|M367|43016\nPoli|RM|G784|00010\nPolia|VV|G785|89813\nPolicoro|MT|G786|75025\nPolignano a Mare|BA|G787|70044\nPolinago|MO|G789|41040\nPolino|TR|G790|05030\nPolistena|RC|G791|89024\nPolizzi Generosa|PA|G792|90028\nPolla|SA|G793|84035\nPollein|AO|G794|11020\nPollena Trocchia|NA|G795|80040\nPollenza|MC|F567|62010\nPollica|SA|G796|84068\nPollina|PA|G797|90010\nPollone|BI|G798|13814\nPollutri|CH|G799|66020\nPolonghera|CN|G800|12030\nPolpenazze del Garda|BS|G801|25080\nPolverara|PD|G802|35020\nPolverigi|AN|G803|60020\nPomarance|PI|G804|56045\nPomaretto|TO|G805|10063\nPomarico|MT|G806|75016\nPomaro Monferrato|AL|G807|15040\nPomarolo|TN|G808|38060\nPombia|NO|G809|28050\nPomezia|RM|G811|00071\nPomigliano d'Arco|NA|G812|80038\nPompei|NA|G813|80045\nPompeiana|IM|G814|18015\nPompiano|BS|G815|25030\nPomponesco|MN|G816|46030\nPompu|OR|G817|09093\nPoncarale|BS|G818|25020\nPonderano|BI|G820|13875\nPonna|CO|G821|22020\nPonsacco|PI|G822|56038\nPonso|PD|G823|35040\nPont-Canavese|TO|G826|10085\nPont-Saint-Martin|AO|G854|11026\nPontassieve|FI|G825|50065\nPontboset|AO|G545|11020\nPonte Buggianese|PT|G833|51019\nPonte dell'Olio|PC|G842|29028\nPonte di Legno|BS|G844|25056\nPonte di Piave|TV|G846|31047\nPonte Gardena|BZ|G830|39040\nPonte in Valtellina|SO|G829|23026\nPonte Lambro|CO|G847|22037\nPonte nelle Alpi|BL|B662|32014\nPonte Nizza|PV|G851|27050\nPonte Nossa|BG|F941|24028\nPonte San Nicolò|PD|G855|35020\nPonte San Pietro|BG|G856|24036\nPonte|BN|G827|82030\nPontebba|UD|G831|33016\nPontecagnano Faiano|SA|G834|84098\nPontecchio Polesine|RO|G836|45030\nPontechianale|CN|G837|12020\nPontecorvo|FR|G838|03037\nPontecurone|AL|G839|15055\nPontedassio|IM|G840|18027\nPontedera|PI|G843|56025\nPontelandolfo|BN|G848|82027\nPontelatone|CE|G849|81040\nPontelongo|PD|G850|35029\nPontenure|PC|G852|29010\nPonteranica|BG|G853|24010\nPontestura|AL|G858|15027\nPontevico|BS|G859|25026\nPontey|AO|G860|11024\nPonti sul Mincio|MN|G862|46040\nPonti|AL|G861|15010\nPontida|BG|G864|24030\nPontinia|LT|G865|04014\nPontinvrea|SV|G866|17042\nPontirolo Nuovo|BG|G867|24040\nPontoglio|BS|G869|25037\nPontremoli|MS|G870|54027\nPonza|LT|G871|04027\nPonzano di Fermo|FM|G873|63845\nPonzano Monferrato|AL|G872|15020\nPonzano Romano|RM|G874|00060\nPonzano Veneto|TV|G875|31050\nPonzone|AL|G877|15010\nPopoli|PE|G878|65026\nPoppi|AR|G879|52014\nPorano|TR|G881|05010\nPorcari|LU|G882|55016\nPorcia|PN|G886|33080\nPordenone|PN|G888|33170\nPorlezza|CO|G889|22018\nPornassio|IM|G890|18024\nPorpetto|UD|G891|33050\nPortacomaro|AT|G894|14037\nPortalbera|PV|G895|27040\nPorte di Rendena|TN|M358|38094\nPorte|TO|G900|10060\nPortici|NA|G902|80055\nPortico di Caserta|CE|G903|81050\nPortico e San Benedetto|FC|G904|47010\nPortigliola|RC|G905|89040\nPorto Azzurro|LI|E680|57036\nPorto Ceresio|VA|G906|21050\nPorto Cesareo|LE|M263|73010\nPorto Empedocle|AG|F299|92014\nPorto Mantovano|MN|G917|46047\nPorto Recanati|MC|G919|62017\nPorto San Giorgio|FM|G920|63822\nPorto Sant'Elpidio|FM|G921|63821\nPorto Tolle|RO|G923|45018\nPorto Torres|SS|G924|07046\nPorto Valtravaglia|VA|G907|21010\nPorto Viro|RO|G926|45014\nPortobuffolè|TV|G909|31040\nPortocannone|CB|G910|86045\nPortoferraio|LI|G912|57037\nPortofino|GE|G913|16034\nPortogruaro|VE|G914|30026\nPortomaggiore|FE|G916|44015\nPortopalo di Capo Passero|SR|M257|96010\nPortoscuso|SU|G922|09010\nPortovenere|SP|G925|19025\nPortula|BI|G927|13833\nPosada|NU|G929|08020\nPosina|VI|G931|36010\nPositano|SA|G932|84017\nPossagno|TV|G933|31054\nPosta Fibreno|FR|G935|03030\nPosta|RI|G934|02019\nPostal|BZ|G936|39014\nPostalesio|SO|G937|23010\nPostiglione|SA|G939|84026\nPostua|VC|G940|13010\nPotenza Picena|MC|F632|62018\nPotenza|PZ|G942|85100\nPove del Grappa|VI|G943|36020\nPovegliano Veronese|VR|G945|37064\nPovegliano|TV|G944|31050\nPoviglio|RE|G947|42028\nPovoletto|UD|G949|33040\nPozzaglia Sabina|RI|G951|02030\nPozzaglio ed Uniti|CR|B914|26010\nPozzallo|RG|G953|97016\nPozzilli|IS|G954|86077\nPozzo d'Adda|MI|G955|20060\nPozzol Groppo|AL|G960|15050\nPozzolengo|BS|G959|25010\nPozzoleone|VI|G957|36050\nPozzolo Formigaro|AL|G961|15068\nPozzomaggiore|SS|G962|07018\nPozzonovo|PD|G963|35020\nPozzuoli|NA|G964|80078\nPozzuolo del Friuli|UD|G966|33050\nPozzuolo Martesana|MI|G965|20060\nPradalunga|BG|G968|24020\nPradamano|UD|G969|33040\nPradleves|CN|G970|12027\nPragelato|TO|G973|10060\nPraia a Mare|CS|G975|87028\nPraiano|SA|G976|84010\nPralboino|BS|G977|25020\nPrali|TO|G978|10060\nPralormo|TO|G979|10040\nPralungo|BI|G980|13899\nPramaggiore|VE|G981|30020\nPramollo|TO|G982|10065\nPrarolo|VC|G985|13012\nPrarostino|TO|G986|10060\nPrasco|AL|G987|15010\nPrascorsano|TO|G988|10080\nPrata Camportaccio|SO|G993|23020\nPrata d'Ansidonia|AQ|G992|67020\nPrata di Pordenone|PN|G994|33080\nPrata di Principato Ultra|AV|G990|83030\nPrata Sannita|CE|G991|81010\nPratella|CE|G995|81010\nPratiglione|TO|G997|10080\nPrato allo Stelvio|BZ|H004|39026\nPrato Carnico|UD|H002|33020\nPrato Sesia|NO|H001|28077\nPrato|PO|G999|59100\nPratola Peligna|AQ|H007|67035\nPratola Serra|AV|H006|83039\nPratovecchio Stia|AR|M329|52015\nPravisdomini|PN|H010|33076\nPray|BI|G974|13867\nPrazzo|CN|H011|12028\nPré-Saint-Didier|AO|H042|11010\nPrecenicco|UD|H014|33050\nPreci|PG|H015|06047\nPredaia|TN|M344|38012\nPredappio|FC|H017|47016\nPredazzo|TN|H018|38037\nPredoi|BZ|H019|39030\nPredore|BG|H020|24060\nPredosa|AL|H021|15077\nPreganziol|TV|H022|31022\nPregnana Milanese|MI|H026|20010\nPrelà|IM|H027|18020\nPremana|LC|H028|23834\nPremariacco|UD|H029|33040\nPremeno|VB|H030|28818\nPremia|VB|H033|28866\nPremilcuore|FC|H034|47010\nPremolo|BG|H036|24020\nPremosello-Chiovenda|VB|H037|28803\nPreone|UD|H038|33020\nPrepotto|UD|H040|33040\nPreseglie|BS|H043|25070\nPresenzano|CE|H045|81050\nPresezzo|BG|H046|24030\nPresicce-Acquarica|LE|M428|73054\nPressana|VR|H048|37040\nPretoro|CH|H052|66010\nPrevalle|BS|H055|25080\nPrezza|AQ|H056|67030\nPriero|CN|H059|12070\nPrignano Cilento|SA|H062|84060\nPrignano sulla Secchia|MO|H061|41048\nPrimaluna|LC|H063|23819\nPrimiero San Martino di Castrozza|TN|M359|38054\nPriocca|CN|H068|12040\nPriola|CN|H069|12070\nPriolo Gargallo|SR|M279|96010\nPriverno|LT|G698|04015\nPrizzi|PA|H070|90038\nProceno|VT|H071|01020\nProcida|NA|H072|80079\nPropata|GE|H073|16027\nProserpio|CO|H074|22030\nProssedi|LT|H076|04010\nProvaglio d'Iseo|BS|H078|25050\nProvaglio Val Sabbia|BS|H077|25070\nProves|BZ|H081|39040\nProvvidenti|CB|H083|86040\nPrunetto|CN|H085|12077\nPuegnago del Garda|BS|H086|25080\nPuglianello|BN|H087|82030\nPula|CA|H088|09050\nPulfero|UD|H089|33046\nPulsano|TA|H090|74026\nPumenengo|BG|H091|24050\nPusiano|CO|H094|22030\nPutifigari|SS|H095|07040\nPutignano|BA|H096|70017\nQuadrelle|AV|H097|83020\nQuadri|CH|H098|66040\nQuagliuzzo|TO|H100|10010\nQualiano|NA|H101|80019\nQuaranti|AT|H102|14040\nQuaregna Cerreto|BI|M414|13854\nQuargnento|AL|H104|15044\nQuarna Sopra|VB|H106|28898\nQuarna Sotto|VB|H107|28896\nQuarona|VC|H108|13017\nQuarrata|PT|H109|51039\nQuart|AO|H110|11020\nQuarto d'Altino|VE|H117|30020\nQuarto|NA|H114|80010\nQuartu Sant'Elena|CA|H118|09045\nQuartucciu|CA|H119|09044\nQuassolo|TO|H120|10010\nQuattordio|AL|H121|15028\nQuattro Castella|RE|H122|42020\nQuero Vas|BL|M332|32038\nQuiliano|SV|H126|17047\nQuincinetto|TO|H127|10010\nQuindici|AV|H128|83020\nQuingentole|MN|H129|46020\nQuintano|CR|H130|26017\nQuinto di Treviso|TV|H131|31055\nQuinto Vercellese|VC|H132|13030\nQuinto Vicentino|VI|H134|36050\nQuinzano d'Oglio|BS|H140|25027\nQuistello|MN|H143|46026\nRabbi|TN|H146|38020\nRacale|LE|H147|73055\nRacalmuto|AG|H148|92020\nRacconigi|CN|H150|12035\nRaccuja|ME|H151|98067\nRacines|BZ|H152|39040\nRadda in Chianti|SI|H153|53017\nRaddusa|CT|H154|95040\nRadicofani|SI|H156|53040\nRadicondoli|SI|H157|53030\nRaffadali|AG|H159|92015\nRagalna|CT|M287|95030\nRagogna|UD|H161|33030\nRagusa|RG|H163|97100\nRaiano|AQ|H166|67027\nRamacca|CT|H168|95040\nRancio Valcuvia|VA|H173|21030\nRanco|VA|H174|21020\nRandazzo|CT|H175|95036\nRanica|BG|H176|24020\nRanzanico|BG|H177|24060\nRanzo|IM|H180|18020\nRapagnano|FM|H182|63831\nRapallo|GE|H183|16035\nRapino|CH|H184|66010\nRapolano Terme|SI|H185|53040\nRapolla|PZ|H186|85027\nRapone|PZ|H187|85020\nRassa|VC|H188|13020\nRasun-Anterselva|BZ|H189|39030\nRasura|SO|H192|23010\nRavanusa|AG|H194|92029\nRavarino|MO|H195|41017\nRavascletto|UD|H196|33020\nRavello|SA|H198|84010\nRavenna|RA|H199|48121-48125\nRaveo|UD|H200|33029\nRaviscanina|CE|H202|81017\nRe|VB|H203|28856\nRea|PV|H204|27040\nRealmonte|AG|H205|92010\nReana del Rojale|UD|H206|33010\nReano|TO|H207|10090\nRecale|CE|H210|81020\nRecanati|MC|H211|62019\nRecco|GE|H212|16036\nRecetto|NO|H213|28060\nRecoaro Terme|VI|H214|36076\nRedavalle|PV|H216|27050\nRedondesco|MN|H218|46010\nRefrancore|AT|H219|14030\nRefrontolo|TV|H220|31020\nRegalbuto|EN|H221|94017\nReggello|FI|H222|50066\nReggio di Calabria|RC|H224|89121-89135\nReggio nell'Emilia|RE|H223|42121-42124\nReggiolo|RE|H225|42046\nReino|BN|H227|82020\nReitano|ME|H228|98070\nRemanzacco|UD|H229|33047\nRemedello|BS|H230|25010\nRenate|MB|H233|20838\nRende|CS|H235|87036\nRenon|BZ|H236|39054\nResana|TV|H238|31023\nRescaldina|MI|H240|20027\nResia|UD|H242|33010\nResiutta|UD|H244|33010\nResuttano|CL|H245|93010\nRetorbido|PV|H246|27050\nRevello|CN|H247|12036\nRevigliasco d'Asti|AT|H250|14010\nRevine Lago|TV|H253|31020\nRezzago|CO|H255|22030\nRezzato|BS|H256|25086\nRezzo|IM|H257|18026\nRezzoaglio|GE|H258|16048\nRhêmes-Notre-Dame|AO|H262|11010\nRhêmes-Saint-Georges|AO|H263|11010\nRho|MI|H264|20017\nRiace|RC|H265|89040\nRialto|SV|H266|17020\nRiano|RM|H267|00060\nRiardo|CE|H268|81053\nRibera|AG|H269|92016\nRibordone|TO|H270|10080\nRicadi|VV|H271|89866\nRicaldone|AL|H272|15010\nRiccia|CB|H273|86016\nRiccione|RN|H274|47838\nRiccò del Golfo di Spezia|SP|H275|19020\nRicengo|CR|H276|26010\nRicigliano|SA|H277|84020\nRiese Pio X|TV|H280|31039\nRiesi|CL|H281|93016\nRieti|RI|H282|02100\nRifiano|BZ|H284|39010\nRifreddo|CN|H285|12030\nRignano Flaminio|RM|H288|00068\nRignano Garganico|FG|H287|71010\nRignano sull'Arno|FI|H286|50067\nRigolato|UD|H289|33020\nRimella|VC|H293|13020\nRimini|RN|H294|47921-47924\nRio di Pusteria|BZ|H299|39037\nRio Saliceto|RE|H298|42010\nRio|LI|M391|57038\nRiofreddo|RM|H300|00020\nRiola Sardo|OR|H301|09070\nRiolo Terme|RA|H302|48025\nRiolunato|MO|H303|41020\nRiomaggiore|SP|H304|19017\nRionero in Vulture|PZ|H307|85028\nRionero Sannitico|IS|H308|86087\nRipa Teatina|CH|H320|66010\nRipabottoni|CB|H311|86040\nRipacandida|PZ|H312|85020\nRipalimosani|CB|H313|86025\nRipalta Arpina|CR|H314|26010\nRipalta Cremasca|CR|H315|26010\nRipalta Guerina|CR|H316|26010\nRiparbella|PI|H319|56046\nRipatransone|AP|H321|63065\nRipe San Ginesio|MC|H323|62020\nRipi|FR|H324|03027\nRiposto|CT|H325|95018\nRittana|CN|H326|12010\nRiva del Garda|TN|H330|38066\nRiva del Po|FE|M410|44033\nRiva di Solto|BG|H331|24060\nRiva Ligure|IM|H328|18015\nRiva presso Chieri|TO|H337|10020\nRivalba|TO|H333|10090\nRivalta Bormida|AL|H334|15010\nRivalta di Torino|TO|H335|10040\nRivamonte Agordino|BL|H327|32020\nRivanazzano Terme|PV|H336|27055\nRivara|TO|H338|10080\nRivarolo Canavese|TO|H340|10086\nRivarolo del Re ed Uniti|CR|H341|26036\nRivarolo Mantovano|MN|H342|46017\nRivarone|AL|H343|15040\nRivarossa|TO|H344|10040\nRive d'Arcano|UD|H347|33030\nRive|VC|H346|13030\nRivello|PZ|H348|85040\nRivergaro|PC|H350|29029\nRivignano Teor|UD|M317|33061\nRivisondoli|AQ|H353|67036\nRivodutri|RI|H354|02010\nRivoli Veronese|VR|H356|37010\nRivoli|TO|H355|10098\nRivolta d'Adda|CR|H357|26027\nRizziconi|RC|H359|89016\nRoana|VI|H361|36010\nRoaschia|CN|H362|12010\nRoascio|CN|H363|12073\nRoasio|VC|H365|13060\nRoatto|AT|H366|14018\nRobassomero|TO|H367|10070\nRobbiate|LC|G223|23899\nRobbio|PV|H369|27038\nRobecchetto con Induno|MI|H371|20020\nRobecco d'Oglio|CR|H372|26010\nRobecco Pavese|PV|H375|27042\nRobecco sul Naviglio|MI|H373|20087\nRobella|AT|H376|14020\nRobilante|CN|H377|12017\nRoburent|CN|H378|12080\nRocca Canavese|TO|H386|10070\nRocca Canterano|RM|H387|00020\nRocca Cigliè|CN|H391|12060\nRocca d'Arazzo|AT|H392|14030\nRocca d'Arce|FR|H393|03030\nRocca d'Evandro|CE|H398|81040\nRocca de' Baldi|CN|H395|12047\nRocca de' Giorgi|PV|H396|27040\nRocca di Botte|AQ|H399|67066\nRocca di Cambio|AQ|H400|67047\nRocca di Cave|RM|H401|00030\nRocca di Mezzo|AQ|H402|67048\nRocca di Neto|KR|H403|88821\nRocca di Papa|RM|H404|00040\nRocca Grimalda|AL|H414|15078\nRocca Imperiale|CS|H416|87074\nRocca Massima|LT|H421|04010\nRocca Pia|AQ|H429|67030\nRocca Pietore|BL|H379|32023\nRocca Priora|RM|H432|00079\nRocca San Casciano|FC|H437|47017\nRocca San Felice|AV|H438|83050\nRocca San Giovanni|CH|H439|66020\nRocca Santa Maria|TE|H440|64010\nRocca Santo Stefano|RM|H441|00030\nRocca Sinibalda|RI|H446|02026\nRocca Susella|PV|H450|27052\nRoccabascerana|AV|H382|83016\nRoccabernarda|KR|H383|88835\nRoccabianca|PR|H384|43010\nRoccabruna|CN|H385|12020\nRoccacasale|AQ|H389|67030\nRoccadaspide|SA|H394|84069\nRoccafiorita|ME|H405|98030\nRoccafluvione|AP|H390|63093\nRoccaforte del Greco|RC|H408|89060\nRoccaforte Ligure|AL|H406|15060\nRoccaforte Mondovì|CN|H407|12088\nRoccaforzata|TA|H409|74020\nRoccafranca|BS|H410|25030\nRoccagiovine|RM|H411|00020\nRoccagloriosa|SA|H412|84060\nRoccagorga|LT|H413|04010\nRoccalbegna|GR|H417|58053\nRoccalumera|ME|H418|98027\nRoccamandolfi|IS|H420|86092\nRoccamena|PA|H422|90040\nRoccamonfina|CE|H423|81035\nRoccamontepiano|CH|H424|66010\nRoccamorice|PE|H425|65020\nRoccanova|PZ|H426|85036\nRoccantica|RI|H427|02040\nRoccapalumba|PA|H428|90020\nRoccapiemonte|SA|H431|84086\nRoccarainola|NA|H433|80030\nRoccaraso|AQ|H434|67037\nRoccaromana|CE|H436|81051\nRoccascalegna|CH|H442|66040\nRoccasecca dei Volsci|LT|H444|04010\nRoccasecca|FR|H443|03038\nRoccasicura|IS|H445|86080\nRoccasparvera|CN|H447|12010\nRoccaspinalveti|CH|H448|66050\nRoccastrada|GR|H449|58036\nRoccavaldina|ME|H380|98040\nRoccaverano|AT|H451|14050\nRoccavignale|SV|H452|17017\nRoccavione|CN|H453|12018\nRoccavivara|CB|H454|86020\nRoccella Ionica|RC|H456|89047\nRoccella Valdemone|ME|H455|98030\nRocchetta a Volturno|IS|H458|86070\nRocchetta Belbo|CN|H462|12050\nRocchetta di Vara|SP|H461|19020\nRocchetta e Croce|CE|H459|81042\nRocchetta Ligure|AL|H465|15060\nRocchetta Nervina|IM|H460|18030\nRocchetta Palafea|AT|H466|14042\nRocchetta Sant'Antonio|FG|H467|71020\nRocchetta Tanaro|AT|H468|14030\nRodano|MI|H470|20090\nRoddi|CN|H472|12060\nRoddino|CN|H473|12050\nRodello|CN|H474|12050\nRodengo Saiano|BS|H477|25050\nRodengo|BZ|H475|39037\nRodero|CO|H478|22070\nRodi Garganico|FG|H480|71012\nRodì Milici|ME|H479|98059\nRodigo|MN|H481|46040\nRoè Volciano|BS|H484|25077\nRofrano|SA|H485|84070\nRogeno|LC|H486|23849\nRoggiano Gravina|CS|H488|87017\nRoghudi|RC|H489|89060\nRogliano|CS|H490|87054\nRognano|PV|H491|27010\nRogno|BG|H492|24060\nRogolo|SO|H493|23010\nRoiate|RM|H494|00030\nRoio del Sangro|CH|H495|66040\nRoisan|AO|H497|11010\nRoletto|TO|H498|10060\nRolo|RE|H500|42047\nRoma|RM|H501|00118-00199\nRomagnano al Monte|SA|H503|84020\nRomagnano Sesia|NO|H502|28078\nRomagnese|PV|H505|27050\nRomana|SS|H507|07010\nRomanengo|CR|H508|26014\nRomano Canavese|TO|H511|10090\nRomano d'Ezzelino|VI|H512|36060\nRomano di Lombardia|BG|H509|24058\nRomans d'Isonzo|GO|H514|34076\nRombiolo|VV|H516|89841\nRomeno|TN|H517|38010\nRomentino|NO|H518|28068\nRometta|ME|H519|98043\nRonago|CO|H521|22027\nRoncà|VR|H522|37030\nRoncade|TV|H523|31056\nRoncadelle|BS|H525|25030\nRoncaro|PV|H527|27010\nRoncegno Terme|TN|H528|38050\nRoncello|MB|H529|20877\nRonchi dei Legionari|GO|H531|34077\nRonchi Valsugana|TN|H532|38050\nRonchis|UD|H533|33050\nRonciglione|VT|H534|01037\nRonco all'Adige|VR|H540|37055\nRonco Biellese|BI|H538|13845\nRonco Briantino|MB|H537|20885\nRonco Canavese|TO|H539|10080\nRonco Scrivia|GE|H536|16019\nRoncobello|BG|H535|24010\nRoncoferraro|MN|H541|46037\nRoncofreddo|FC|H542|47020\nRoncola|BG|H544|24030\nRondanina|GE|H546|16025\nRondissone|TO|H547|10030\nRonsecco|VC|H549|13036\nRonzo-Chienis|TN|M303|38060\nRonzone|TN|H552|38010\nRoppolo|BI|H553|13883\nRorà|TO|H554|10060\nRosà|VI|H556|36027\nRosarno|RC|H558|89025\nRosasco|PV|H559|27030\nRosate|MI|H560|20088\nRosazza|BI|H561|13815\nRosciano|PE|H562|65020\nRoscigno|SA|H564|84020\nRose|CS|H565|87040\nRosello|CH|H566|66040\nRoseto Capo Spulico|CS|H572|87070\nRoseto degli Abruzzi|TE|F585|64026\nRoseto Valfortore|FG|H568|71039\nRosignano Marittimo|LI|H570|57016\nRosignano Monferrato|AL|H569|15030\nRosolina|RO|H573|45010\nRosolini|SR|H574|96019\nRosora|AN|H575|60030\nRossa|VC|H577|13020\nRossana|CN|H578|12020\nRossano Veneto|VI|H580|36028\nRossiglione|GE|H581|16010\nRosta|TO|H583|10090\nRota d'Imagna|BG|H584|24037\nRota Greca|CS|H585|87010\nRotella|AP|H588|63071\nRotello|CB|H589|86040\nRotonda|PZ|H590|85048\nRotondella|MT|H591|75026\nRotondi|AV|H592|83017\nRottofreno|PC|H593|29010\nRotzo|VI|H594|36010\nRoure|TO|H555|10060\nRovasenda|VC|H364|13040\nRovato|BS|H598|25038\nRovegno|GE|H599|16028\nRovellasca|CO|H601|22069\nRovello Porro|CO|H602|22070\nRoverbella|MN|H604|46048\nRoverchiara|VR|H606|37050\nRoverè della Luna|TN|H607|38030\nRoverè Veronese|VR|H608|37028\nRoveredo di Guà|VR|H610|37040\nRoveredo in Piano|PN|H609|33080\nRovereto|TN|H612|38068\nRovescala|PV|H614|27040\nRovetta|BG|H615|24020\nRoviano|RM|H618|00027\nRovigo|RO|H620|45100\nRovito|CS|H621|87050\nRovolon|PD|H622|35030\nRozzano|MI|H623|20089\nRubano|PD|H625|35030\nRubiana|TO|H627|10040\nRubiera|RE|H628|42048\nRuda|UD|H629|33050\nRudiano|BS|H630|25030\nRueglio|TO|H631|10010\nRuffano|LE|H632|73049\nRuffia|CN|H633|12030\nRuffrè-Mendola|TN|H634|38010\nRufina|FI|H635|50068\nRuinas|OR|F271|09085\nRumo|TN|H639|38020\nRuoti|PZ|H641|85056\nRussi|RA|H642|48026\nRutigliano|BA|H643|70018\nRutino|SA|H644|84070\nRuviano|CE|H165|81010\nRuvo del Monte|PZ|H646|85020\nRuvo di Puglia|BA|H645|70037\nSabaudia|LT|H647|04016\nSabbio Chiese|BS|H650|25070\nSabbioneta|MN|H652|46018\nSacco|SA|H654|84070\nSaccolongo|PD|H655|35030\nSacile|PN|H657|33077\nSacrofano|RM|H658|00060\nSadali|SU|H659|09062\nSagama|OR|H661|09090\nSagliano Micca|BI|H662|13816\nSagrado|GO|H665|34078\nSagron Mis|TN|H666|38050\nSaint-Christophe|AO|H669|11020\nSaint-Denis|AO|H670|11023\nSaint-Marcel|AO|H671|11020\nSaint-Nicolas|AO|H672|11010\nSaint-Oyen|AO|H673|11014\nSaint-Pierre|AO|H674|11010\nSaint-Rhémy-en-Bosses|AO|H675|11010\nSaint-Vincent|AO|H676|11027\nSala Baganza|PR|H682|43038\nSala Biellese|BI|H681|13884\nSala Bolognese|BO|H678|40010\nSala Comacina|CO|H679|22010\nSala Consilina|SA|H683|84036\nSala Monferrato|AL|H677|15030\nSalandra|MT|H687|75017\nSalaparuta|TP|H688|91020\nSalara|RO|H689|45030\nSalasco|VC|H690|13040\nSalassa|TO|H691|10080\nSalbertrand|TO|H684|10050\nSalcedo|VI|F810|36040\nSalcito|CB|H693|86026\nSale delle Langhe|CN|H695|12070\nSale Marasino|BS|H699|25057\nSale San Giovanni|CN|H704|12070\nSale|AL|H694|15045\nSalemi|TP|H700|91018\nSalento|SA|H686|84070\nSalerano Canavese|TO|H702|10010\nSalerano sul Lambro|LO|H701|26857\nSalerno|SA|H703|84121-84135\nSalgareda|TV|H706|31040\nSali Vercellese|VC|H707|13040\nSalice Salentino|LE|H708|73015\nSaliceto|CN|H710|12079\nSalisano|RI|H713|02040\nSalizzole|VR|H714|37056\nSalle|PE|H715|65020\nSalmour|CN|H716|12040\nSalò|BS|H717|25087\nSalorno|BZ|H719|39040\nSalsomaggiore Terme|PR|H720|43039\nSaltrio|VA|H723|21050\nSaludecio|RN|H724|47835\nSaluggia|VC|H725|13040\nSalussola|BI|H726|13885\nSaluzzo|CN|H727|12037\nSalve|LE|H729|73050\nSalvirola|CR|H731|26010\nSalvitelle|SA|H732|84020\nSalza di Pinerolo|TO|H734|10060\nSalza Irpina|AV|H733|83050\nSalzano|VE|H735|30030\nSamarate|VA|H736|21017\nSamassi|SU|H738|09030\nSamatzai|SU|H739|09020\nSambuca di Sicilia|AG|H743|92017\nSambuca Pistoiese|PT|H744|51020\nSambuci|RM|H745|00020\nSambuco|CN|H746|12010\nSammichele di Bari|BA|H749|70010\nSamo|RC|H013|89030\nSamolaco|SO|H752|23027\nSamone|TN|H754|38059\nSamone|TO|H753|10010\nSampeyre|CN|H755|12020\nSamugheo|OR|H756|09086\nSan Bartolomeo al Mare|IM|H763|18016\nSan Bartolomeo in Galdo|BN|H764|82028\nSan Bartolomeo Val Cavargna|CO|H760|22010\nSan Basile|CS|H765|87010\nSan Basilio|SU|H766|09040\nSan Bassano|CR|H767|26020\nSan Bellino|RO|H768|45020\nSan Benedetto Belbo|CN|H770|12050\nSan Benedetto dei Marsi|AQ|H772|67058\nSan Benedetto del Tronto|AP|H769|63074\nSan Benedetto in Perillis|AQ|H773|67020\nSan Benedetto Po|MN|H771|46027\nSan Benedetto Ullano|CS|H774|87040\nSan Benedetto Val di Sambro|BO|G566|40048\nSan Benigno Canavese|TO|H775|10080\nSan Bernardino Verbano|VB|H777|28804\nSan Biagio della Cima|IM|H780|18036\nSan Biagio di Callalta|TV|H781|31048\nSan Biagio Platani|AG|H778|92020\nSan Biagio Saracinisco|FR|H779|03040\nSan Biase|CB|H782|86020\nSan Bonifacio|VR|H783|37047\nSan Buono|CH|H784|66050\nSan Calogero|VV|H785|89842\nSan Candido|BZ|H786|39038\nSan Canzian d'Isonzo|GO|H787|34075\nSan Carlo Canavese|TO|H789|10070\nSan Casciano dei Bagni|SI|H790|53040\nSan Casciano in Val di Pesa|FI|H791|50026\nSan Cassiano|LE|M264|73020\nSan Cataldo|CL|H792|93017\nSan Cesareo|RM|M295|00030\nSan Cesario di Lecce|LE|H793|73016\nSan Cesario sul Panaro|MO|H794|41018\nSan Chirico Nuovo|PZ|H795|85010\nSan Chirico Raparo|PZ|H796|85030\nSan Cipirello|PA|H797|90040\nSan Cipriano d'Aversa|CE|H798|81036\nSan Cipriano Picentino|SA|H800|84099\nSan Cipriano Po|PV|H799|27043\nSan Clemente|RN|H801|47832\nSan Colombano al Lambro|MI|H803|20078\nSan Colombano Belmonte|TO|H804|10080\nSan Colombano Certenoli|GE|H802|16040\nSan Cono|CT|H805|95040\nSan Cosmo Albanese|CS|H806|87060\nSan Costantino Albanese|PZ|H808|85030\nSan Costantino Calabro|VV|H807|89851\nSan Costanzo|PU|H809|61039\nSan Cristoforo|AL|H810|15060\nSan Damiano al Colle|PV|H814|27040\nSan Damiano d'Asti|AT|H811|14015\nSan Damiano Macra|CN|H812|12029\nSan Daniele del Friuli|UD|H816|33038\nSan Daniele Po|CR|H815|26046\nSan Demetrio Corone|CS|H818|87069\nSan Demetrio ne' Vestini|AQ|H819|67028\nSan Didero|TO|H820|10050\nSan Donà di Piave|VE|H823|30027\nSan Donaci|BR|H822|72025\nSan Donato di Lecce|LE|H826|73010\nSan Donato di Ninea|CS|H825|87010\nSan Donato Milanese|MI|H827|20097\nSan Donato Val di Comino|FR|H824|03046\nSan Dorligo della Valle|TS|D324|34018\nSan Fele|PZ|H831|85020\nSan Felice a Cancello|CE|H834|81027\nSan Felice Circeo|LT|H836|04017\nSan Felice del Benaco|BS|H838|25010\nSan Felice del Molise|CB|H833|86030\nSan Felice sul Panaro|MO|H835|41038\nSan Ferdinando di Puglia|BT|H839|76017\nSan Ferdinando|RC|M277|89026\nSan Fermo della Battaglia|CO|H840|22042\nSan Fili|CS|H841|87037\nSan Filippo del Mela|ME|H842|98044\nSan Fior|TV|H843|31020\nSan Fiorano|LO|H844|26848\nSan Floriano del Collio|GO|H845|34070\nSan Floro|CZ|H846|88021\nSan Francesco al Campo|TO|H847|10070\nSan Fratello|ME|H850|98075\nSan Gavino Monreale|SU|H856|09037\nSan Gemini|TR|H857|05029\nSan Genesio Atesino|BZ|H858|39050\nSan Genesio ed Uniti|PV|H859|27010\nSan Gennaro Vesuviano|NA|H860|80040\nSan Germano Chisone|TO|H862|10065\nSan Germano Vercellese|VC|H861|13047\nSan Gervasio Bresciano|BS|H865|25020\nSan Giacomo degli Schiavoni|CB|H867|86030\nSan Giacomo delle Segnate|MN|H870|46020\nSan Giacomo Filippo|SO|H868|23020\nSan Giacomo Vercellese|VC|B952|13030\nSan Gillio|TO|H873|10040\nSan Gimignano|SI|H875|53037\nSan Ginesio|MC|H876|62026\nSan Giorgio a Cremano|NA|H892|80046\nSan Giorgio a Liri|FR|H880|03047\nSan Giorgio Albanese|CS|H881|87060\nSan Giorgio Bigarello|MN|H883|46051\nSan Giorgio Canavese|TO|H890|10090\nSan Giorgio del Sannio|BN|H894|82018\nSan Giorgio della Richinvelda|PN|H891|33095\nSan Giorgio delle Pertiche|PD|H893|35010\nSan Giorgio di Lomellina|PV|H885|27020\nSan Giorgio di Nogaro|UD|H895|33058\nSan Giorgio di Piano|BO|H896|40016\nSan Giorgio in Bosco|PD|H897|35010\nSan Giorgio Ionico|TA|H882|74027\nSan Giorgio La Molara|BN|H898|82020\nSan Giorgio Lucano|MT|H888|75027\nSan Giorgio Monferrato|AL|H878|15020\nSan Giorgio Morgeto|RC|H889|89017\nSan Giorgio Piacentino|PC|H887|29019\nSan Giorgio Scarampi|AT|H899|14059\nSan Giorgio su Legnano|MI|H884|20010\nSan Giorio di Susa|TO|H900|10050\nSan Giovanni a Piro|SA|H907|84070\nSan Giovanni al Natisone|UD|H906|33048\nSan Giovanni Bianco|BG|H910|24015\nSan Giovanni del Dosso|MN|H912|46020\nSan Giovanni di Fassa|TN|M390|38036\nSan Giovanni di Gerace|RC|H903|89040\nSan Giovanni Gemini|AG|H914|92020\nSan Giovanni Ilarione|VR|H916|37035\nSan Giovanni in Croce|CR|H918|26037\nSan Giovanni in Fiore|CS|H919|87055\nSan Giovanni in Galdo|CB|H920|86010\nSan Giovanni in Marignano|RN|H921|47842\nSan Giovanni in Persiceto|BO|G467|40017\nSan Giovanni Incarico|FR|H917|03028\nSan Giovanni la Punta|CT|H922|95037\nSan Giovanni Lipioni|CH|H923|66050\nSan Giovanni Lupatoto|VR|H924|37057\nSan Giovanni Rotondo|FG|H926|71013\nSan Giovanni Suergiu|SU|G287|09010\nSan Giovanni Teatino|CH|D690|66020\nSan Giovanni Valdarno|AR|H901|52027\nSan Giuliano del Sannio|CB|H928|86010\nSan Giuliano di Puglia|CB|H929|86040\nSan Giuliano Milanese|MI|H930|20098\nSan Giuliano Terme|PI|A562|56017\nSan Giuseppe Jato|PA|H933|90048\nSan Giuseppe Vesuviano|NA|H931|80047\nSan Giustino|PG|H935|06016\nSan Giusto Canavese|TO|H936|10090\nSan Godenzo|FI|H937|50060\nSan Gregorio d'Ippona|VV|H941|89853\nSan Gregorio da Sassola|RM|H942|00010\nSan Gregorio di Catania|CT|H940|95027\nSan Gregorio Magno|SA|H943|84020\nSan Gregorio Matese|CE|H939|81010\nSan Gregorio nelle Alpi|BL|H938|32030\nSan Lazzaro di Savena|BO|H945|40068\nSan Leo|RN|H949|47865\nSan Leonardo in Passiria|BZ|H952|39015\nSan Leonardo|UD|H951|33040\nSan Leucio del Sannio|BN|H953|82010\nSan Lorenzello|BN|H955|82030\nSan Lorenzo al Mare|IM|H957|18017\nSan Lorenzo Bellizzi|CS|H961|87070\nSan Lorenzo del Vallo|CS|H962|87040\nSan Lorenzo di Sebato|BZ|H956|39030\nSan Lorenzo Dorsino|TN|M345|38078\nSan Lorenzo in Campo|PU|H958|61047\nSan Lorenzo Isontino|GO|H964|34070\nSan Lorenzo Maggiore|BN|H967|82034\nSan Lorenzo Nuovo|VT|H969|01020\nSan Lorenzo|RC|H959|89069\nSan Luca|RC|H970|89030\nSan Lucido|CS|H971|87038\nSan Lupo|BN|H973|82034\nSan Mango d'Aquino|CZ|H976|88040\nSan Mango Piemonte|SA|H977|84090\nSan Mango sul Calore|AV|H975|83050\nSan Marcellino|CE|H978|81030\nSan Marcello Piteglio|PT|M377|51028\nSan Marcello|AN|H979|60030\nSan Marco Argentano|CS|H981|87018\nSan Marco d'Alunzio|ME|H982|98070\nSan Marco dei Cavoti|BN|H984|82029\nSan Marco Evangelista|CE|F043|81020\nSan Marco in Lamis|FG|H985|71014\nSan Marco la Catola|FG|H986|71030\nSan Martino al Tagliamento|PN|H999|33098\nSan Martino Alfieri|AT|H987|14010\nSan Martino Buon Albergo|VR|I003|37036\nSan Martino Canavese|TO|H997|10010\nSan Martino d'Agri|PZ|H994|85030\nSan Martino dall'Argine|MN|I005|46010\nSan Martino del Lago|CR|I007|26040\nSan Martino di Finita|CS|H992|87010\nSan Martino di Lupari|PD|I008|35018\nSan Martino di Venezze|RO|H996|45030\nSan Martino in Badia|BZ|H988|39030\nSan Martino in Passiria|BZ|H989|39010\nSan Martino in Pensilis|CB|H990|86046\nSan Martino in Rio|RE|I011|42018\nSan Martino in Strada|LO|I012|26817\nSan Martino Sannita|BN|I002|82010\nSan Martino Siccomario|PV|I014|27028\nSan Martino sulla Marrucina|CH|H991|66010\nSan Martino Valle Caudina|AV|I016|83018\nSan Marzano di San Giuseppe|TA|I018|74020\nSan Marzano Oliveto|AT|I017|14050\nSan Marzano sul Sarno|SA|I019|84010\nSan Massimo|CB|I023|86027\nSan Maurizio Canavese|TO|I024|10077\nSan Maurizio d'Opaglio|NO|I025|28017\nSan Mauro Castelverde|PA|I028|90010\nSan Mauro Cilento|SA|I031|84070\nSan Mauro di Saline|VR|H712|37030\nSan Mauro Forte|MT|I029|75010\nSan Mauro la Bruca|SA|I032|84070\nSan Mauro Marchesato|KR|I026|88831\nSan Mauro Pascoli|FC|I027|47030\nSan Mauro Torinese|TO|I030|10099\nSan Michele al Tagliamento|VE|I040|30028\nSan Michele all'Adige|TN|I042|38010\nSan Michele di Ganzaria|CT|I035|95040\nSan Michele di Serino|AV|I034|83020\nSan Michele Mondovì|CN|I037|12080\nSan Michele Salentino|BR|I045|72018\nSan Miniato|PI|I046|56028\nSan Nazzaro Sesia|NO|I052|28060\nSan Nazzaro Val Cavargna|CO|I051|22010\nSan Nazzaro|BN|I049|82018\nSan Nicandro Garganico|FG|I054|71015\nSan Nicola Arcella|CS|I060|87020\nSan Nicola Baronia|AV|I061|83050\nSan Nicola da Crissa|VV|I058|89821\nSan Nicola dell'Alto|KR|I057|88817\nSan Nicola la Strada|CE|I056|81020\nSan Nicola Manfredi|BN|I062|82010\nSan Nicolò d'Arcidano|OR|A368|09097\nSan Nicolò di Comelico|BL|I063|32040\nSan Nicolò Gerrei|SU|G383|09040\nSan Pancrazio Salentino|BR|I066|72026\nSan Pancrazio|BZ|I065|39010\nSan Paolo Albanese|PZ|B906|85030\nSan Paolo Bel Sito|NA|I073|80030\nSan Paolo d'Argon|BG|B310|24060\nSan Paolo di Civitate|FG|I072|71010\nSan Paolo di Jesi|AN|I071|60038\nSan Paolo Solbrito|AT|I076|14010\nSan Paolo|BS|G407|25020\nSan Pellegrino Terme|BG|I079|24016\nSan Pier d'Isonzo|GO|I082|34070\nSan Pier Niceto|ME|I084|98045\nSan Piero Patti|ME|I086|98068\nSan Pietro a Maida|CZ|I093|88025\nSan Pietro al Natisone|UD|I092|33049\nSan Pietro al Tanagro|SA|I089|84030\nSan Pietro Apostolo|CZ|I095|88040\nSan Pietro Avellana|IS|I096|86088\nSan Pietro Clarenza|CT|I098|95030\nSan Pietro di Cadore|BL|I088|32040\nSan Pietro di Caridà|RC|I102|89020\nSan Pietro di Feletto|TV|I103|31020\nSan Pietro di Morubio|VR|I105|37050\nSan Pietro in Amantea|CS|I108|87030\nSan Pietro in Cariano|VR|I109|37029\nSan Pietro in Casale|BO|I110|40018\nSan Pietro in Cerro|PC|G788|29010\nSan Pietro in Gu|PD|I107|35010\nSan Pietro in Guarano|CS|I114|87047\nSan Pietro in Lama|LE|I115|73010\nSan Pietro Infine|CE|I113|81049\nSan Pietro Mosezzo|NO|I116|28060\nSan Pietro Mussolino|VI|I117|36070\nSan Pietro Val Lemina|TO|I090|10060\nSan Pietro Vernotico|BR|I119|72027\nSan Pietro Viminario|PD|I120|35020\nSan Pio delle Camere|AQ|I121|67020\nSan Polo d'Enza|RE|I123|42020\nSan Polo dei Cavalieri|RM|I125|00010\nSan Polo di Piave|TV|I124|31020\nSan Polo Matese|CB|I122|86020\nSan Ponso|TO|I126|10080\nSan Possidonio|MO|I128|41039\nSan Potito Sannitico|CE|I130|81016\nSan Potito Ultra|AV|I129|83050\nSan Prisco|CE|I131|81054\nSan Procopio|RC|I132|89020\nSan Prospero|MO|I133|41030\nSan Quirico d'Orcia|SI|I135|53027\nSan Quirino|PN|I136|33080\nSan Raffaele Cimena|TO|I137|10090\nSan Roberto|RC|I139|89050\nSan Rocco al Porto|LO|I140|26865\nSan Romano in Garfagnana|LU|I142|55038\nSan Rufo|SA|I143|84030\nSan Salvatore di Fitalia|ME|I147|98070\nSan Salvatore Monferrato|AL|I144|15046\nSan Salvatore Telesino|BN|I145|82030\nSan Salvo|CH|I148|66050\nSan Sebastiano al Vesuvio|NA|I151|80040\nSan Sebastiano Curone|AL|I150|15056\nSan Sebastiano da Po|TO|I152|10020\nSan Secondo di Pinerolo|TO|I154|10060\nSan Secondo Parmense|PR|I153|43017\nSan Severino Lucano|PZ|I157|85030\nSan Severino Marche|MC|I156|62027\nSan Severo|FG|I158|71016\nSan Siro|CO|I162|22010\nSan Sossio Baronia|AV|I163|83050\nSan Sostene|CZ|I164|88060\nSan Sosti|CS|I165|87010\nSan Sperate|SU|I166|09026\nSan Stino di Livenza|VE|I373|30029\nSan Tammaro|CE|I261|81050\nSan Teodoro|ME|I328|98030\nSan Teodoro|SS|I329|07052\nSan Tomaso Agordino|BL|I347|32020\nSan Valentino in Abruzzo Citeriore|PE|I376|65020\nSan Valentino Torio|SA|I377|84010\nSan Venanzo|TR|I381|05010\nSan Vendemiano|TV|I382|31020\nSan Vero Milis|OR|I384|09070\nSan Vincenzo La Costa|CS|I388|87030\nSan Vincenzo Valle Roveto|AQ|I389|67050\nSan Vincenzo|LI|I390|57027\nSan Vitaliano|NA|I391|80030\nSan Vito al Tagliamento|PN|I403|33078\nSan Vito al Torre|UD|I404|33050\nSan Vito Chietino|CH|I394|66038\nSan Vito dei Normanni|BR|I396|72019\nSan Vito di Cadore|BL|I392|32046\nSan Vito di Fagagna|UD|I405|33030\nSan Vito di Leguzzano|VI|I401|36030\nSan Vito Lo Capo|TP|I407|91010\nSan Vito Romano|RM|I400|00030\nSan Vito sullo Ionio|CZ|I393|88067\nSan Vito|SU|I402|09040\nSan Vittore del Lazio|FR|I408|03040\nSan Vittore Olona|MI|I409|20028\nSan Zeno di Montagna|VR|I414|37010\nSan Zeno Naviglio|BS|I412|25010\nSan Zenone al Lambro|MI|I415|20070\nSan Zenone al Po|PV|I416|27010\nSan Zenone degli Ezzelini|TV|I417|31020\nSanarica|LE|H757|73030\nSandigliano|BI|H821|13876\nSandrigo|VI|H829|36066\nSanfrè|CN|H851|12040\nSanfront|CN|H852|12030\nSangano|TO|H855|10090\nSangiano|VA|H872|21038\nSangineto|CS|H877|87020\nSanguinetto|VR|H944|37058\nSanluri|SU|H974|09025\nSannazzaro de' Burgondi|PV|I048|27039\nSannicandro di Bari|BA|I053|70028\nSannicola|LE|I059|73017\nSanremo|IM|I138|18038\nSansepolcro|AR|I155|52037\nSant'Agapito|IS|I189|86070\nSant'Agata Bolognese|BO|I191|40019\nSant'Agata de' Goti|BN|I197|82019\nSant'Agata del Bianco|RC|I198|89030\nSant'Agata di Esaro|CS|I192|87010\nSant'Agata di Militello|ME|I199|98076\nSant'Agata di Puglia|FG|I193|71028\nSant'Agata Feltria|RN|I201|47866\nSant'Agata Fossili|AL|I190|15050\nSant'Agata li Battiati|CT|I202|95030\nSant'Agata sul Santerno|RA|I196|48020\nSant'Agnello|NA|I208|80065\nSant'Albano Stura|CN|I210|12040\nSant'Alessio con Vialone|PV|I213|27016\nSant'Alessio in Aspromonte|RC|I214|89050\nSant'Alessio Siculo|ME|I215|98030\nSant'Alfio|CT|I216|95010\nSant'Ambrogio di Torino|TO|I258|10057\nSant'Ambrogio di Valpolicella|VR|I259|37015\nSant'Ambrogio sul Garigliano|FR|I256|03040\nSant'Anastasia|NA|I262|80048\nSant'Anatolia di Narco|PG|I263|06040\nSant'Andrea Apostolo dello Ionio|CZ|I266|88060\nSant'Andrea del Garigliano|FR|I265|03040\nSant'Andrea di Conza|AV|I264|83053\nSant'Andrea Frius|SU|I271|09040\nSant'Angelo a Cupolo|BN|I277|82010\nSant'Angelo a Fasanella|SA|I278|84027\nSant'Angelo a Scala|AV|I280|83010\nSant'Angelo all'Esca|AV|I279|83050\nSant'Angelo d'Alife|CE|I273|81017\nSant'Angelo dei Lombardi|AV|I281|83054\nSant'Angelo del Pesco|IS|I282|86080\nSant'Angelo di Brolo|ME|I283|98060\nSant'Angelo di Piove di Sacco|PD|I275|35020\nSant'Angelo in Pontano|MC|I286|62020\nSant'Angelo in Vado|PU|I287|61048\nSant'Angelo Le Fratte|PZ|I288|85050\nSant'Angelo Limosano|CB|I289|86020\nSant'Angelo Lodigiano|LO|I274|26866\nSant'Angelo Lomellina|PV|I276|27030\nSant'Angelo Muxaro|AG|I290|92020\nSant'Angelo Romano|RM|I284|00010\nSant'Anna Arresi|SU|M209|09010\nSant'Anna d'Alfaedo|VR|I292|37020\nSant'Antimo|NA|I293|80029\nSant'Antioco|SU|I294|09017\nSant'Antonino di Susa|TO|I296|10050\nSant'Antonio Abate|NA|I300|80057\nSant'Antonio di Gallura|SS|M276|07030\nSant'Apollinare|FR|I302|03048\nSant'Arcangelo Trimonte|BN|F557|82021\nSant'Arcangelo|PZ|I305|85037\nSant'Arpino|CE|I306|81030\nSant'Arsenio|SA|I307|84037\nSant'Egidio alla Vibrata|TE|I318|64016\nSant'Egidio del Monte Albino|SA|I317|84010\nSant'Elena Sannita|IS|B466|86095\nSant'Elena|PD|I319|35040\nSant'Elia a Pianisi|CB|I320|86048\nSant'Elia Fiumerapido|FR|I321|03049\nSant'Elpidio a Mare|FM|I324|63811\nSant'Eufemia a Maiella|PE|I332|65020\nSant'Eufemia d'Aspromonte|RC|I333|89027\nSant'Eusanio del Sangro|CH|I335|66037\nSant'Eusanio Forconese|AQ|I336|67020\nSant'Ilario d'Enza|RE|I342|42049\nSant'Ilario dello Ionio|RC|I341|89040\nSant'Ippolito|PU|I344|61040\nSant'Olcese|GE|I346|16010\nSant'Omero|TE|I348|64027\nSant'Omobono Terme|BG|M333|24038\nSant'Onofrio|VV|I350|89843\nSant'Oreste|RM|I352|00060\nSant'Orsola Terme|TN|I354|38050\nSant'Urbano|PD|I375|35040\nSanta Brigida|BG|I168|24010\nSanta Caterina Albanese|CS|I171|87010\nSanta Caterina dello Ionio|CZ|I170|88060\nSanta Caterina Villarmosa|CL|I169|93018\nSanta Cesarea Terme|LE|I172|73020\nSanta Cristina d'Aspromonte|RC|I176|89056\nSanta Cristina e Bissone|PV|I175|27010\nSanta Cristina Gela|PA|I174|90030\nSanta Cristina Valgardena|BZ|I173|39047\nSanta Croce Camerina|RG|I178|97017\nSanta Croce del Sannio|BN|I179|82020\nSanta Croce di Magliano|CB|I181|86047\nSanta Croce sull'Arno|PI|I177|56029\nSanta Domenica Talao|CS|I183|87020\nSanta Domenica Vittoria|ME|I184|98030\nSanta Elisabetta|AG|I185|92020\nSanta Fiora|GR|I187|58037\nSanta Flavia|PA|I188|90017\nSanta Giuletta|PV|I203|27046\nSanta Giusta|OR|I205|09096\nSanta Giustina in Colle|PD|I207|35010\nSanta Giustina|BL|I206|32035\nSanta Luce|PI|I217|56040\nSanta Lucia del Mela|ME|I220|98046\nSanta Lucia di Piave|TV|I221|31025\nSanta Lucia di Serino|AV|I219|83020\nSanta Margherita di Belice|AG|I224|92018\nSanta Margherita di Staffora|PV|I230|27050\nSanta Margherita Ligure|GE|I225|16038\nSanta Maria a Monte|PI|I232|56020\nSanta Maria a Vico|CE|I233|81028\nSanta Maria Capua Vetere|CE|I234|81055\nSanta Maria Coghinas|SS|M284|07030\nSanta Maria del Cedro|CS|C717|87020\nSanta Maria del Molise|IS|I238|86096\nSanta Maria della Versa|PV|I237|27047\nSanta Maria di Licodia|CT|I240|95038\nSanta Maria di Sala|VE|I242|30036\nSanta Maria Hoè|LC|I243|23889\nSanta Maria Imbaro|CH|I244|66030\nSanta Maria la Carità|NA|M273|80050\nSanta Maria la Fossa|CE|I247|81050\nSanta Maria la Longa|UD|I248|33050\nSanta Maria Maggiore|VB|I249|28857\nSanta Maria Nuova|AN|I251|60030\nSanta Marina Salina|ME|I254|98050\nSanta Marina|SA|I253|84067\nSanta Marinella|RM|I255|00058\nSanta Ninfa|TP|I291|91029\nSanta Paolina|AV|I301|83030\nSanta Severina|KR|I308|88832\nSanta Sofia d'Epiro|CS|I309|87048\nSanta Sofia|FC|I310|47018\nSanta Teresa di Riva|ME|I311|98028\nSanta Teresa Gallura|SS|I312|07028\nSanta Venerina|CT|I314|95010\nSanta Vittoria d'Alba|CN|I316|12069\nSanta Vittoria in Matenano|FM|I315|63854\nSantadi|SU|I182|09010\nSantarcangelo di Romagna|RN|I304|47822\nSante Marie|AQ|I326|67067\nSantena|TO|I327|10026\nSanteramo in Colle|BA|I330|70029\nSanthià|VC|I337|13048\nSanti Cosma e Damiano|LT|I339|04020\nSanto Stefano al Mare|IM|I365|18010\nSanto Stefano Belbo|CN|I367|12058\nSanto Stefano d'Aveto|GE|I368|16049\nSanto Stefano del Sole|AV|I357|83050\nSanto Stefano di Cadore|BL|C919|32045\nSanto Stefano di Camastra|ME|I370|98077\nSanto Stefano di Magra|SP|I363|19037\nSanto Stefano di Rogliano|CS|I359|87056\nSanto Stefano di Sessanio|AQ|I360|67020\nSanto Stefano in Aspromonte|RC|I371|89057\nSanto Stefano Lodigiano|LO|I362|26849\nSanto Stefano Quisquina|AG|I356|92020\nSanto Stefano Roero|CN|I372|12040\nSanto Stefano Ticino|MI|I361|20010\nSantomenna|SA|I260|84020\nSantopadre|FR|I351|03030\nSantorso|VI|I353|36014\nSantu Lussurgiu|OR|I374|09075\nSanza|SA|I410|84030\nSanzeno|TN|I411|38010\nSaonara|PD|I418|35020\nSaponara|ME|I420|98047\nSappada|UD|I421|33012\nSapri|SA|I422|84073\nSaracena|CS|I423|87010\nSaracinesco|RM|I424|00020\nSarcedo|VI|I425|36030\nSarconi|PZ|I426|85050\nSardara|SU|I428|09030\nSardigliano|AL|I429|15060\nSarego|VI|I430|36040\nSarentino|BZ|I431|39058\nSarezzano|AL|I432|15050\nSarezzo|BS|I433|25068\nSarmato|PC|I434|29010\nSarmede|TV|I435|31026\nSarnano|MC|I436|62028\nSarnico|BG|I437|24067\nSarno|SA|I438|84087\nSarnonico|TN|I439|38011\nSaronno|VA|I441|21047\nSarre|AO|I442|11010\nSarroch|CA|I443|09018\nSarsina|FC|I444|47027\nSarteano|SI|I445|53047\nSartirana Lomellina|PV|I447|27020\nSarule|NU|I448|08020\nSarzana|SP|I449|19038\nSassano|SA|I451|84038\nSassari|SS|I452|07100\nSassello|SV|I453|17046\nSassetta|LI|I454|57020\nSassinoro|BN|I455|82026\nSasso di Castalda|PZ|I457|85050\nSasso Marconi|BO|G972|40037\nSassocorvaro Auditore|PU|M413|61028\nSassofeltrio|PU|I460|61013\nSassoferrato|AN|I461|60041\nSassuolo|MO|I462|41049\nSatriano di Lucania|PZ|G614|85050\nSatriano|CZ|I463|88060\nSauris|UD|I464|33020\nSauze d'Oulx|TO|I466|10050\nSauze di Cesana|TO|I465|10054\nSava|TA|I467|74028\nSavelli|KR|I468|88825\nSaviano|NA|I469|80039\nSavigliano|CN|I470|12038\nSavignano Irpino|AV|I471|83030\nSavignano sul Panaro|MO|I473|41056\nSavignano sul Rubicone|FC|I472|47039\nSavignone|GE|I475|16010\nSaviore dell'Adamello|BS|I476|25040\nSavoca|ME|I477|98038\nSavogna d'Isonzo|GO|I479|34070\nSavogna|UD|I478|33040\nSavoia di Lucania|PZ|H730|85050\nSavona|SV|I480|17100\nScafa|PE|I482|65027\nScafati|SA|I483|84018\nScagnello|CN|I484|12070\nScala Coeli|CS|I485|87060\nScala|SA|I486|84010\nScaldasole|PV|I487|27020\nScalea|CS|I489|87029\nScalenghe|TO|I490|10060\nScaletta Zanclea|ME|I492|98029\nScampitella|AV|I493|83050\nScandale|KR|I494|88831\nScandiano|RE|I496|42019\nScandicci|FI|B962|50018\nScandolara Ravara|CR|I497|26040\nScandolara Ripa d'Oglio|CR|I498|26047\nScandriglia|RI|I499|02038\nScanno|AQ|I501|67038\nScano di Montiferro|OR|I503|09078\nScansano|GR|I504|58054\nScanzano Jonico|MT|M256|75020\nScanzorosciate|BG|I506|24020\nScapoli|IS|I507|86070\nScarlino|GR|I510|58020\nScarmagno|TO|I511|10010\nScarnafigi|CN|I512|12030\nScarperia e San Piero|FI|M326|50038\nScena|BZ|I519|39017\nScerni|CH|I520|66020\nScheggia e Pascelupo|PG|I522|06027\nScheggino|PG|I523|06040\nSchiavi di Abruzzo|CH|I526|66045\nSchiavon|VI|I527|36060\nSchignano|CO|I529|22020\nSchilpario|BG|I530|24020\nSchio|VI|I531|36015\nSchivenoglia|MN|I532|46020\nSciacca|AG|I533|92019\nSciara|PA|I534|90020\nScicli|RG|I535|97018\nScido|RC|I536|89010\nScigliano|CS|D290|87057\nScilla|RC|I537|89058\nScillato|PA|I538|90020\nSciolze|TO|I539|10090\nScisciano|NA|I540|80030\nSclafani Bagni|PA|I541|90020\nScontrone|AQ|I543|67030\nScopa|VC|I544|13027\nScopello|VC|I545|13028\nScoppito|AQ|I546|67019\nScordia|CT|I548|95048\nScorrano|LE|I549|73020\nScorzè|VE|I551|30037\nScurcola Marsicana|AQ|I553|67068\nScurelle|TN|I554|38050\nScurzolengo|AT|I555|14030\nSeborga|IM|I556|18012\nSecinaro|AQ|I558|67029\nSeclì|LE|I559|73050\nSecugnago|LO|I561|26826\nSedegliano|UD|I562|33039\nSedico|BL|I563|32036\nSedilo|OR|I564|09076\nSedini|SS|I565|07035\nSedriano|MI|I566|20018\nSedrina|BG|I567|24010\nSefro|MC|I569|62025\nSegariu|SU|I570|09040\nSeggiano|GR|I571|58038\nSegni|RM|I573|00037\nSegonzano|TN|I576|38047\nSegrate|MI|I577|20090\nSegusino|TV|I578|31040\nSelargius|CA|I580|09047\nSelci|RI|I581|02040\nSelegas|SU|I582|09040\nSella Giudicarie|TN|M360|38087\nSellano|PG|I585|06030\nSellero|BS|I588|25050\nSellia Marina|CZ|I590|88050\nSellia|CZ|I589|88050\nSelva dei Molini|BZ|I593|39030\nSelva di Cadore|BL|I592|32020\nSelva di Progno|VR|I594|37030\nSelva di Val Gardena|BZ|I591|39048\nSelvazzano Dentro|PD|I595|35030\nSelvino|BG|I597|24020\nSemestene|SS|I598|07010\nSemiana|PV|I599|27020\nSeminara|RC|I600|89028\nSemproniano|GR|I601|58055\nSenago|MI|I602|20030\nSenale-San Felice|BZ|I603|39010\nSenales|BZ|I604|39020\nSeneghe|OR|I605|09070\nSenerchia|AV|I606|83050\nSeniga|BS|I607|25020\nSenigallia|AN|I608|60019\nSenis|OR|I609|09080\nSenise|PZ|I610|85038\nSenna Comasco|CO|I611|22070\nSenna Lodigiana|LO|I612|26856\nSennariolo|OR|I613|09078\nSennori|SS|I614|07036\nSenorbì|SU|I615|09040\nSepino|CB|I618|86017\nSequals|PN|I621|33090\nSeravezza|LU|I622|55047\nSerdiana|SU|I624|09040\nSeregno|MB|I625|20831\nSeren del Grappa|BL|I626|32030\nSergnano|CR|I627|26010\nSeriate|BG|I628|24068\nSerina|BG|I629|24017\nSerino|AV|I630|83028\nSerle|BS|I631|25080\nSermide e Felonica|MN|I632|46028\nSermoneta|LT|I634|04013\nSernaglia della Battaglia|TV|I635|31020\nSernio|SO|I636|23030\nSerole|AT|I637|14050\nSerra d'Aiello|CS|I642|87030\nSerra de' Conti|AN|I643|60030\nSerra Riccò|GE|I640|16010\nSerra San Bruno|VV|I639|89822\nSerra San Quirico|AN|I653|60048\nSerra Sant'Abbondio|PU|I654|61040\nSerracapriola|FG|I641|71010\nSerradifalco|CL|I644|93010\nSerralunga d'Alba|CN|I646|12050\nSerralunga di Crea|AL|I645|15020\nSerramanna|SU|I647|09038\nSerramazzoni|MO|F357|41028\nSerramezzana|SA|I648|84070\nSerramonacesca|PE|I649|65025\nSerrapetrona|MC|I651|62020\nSerrara Fontana|NA|I652|80081\nSerrastretta|CZ|I655|88040\nSerrata|RC|I656|89020\nSerravalle a Po|MN|I662|46030\nSerravalle di Chienti|MC|I661|62038\nSerravalle Langhe|CN|I659|12050\nSerravalle Pistoiese|PT|I660|51034\nSerravalle Scrivia|AL|I657|15069\nSerravalle Sesia|VC|I663|13037\nSerre|SA|I666|84028\nSerrenti|SU|I667|09027\nSerri|SU|I668|09063\nSerrone|FR|I669|03010\nSersale|CZ|I671|88054\nServigliano|FM|C070|63839\nSessa Aurunca|CE|I676|81037\nSessa Cilento|SA|I677|84074\nSessame|AT|I678|14058\nSessano del Molise|IS|I679|86097\nSesta Godano|SP|E070|19020\nSestino|AR|I681|52038\nSesto al Reghena|PN|I686|33079\nSesto Calende|VA|I688|21018\nSesto Campano|IS|I682|86078\nSesto ed Uniti|CR|I683|26028\nSesto Fiorentino|FI|I684|50019\nSesto San Giovanni|MI|I690|20099\nSesto|BZ|I687|39030\nSestola|MO|I689|41029\nSestri Levante|GE|I693|16039\nSestriere|TO|I692|10058\nSestu|CA|I695|09028\nSettala|MI|I696|20090\nSettefrati|FR|I697|03040\nSettime|AT|I698|14020\nSettimo Milanese|MI|I700|20019\nSettimo Rottaro|TO|I701|10010\nSettimo San Pietro|CA|I699|09060\nSettimo Torinese|TO|I703|10036\nSettimo Vittone|TO|I702|10010\nSettingiano|CZ|I704|88040\nSetzu|SU|I705|09029\nSeui|SU|I706|09064\nSeulo|SU|I707|09065\nSeveso|MB|I709|20822\nSezzadio|AL|I711|15079\nSezze|LT|I712|04018\nSfruz|TN|I714|38010\nSgonico|TS|I715|34010\nSgurgola|FR|I716|03010\nSiamaggiore|OR|I717|09070\nSiamanna|OR|I718|09080\nSiano|SA|I720|84088\nSiapiccia|OR|I721|09080\nSicignano degli Alburni|SA|M253|84029\nSiculiana|AG|I723|92010\nSiddi|SU|I724|09020\nSiderno|RC|I725|89048\nSiena|SI|I726|53100\nSigillo|PG|I727|06028\nSigna|FI|I728|50058\nSilandro|BZ|I729|39028\nSilanus|NU|I730|08017\nSilea|TV|F116|31057\nSiligo|SS|I732|07040\nSiliqua|SU|I734|09010\nSilius|SU|I735|09040\nSillano Giuncugnano|LU|M347|55039\nSillavengo|NO|I736|28064\nSilvano d'Orba|AL|I738|15060\nSilvano Pietra|PV|I739|27050\nSilvi|TE|I741|64028\nSimala|OR|I742|09090\nSimaxis|OR|I743|09088\nSimbario|VV|I744|89822\nSimeri Crichi|CZ|I745|88050\nSinagra|ME|I747|98069\nSinalunga|SI|A468|53048\nSindia|NU|I748|08018\nSini|OR|I749|09090\nSinio|CN|I750|12050\nSiniscola|NU|I751|08029\nSinnai|CA|I752|09048\nSinopoli|RC|I753|89020\nSiracusa|SR|I754|96100\nSirignano|AV|I756|83020\nSiris|OR|I757|09090\nSirmione|BS|I633|25019\nSirolo|AN|I758|60020\nSirone|LC|I759|23844\nSirtori|LC|I761|23896\nSissa Trecasali|PR|M325|43018\nSiurgus Donigala|SU|I765|09040\nSiziano|PV|E265|27010\nSizzano|NO|I767|28070\nSluderno|BZ|I771|39020\nSmerillo|FM|I774|63856\nSoave|VR|I775|37038\nSocchieve|UD|I777|33020\nSoddì|OR|I778|09080\nSogliano al Rubicone|FC|I779|47030\nSogliano Cavour|LE|I780|73010\nSoglio|AT|I781|14020\nSoiano del Lago|BS|I782|25080\nSolagna|VI|I783|36020\nSolarino|SR|I785|96010\nSolaro|MI|I786|20020\nSolarolo Rainerio|CR|I790|26030\nSolarolo|RA|I787|48027\nSolarussa|OR|I791|09077\nSolbiate Arno|VA|I793|21048\nSolbiate con Cagno|CO|M412|22043\nSolbiate Olona|VA|I794|21058\nSoldano|IM|I796|18036\nSoleminis|SU|I797|09040\nSolero|AL|I798|15029\nSolesino|PD|I799|35047\nSoleto|LE|I800|73010\nSolferino|MN|I801|46040\nSoliera|MO|I802|41019\nSolignano|PR|I803|43046\nSolofra|AV|I805|83029\nSolonghello|AL|I808|15020\nSolopaca|BN|I809|82036\nSolto Collina|BG|I812|24060\nSolza|BG|I813|24030\nSomaglia|LO|I815|26867\nSomano|CN|I817|12060\nSomma Lombardo|VA|I819|21019\nSomma Vesuviana|NA|I820|80049\nSommacampagna|VR|I821|37066\nSommariva del Bosco|CN|I822|12048\nSommariva Perno|CN|I823|12040\nSommatino|CL|I824|93019\nSommo|PV|I825|27048\nSona|VR|I826|37060\nSoncino|CR|I827|26029\nSondalo|SO|I828|23035\nSondrio|SO|I829|23100\nSongavazzo|BG|I830|24020\nSonico|BS|I831|25048\nSonnino|LT|I832|04010\nSora|FR|I838|03039\nSoraga di Fassa|TN|I839|38030\nSoragna|PR|I840|43019\nSorano|GR|I841|58010\nSorbo San Basile|CZ|I844|88050\nSorbo Serpico|AV|I843|83050\nSorbolo Mezzani|PR|M411|43058\nSordevolo|BI|I847|13817\nSordio|LO|I848|26858\nSoresina|CR|I849|26015\nSorgà|VR|I850|37060\nSorgono|NU|I851|08038\nSori|GE|I852|16031\nSorianello|VV|I853|89831\nSoriano Calabro|VV|I854|89831\nSoriano nel Cimino|VT|I855|01038\nSorico|CO|I856|22010\nSoriso|NO|I857|28010\nSorisole|BG|I858|24010\nSormano|CO|I860|22030\nSorradile|OR|I861|09080\nSorrento|NA|I862|80067\nSorso|SS|I863|07037\nSortino|SR|I864|96010\nSospiro|CR|I865|26048\nSospirolo|BL|I866|32037\nSossano|VI|I867|36040\nSostegno|BI|I868|13868\nSotto il Monte Giovanni XXIII|BG|I869|24039\nSover|TN|I871|38048\nSoverato|CZ|I872|88068\nSovere|BG|I873|24060\nSoveria Mannelli|CZ|I874|88049\nSoveria Simeri|CZ|I875|88050\nSoverzene|BL|I876|32010\nSovicille|SI|I877|53018\nSovico|MB|I878|20845\nSovizzo|VI|I879|36050\nSovramonte|BL|I673|32030\nSozzago|NO|I880|28060\nSpadafora|ME|I881|98048\nSpadola|VV|I884|89822\nSparanise|CE|I885|81056\nSparone|TO|I886|10080\nSpecchia|LE|I887|73040\nSpello|PG|I888|06038\nSperlinga|EN|I891|94010\nSperlonga|LT|I892|04029\nSperone|AV|I893|83020\nSpessa|PV|I894|27010\nSpezzano Albanese|CS|I895|87019\nSpezzano della Sila|CS|I896|87058\nSpiazzo|TN|I899|38088\nSpigno Monferrato|AL|I901|15018\nSpigno Saturnia|LT|I902|04020\nSpilamberto|MO|I903|41057\nSpilimbergo|PN|I904|33097\nSpilinga|VV|I905|89864\nSpinadesco|CR|I906|26020\nSpinazzola|BT|I907|76014\nSpinea|VE|I908|30038\nSpineda|CR|I909|26030\nSpinete|CB|I910|86020\nSpineto Scrivia|AL|I911|15050\nSpinetoli|AP|I912|63078\nSpino d'Adda|CR|I914|26016\nSpinone al Lago|BG|I916|24060\nSpinoso|PZ|I917|85039\nSpirano|BG|I919|24050\nSpoleto|PG|I921|06049\nSpoltore|PE|I922|65010\nSpongano|LE|I923|73038\nSpormaggiore|TN|I924|38010\nSporminore|TN|I925|38010\nSpotorno|SV|I926|17028\nSpresiano|TV|I927|31027\nSpriana|SO|I928|23020\nSquillace|CZ|I929|88069\nSquinzano|LE|I930|73018\nStaffolo|AN|I932|60039\nStagno Lombardo|CR|I935|26049\nStaiti|RC|I936|89030\nStalettì|CZ|I937|88069\nStanghella|PD|I938|35048\nStaranzano|GO|I939|34079\nStatte|TA|M298|74010\nStazzano|AL|I941|15060\nStazzema|LU|I942|55040\nStazzona|CO|I943|22010\nStefanaconi|VV|I945|89843\nStella Cilento|SA|G887|84070\nStella|SV|I946|17044\nStellanello|SV|I947|17020\nStelvio|BZ|I948|39029\nStenico|TN|I949|38070\nSternatia|LE|I950|73010\nStezzano|BG|I951|24040\nStienta|RO|I953|45039\nStigliano|MT|I954|75018\nStignano|RC|I955|89040\nStilo|RC|I956|89049\nStimigliano|RI|I959|02048\nStintino|SS|M290|07040\nStio|SA|I960|84075\nStornara|FG|I962|71047\nStornarella|FG|I963|71048\nStoro|TN|I964|38089\nStra|VE|I965|30039\nStradella|PV|I968|27049\nStrambinello|TO|I969|10010\nStrambino|TO|I970|10019\nStrangolagalli|FR|I973|03020\nStregna|UD|I974|33040\nStrembo|TN|I975|38080\nStresa|VB|I976|28838\nStrevi|AL|I977|15019\nStriano|NA|I978|80040\nStrona|BI|I980|13823\nStroncone|TR|I981|05039\nStrongoli|KR|I982|88816\nStroppiana|VC|I984|13010\nStroppo|CN|I985|12020\nStrozza|BG|I986|24030\nSturno|AV|I990|83055\nSuardi|PV|B014|27030\nSubbiano|AR|I991|52010\nSubiaco|RM|I992|00028\nSuccivo|CE|I993|81030\nSueglio|LC|I994|23835\nSuelli|SU|I995|09040\nSuello|LC|I996|23867\nSuisio|BG|I997|24040\nSulbiate|MB|I998|20884\nSulmona|AQ|I804|67039\nSulzano|BS|L002|25058\nSumirago|VA|L003|21040\nSummonte|AV|L004|83010\nSuni|OR|L006|09090\nSuno|NO|L007|28019\nSupersano|LE|L008|73040\nSupino|FR|L009|03019\nSurano|LE|L010|73030\nSurbo|LE|L011|73010\nSusa|TO|L013|10059\nSusegana|TV|L014|31058\nSustinente|MN|L015|46030\nSutera|CL|L016|93010\nSutri|VT|L017|01015\nSutrio|UD|L018|33020\nSuvereto|LI|L019|57028\nSuzzara|MN|L020|46029\nTaceno|LC|L022|23837\nTadasuni|OR|L023|09080\nTaggia|IM|L024|18018\nTagliacozzo|AQ|L025|67069\nTaglio di Po|RO|L026|45019\nTagliolo Monferrato|AL|L027|15070\nTaibon Agordino|BL|L030|32027\nTaino|VA|L032|21020\nTaipana|UD|G736|33040\nTalamello|RN|L034|47867\nTalamona|SO|L035|23018\nTalana|NU|L036|08040\nTaleggio|BG|L037|24010\nTalla|AR|L038|52010\nTalmassons|UD|L039|33030\nTambre|BL|L040|32010\nTaormina|ME|L042|98039\nTarano|RI|L046|02040\nTaranta Peligna|CH|L047|66018\nTarantasca|CN|L048|12020\nTaranto|TA|L049|74121-74123\nTarcento|UD|L050|33017\nTarquinia|VT|D024|01016\nTarsia|CS|L055|87040\nTartano|SO|L056|23010\nTarvisio|UD|L057|33018\nTarzo|TV|L058|31020\nTassarolo|AL|L059|15060\nTaurano|AV|L061|83020\nTaurasi|AV|L062|83030\nTaurianova|RC|L063|89029\nTaurisano|LE|L064|73056\nTavagnacco|UD|L065|33010\nTavagnasco|TO|L066|10010\nTavazzano con Villavesco|LO|F260|26838\nTavenna|CB|L069|86030\nTaverna|CZ|L070|88055\nTavernerio|CO|L071|22038\nTavernola Bergamasca|BG|L073|24060\nTavernole sul Mella|BS|C698|25060\nTaviano|LE|L074|73057\nTavigliano|BI|L075|13811\nTavoleto|PU|L078|61020\nTavullia|PU|L081|61010\nTeana|PZ|L082|85032\nTeano|CE|L083|81057\nTeggiano|SA|D292|84039\nTeglio Veneto|VE|L085|30025\nTeglio|SO|L084|23036\nTelese Terme|BN|L086|82037\nTelgate|BG|L087|24060\nTelti|SS|L088|07020\nTelve di Sopra|TN|L090|38050\nTelve|TN|L089|38050\nTempio Pausania|SS|L093|07029\nTemù|BS|L094|25050\nTenna|TN|L096|38050\nTenno|TN|L097|38060\nTeolo|PD|L100|35037\nTeora|AV|L102|83056\nTeramo|TE|L103|64100\nTerdobbiate|NO|L104|28070\nTerelle|FR|L105|03040\nTerento|BZ|L106|39030\nTerenzo|PR|E548|43040\nTergu|SS|M282|07030\nTerlano|BZ|L108|39018\nTerlizzi|BA|L109|70038\nTerme Vigliatore|ME|M210|98050\nTermeno sulla strada del vino|BZ|L111|39040\nTermini Imerese|PA|L112|90018\nTermoli|CB|L113|86039\nTernate|VA|L115|21020\nTernengo|BI|L116|13844\nTerni|TR|L117|05100\nTerno d'Isola|BG|L118|24030\nTerracina|LT|L120|04019\nTerragnolo|TN|L121|38060\nTerralba|OR|L122|09098\nTerranova da Sibari|CS|L124|87010\nTerranova dei Passerini|LO|L125|26827\nTerranova di Pollino|PZ|L126|85030\nTerranova Sappo Minulio|RC|L127|89010\nTerranuova Bracciolini|AR|L123|52028\nTerrasini|PA|L131|90049\nTerrassa Padovana|PD|L132|35020\nTerravecchia|CS|L134|87060\nTerrazzo|VR|L136|37040\nTerre d'Adige|TN|M407|38097\nTerre del Reno|FE|M381|44047\nTerre Roveresche|PU|M379|61038\nTerricciola|PI|L138|56030\nTerruggia|AL|L139|15030\nTertenia|NU|L140|08047\nTerzigno|NA|L142|80040\nTerzo d'Aquileia|UD|L144|33050\nTerzo|AL|L143|15010\nTerzolas|TN|L145|38027\nTerzorio|IM|L146|18010\nTesero|TN|L147|38038\nTesimo|BZ|L149|39010\nTessennano|VT|L150|01010\nTestico|SV|L152|17020\nTeti|NU|L153|08030\nTeulada|SU|L154|09019\nTeverola|CE|L155|81030\nTezze sul Brenta|VI|L156|36056\nThiene|VI|L157|36016\nThiesi|SS|L158|07047\nTiana|NU|L160|08020\nTicengo|CR|L164|26020\nTicineto|AL|L165|15040\nTiggiano|LE|L166|73030\nTiglieto|GE|L167|16010\nTigliole|AT|L168|14016\nTignale|BS|L169|25080\nTinnura|OR|L172|09090\nTione degli Abruzzi|AQ|L173|67020\nTione di Trento|TN|L174|38079\nTirano|SO|L175|23037\nTires|BZ|L176|39050\nTiriolo|CZ|L177|88056\nTirolo|BZ|L178|39019\nTissi|SS|L180|07040\nTito|PZ|L181|85050\nTivoli|RM|L182|00019\nTizzano Val Parma|PR|L183|43028\nToano|RE|L184|42010\nTocco Caudio|BN|L185|82030\nTocco da Casauria|PE|L186|65028\nToceno|VB|L187|28858\nTodi|PG|L188|06059\nToffia|RI|L189|02039\nToirano|SV|L190|17055\nTolentino|MC|L191|62029\nTolfa|RM|L192|00059\nTollegno|BI|L193|13818\nTollo|CH|L194|66010\nTolmezzo|UD|L195|33028\nTolve|PZ|L197|85017\nTombolo|PD|L199|35019\nTon|TN|L200|38010\nTonara|NU|L202|08039\nTonco|AT|L203|14039\nTonengo|AT|L204|14023\nTonezza del Cimone|VI|D717|36040\nTora e Piccilli|CE|L205|81044\nTorano Castello|CS|L206|87010\nTorano Nuovo|TE|L207|64010\nTorbole Casaglia|BS|L210|25030\nTorcegno|TN|L211|38050\nTorchiara|SA|L212|84076\nTorchiarolo|BR|L213|72020\nTorella dei Lombardi|AV|L214|83057\nTorella del Sannio|CB|L215|86028\nTorgiano|PG|L216|06089\nTorgnon|AO|L217|11020\nTorino di Sangro|CH|L218|66020\nTorino|TO|L219|10121-10156\nToritto|BA|L220|70020\nTorlino Vimercati|CR|L221|26017\nTornaco|NO|L223|28070\nTornareccio|CH|L224|66046\nTornata|CR|L225|26030\nTornimparte|AQ|L227|67049\nTorno|CO|L228|22020\nTornolo|PR|L229|43059\nToro|CB|L230|86018\nTorpè|NU|L231|08020\nTorraca|SA|L233|84030\nTorralba|SS|L235|07048\nTorrazza Coste|PV|L237|27050\nTorrazza Piemonte|TO|L238|10037\nTorrazzo|BI|L239|13884\nTorre Annunziata|NA|L245|80058\nTorre Beretti e Castellaro|PV|L250|27030\nTorre Boldone|BG|L251|24020\nTorre Bormida|CN|L252|12050\nTorre Cajetani|FR|L243|03010\nTorre Canavese|TO|L247|10010\nTorre d'Arese|PV|L256|27010\nTorre d'Isola|PV|L269|27020\nTorre de' Busi|BG|L257|23806\nTorre de' Negri|PV|L262|27011\nTorre de' Passeri|PE|L263|65029\nTorre de' Picenardi|CR|L258|26038\nTorre de' Roveri|BG|L265|24060\nTorre del Greco|NA|L259|80059\nTorre di Mosto|VE|L267|30020\nTorre di Ruggiero|CZ|L240|88060\nTorre di Santa Maria|SO|L244|23020\nTorre Le Nocelle|AV|L272|83030\nTorre Mondovì|CN|L241|12080\nTorre Orsaia|SA|L274|84077\nTorre Pallavicina|BG|L276|24050\nTorre Pellice|TO|L277|10066\nTorre San Giorgio|CN|L278|12030\nTorre San Patrizio|FM|L279|63814\nTorre Santa Susanna|BR|L280|72028\nTorreano|UD|L246|33040\nTorrebelvicino|VI|L248|36036\nTorrebruna|CH|L253|66050\nTorrecuso|BN|L254|82030\nTorreglia|PD|L270|35038\nTorregrotta|ME|L271|98040\nTorremaggiore|FG|L273|71017\nTorrenova|ME|M286|98070\nTorresina|CN|L281|12070\nTorretta|PA|L282|90040\nTorrevecchia Pia|PV|L285|27010\nTorrevecchia Teatina|CH|L284|66010\nTorri del Benaco|VR|L287|37010\nTorri di Quartesolo|VI|L297|36040\nTorri in Sabina|RI|L286|02049\nTorrice|FR|L290|03020\nTorricella del Pizzo|CR|L296|26040\nTorricella in Sabina|RI|L293|02030\nTorricella Peligna|CH|L291|66019\nTorricella Sicura|TE|L295|64010\nTorricella Verzate|PV|L292|27050\nTorricella|TA|L294|74020\nTorriglia|GE|L298|16029\nTorrile|PR|L299|43056\nTorrioni|AV|L301|83010\nTorrita di Siena|SI|L303|53049\nTorrita Tiberina|RM|L302|00060\nTortolì|NU|A355|08048\nTortona|AL|L304|15057\nTortora|CS|L305|87020\nTortorella|SA|L306|84030\nTortoreto|TE|L307|64018\nTortorici|ME|L308|98078\nTorviscosa|UD|L309|33050\nToscolano-Maderno|BS|L312|25088\nTossicia|TE|L314|64049\nTovo di Sant'Agata|SO|L316|23030\nTovo San Giacomo|SV|L315|17020\nTrabia|PA|L317|90019\nTradate|VA|L319|21049\nTramatza|OR|L321|09070\nTrambileno|TN|L322|38068\nTramonti di Sopra|PN|L324|33090\nTramonti di Sotto|PN|L325|33090\nTramonti|SA|L323|84010\nTramutola|PZ|L326|85057\nTrana|TO|L327|10090\nTrani|BT|L328|76125\nTraona|SO|L330|23019\nTrapani|TP|L331|91100\nTrappeto|PA|L332|90040\nTrarego Viggiona|VB|L333|28826\nTrasacco|AQ|L334|67059\nTrasaghis|UD|L335|33010\nTrasquera|VB|L336|28868\nTratalias|SU|L337|09010\nTravacò Siccomario|PV|I236|27020\nTravagliato|BS|L339|25039\nTravedona-Monate|VA|L342|21028\nTraversella|TO|L345|10080\nTraversetolo|PR|L346|43029\nTraves|TO|L340|10070\nTravesio|PN|L347|33090\nTravo|PC|L348|29020\nTre Ville|TN|M361|38095\nTrebaseleghe|PD|L349|35010\nTrebisacce|CS|L353|87075\nTrecase|NA|M280|80040\nTrecastagni|CT|L355|95039\nTrecastelli|AN|M318|60012\nTrecate|NO|L356|28069\nTrecchina|PZ|L357|85049\nTrecenta|RO|L359|45027\nTredozio|FC|L361|47019\nTreglio|CH|L363|66030\nTregnago|VR|L364|37039\nTreia|MC|L366|62010\nTreiso|CN|L367|12050\nTremestieri Etneo|CT|L369|95030\nTremezzina|CO|M341|22016\nTremosine sul Garda|BS|L372|25010\nTrentinara|SA|L377|84070\nTrento|TN|L378|38121-38123\nTrentola Ducenta|CE|L379|81038\nTrenzano|BS|L380|25030\nTreppo Grande|UD|L382|33010\nTreppo Ligosullo|UD|M399|33014\nTrepuzzi|LE|L383|73019\nTrequanda|SI|L384|53020\nTresana|MS|L386|54012\nTrescore Balneario|BG|L388|24069\nTrescore Cremasco|CR|L389|26017\nTresignana|FE|M409|44039\nTresivio|SO|L392|23020\nTresnuraghes|OR|L393|09079\nTrevenzuolo|VR|L396|37060\nTrevi nel Lazio|FR|L398|03010\nTrevi|PG|L397|06039\nTrevico|AV|L399|83058\nTreviglio|BG|L400|24047\nTrevignano Romano|RM|L401|00069\nTrevignano|TV|L402|31040\nTreville|AL|L403|15030\nTreviolo|BG|L404|24048\nTreviso Bresciano|BS|L406|25070\nTreviso|TV|L407|31100\nTrezzano Rosa|MI|L408|20060\nTrezzano sul Naviglio|MI|L409|20090\nTrezzo sull'Adda|MI|L411|20056\nTrezzo Tinella|CN|L410|12050\nTrezzone|CO|L413|22010\nTribano|PD|L414|35020\nTribiano|MI|L415|20067\nTribogna|GE|L416|16030\nTricarico|MT|L418|75019\nTricase|LE|L419|73039\nTricerro|VC|L420|13038\nTricesimo|UD|L421|33019\nTriei|NU|L423|08040\nTrieste|TS|L424|34121-34151\nTriggiano|BA|L425|70019\nTrigolo|CR|L426|26018\nTrinità d'Agultu e Vignola|SS|L428|07038\nTrinità|CN|L427|12049\nTrinitapoli|BT|B915|76015\nTrino|VC|L429|13039\nTriora|IM|L430|18010\nTripi|ME|L431|98060\nTrisobbio|AL|L432|15070\nTrissino|VI|L433|36070\nTriuggio|MB|L434|20844\nTrivento|CB|L435|86029\nTrivigliano|FR|L437|03010\nTrivignano Udinese|UD|L438|33050\nTrivigno|PZ|L439|85018\nTrivolzio|PV|L440|27020\nTrodena nel parco naturale|BZ|L444|39040\nTrofarello|TO|L445|10028\nTroia|FG|L447|71029\nTroina|EN|L448|94018\nTromello|PV|L449|27020\nTrontano|VB|L450|28859\nTronzano Lago Maggiore|VA|A705|21010\nTronzano Vercellese|VC|L451|13049\nTropea|VV|L452|89861\nTrovo|PV|L453|27020\nTruccazzano|MI|L454|20060\nTubre|BZ|L455|39020\nTufara|CB|L458|86010\nTufillo|CH|L459|66050\nTufino|NA|L460|80030\nTufo|AV|L461|83010\nTuglie|LE|L462|73058\nTuili|SU|L463|09029\nTula|SS|L464|07010\nTuoro sul Trasimeno|PG|L466|06069\nTurania|RI|G507|02020\nTurano Lodigiano|LO|L469|26828\nTurate|CO|L470|22078\nTurbigo|MI|L471|20029\nTuri|BA|L472|70010\nTurri|SU|L473|09020\nTurriaco|GO|L474|34070\nTurrivalignani|PE|L475|65020\nTursi|MT|L477|75028\nTusa|ME|L478|98079\nTuscania|VT|L310|01017\nUbiale Clanezzo|BG|C789|24010\nUboldo|VA|L480|21040\nUcria|ME|L482|98060\nUdine|UD|L483|33100\nUgento|LE|L484|73059\nUggiano la Chiesa|LE|L485|73020\nUggiate-Trevano|CO|L487|22029\nUlà Tirso|OR|L488|09080\nUlassai|NU|L489|08040\nUltimo|BZ|L490|39016\nUmbertide|PG|D786|06019\nUmbriatico|KR|L492|88823\nUrago d'Oglio|BS|L494|25030\nUras|OR|L496|09099\nUrbana|PD|L497|35040\nUrbania|PU|L498|61049\nUrbe|SV|L499|17048\nUrbino|PU|L500|61029\nUrbisaglia|MC|L501|62010\nUrgnano|BG|L502|24059\nUri|SS|L503|07040\nUruri|CB|L505|86049\nUrzulei|NU|L506|08040\nUscio|GE|L507|16036\nUsellus|OR|L508|09090\nUsini|SS|L509|07049\nUsmate Velate|MB|L511|20865\nUssana|SU|L512|09020\nUssaramanna|SU|L513|09020\nUssassai|NU|L514|08040\nUsseaux|TO|L515|10060\nUsseglio|TO|L516|10070\nUssita|MC|L517|62039\nUstica|PA|L519|90051\nUta|CA|L521|09068\nUzzano|PT|L522|51010\nVaccarizzo Albanese|CS|L524|87060\nVacone|RI|L525|02040\nVacri|CH|L526|66010\nVadena|BZ|L527|39051\nVado Ligure|SV|L528|17047\nVagli Sotto|LU|L533|55030\nVaglia|FI|L529|50036\nVaglio Basilicata|PZ|L532|85010\nVaglio Serra|AT|L531|14049\nVaiano Cremasco|CR|L535|26010\nVaiano|PO|L537|59021\nVaie|TO|L538|10050\nVailate|CR|L539|26019\nVairano Patenora|CE|L540|81058\nVajont|PN|M265|33080\nVal Brembilla|BG|M334|24012\nVal della Torre|TO|L555|10040\nVal di Chy|TO|M405|10039\nVal di Nizza|PV|L562|27050\nVal di Vizze|BZ|L564|39049\nVal di Zoldo|BL|M374|32012\nVal Liona|VI|M384|36044\nVal Masino|SO|L638|23010\nVal Rezzo|CO|H259|22010\nValbondione|BG|L544|24020\nValbrembo|BG|L545|24030\nValbrenta|VI|M423|36029\nValbrevenna|GE|L546|16010\nValbrona|CO|L547|22039\nValchiusa|TO|M415|10089\nValdagno|VI|L551|36078\nValdaone|TN|M343|38091\nValdaora|BZ|L552|39030\nValdastico|VI|L554|36040\nValdengo|BI|L556|13855\nValderice|TP|G319|91019\nValdidentro|SO|L557|23038\nValdieri|CN|L558|12010\nValdilana|BI|M417|13835\nValdina|ME|L561|98040\nValdisotto|SO|L563|23030\nValdobbiadene|TV|L565|31049\nValduggia|VC|L566|13018\nValeggio sul Mincio|VR|L567|37067\nValeggio|PV|L568|27020\nValentano|VT|L569|01018\nValenza|AL|L570|15048\nValenzano|BA|L571|70010\nValera Fratta|LO|L572|26859\nValfabbrica|PG|L573|06029\nValfenera|AT|L574|14017\nValfloriana|TN|L575|38040\nValfornace|MC|M382|62031\nValfurva|SO|L576|23030\nValganna|VA|L577|21039\nValgioie|TO|L578|10094\nValgoglio|BG|L579|24020\nValgrana|CN|L580|12020\nValgreghentino|LC|L581|23857\nValgrisenche|AO|L582|11010\nValguarnera Caropepe|EN|L583|94019\nVallada Agordina|BL|L584|32020\nVallanzengo|BI|L586|13847\nVallarsa|TN|L588|38060\nVallata|AV|L589|83059\nValle Agricola|CE|L594|81010\nValle Aurina|BZ|L595|39030\nValle Cannobina|VB|M404|28827\nValle Castellana|TE|L597|64010\nValle dell'Angelo|SA|G540|84070\nValle di Cadore|BL|L590|32040\nValle di Casies|BZ|L601|39030\nValle di Maddaloni|CE|L591|81020\nValle Lomellina|PV|L593|27020\nValle Salimbene|PV|L617|27010\nValle San Nicolao|BI|L620|13847\nVallebona|IM|L596|18012\nVallecorsa|FR|L598|03020\nVallecrosia|IM|L599|18019\nValledolmo|PA|L603|90029\nValledoria|SS|L604|07039\nVallefiorita|CZ|I322|88050\nVallefoglia|PU|M331|61022\nVallelaghi|TN|M362|38096\nVallelonga|VV|L607|89821\nVallelunga Pratameno|CL|L609|93010\nVallemaio|FR|L605|03040\nVallepietra|RM|L611|00020\nVallerano|VT|L612|01030\nVallermosa|SU|L613|09010\nVallerotonda|FR|L614|03040\nVallesaccarda|AV|L616|83050\nValleve|BG|L623|24010\nValli del Pasubio|VI|L624|36030\nVallinfreda|RM|L625|00020\nVallio Terme|BS|L626|25080\nVallo della Lucania|SA|L628|84078\nVallo di Nera|PG|L627|06040\nVallo Torinese|TO|L629|10070\nValloriate|CN|L631|12010\nValmacca|AL|L633|15040\nValmadrera|LC|L634|23868\nValmontone|RM|L639|00038\nValmorea|CO|L640|22070\nValmozzola|PR|L641|43050\nValnegra|BG|L642|24010\nValpelline|AO|L643|11010\nValperga|TO|L644|10087\nValprato Soana|TO|B510|10080\nValsamoggia|BO|M320|40053\nValsavarenche|AO|L647|11010\nValsinni|MT|D513|75029\nValsolda|CO|C936|22010\nValstrona|VB|L651|28897\nValtopina|PG|L653|06030\nValtorta|BG|L655|24010\nValtournenche|AO|L654|11028\nValva|SA|L656|84020\nValvarrone|LC|M395|23836\nValvasone Arzene|PN|M346|33098\nValverde|CT|L658|95028\nValvestino|BS|L468|25080\nVandoies|BZ|L660|39030\nVanzaghello|MI|L664|20020\nVanzago|MI|L665|20010\nVanzone con San Carlo|VB|L666|28879\nVaprio d'Adda|MI|L667|20069\nVaprio d'Agogna|NO|L668|28010\nVarallo Pombia|NO|L670|28040\nVarallo|VC|L669|13019\nVarano Borghi|VA|L671|21020\nVarano de' Melegari|PR|L672|43040\nVarapodio|RC|L673|89010\nVarazze|SV|L675|17019\nVarco Sabino|RI|L676|02020\nVaredo|MB|L677|20814\nVarenna|LC|L680|23829\nVarese Ligure|SP|L681|19028\nVarese|VA|L682|21100\nVarisella|TO|L685|10070\nVarmo|UD|L686|33030\nVarna|BZ|L687|39040\nVarsi|PR|L689|43049\nVarzi|PV|L690|27057\nVarzo|VB|L691|28868\nVasanello|VT|A701|01030\nVasia|IM|L693|18020\nVasto|CH|E372|66054\nVastogirardi|IS|L696|86089\nVauda Canavese|TO|L698|10070\nVazzano|VV|L699|89834\nVazzola|TV|L700|31028\nVecchiano|PI|L702|56019\nVedano al Lambro|MB|L704|20854\nVedano Olona|VA|L703|21040\nVedelago|TV|L706|31050\nVedeseta|BG|L707|24010\nVeduggio con Colzano|MB|L709|20837\nVeggiano|PD|L710|35030\nVeglie|LE|L711|73010\nVeglio|BI|L712|13824\nVejano|VT|L713|01010\nVeleso|CO|L715|22020\nVelezzo Lomellina|PV|L716|27020\nVelletri|RM|L719|00049\nVellezzo Bellini|PV|L720|27010\nVelo d'Astico|VI|L723|36010\nVelo Veronese|VR|L722|37030\nVelturno|BZ|L724|39040\nVenafro|IS|L725|86079\nVenaria Reale|TO|L727|10078\nVenarotta|AP|L728|63091\nVenasca|CN|L729|12020\nVenaus|TO|L726|10050\nVendone|SV|L730|17032\nVenegono Inferiore|VA|L733|21040\nVenegono Superiore|VA|L734|21040\nVenetico|ME|L735|98040\nVenezia|VE|L736|30121-30176\nVeniano|CO|L737|22070\nVenosa|PZ|L738|85029\nVentasso|RE|M364|42032\nVenticano|AV|L739|83030\nVentimiglia di Sicilia|PA|L740|90020\nVentimiglia|IM|L741|18039\nVentotene|LT|L742|04031\nVenzone|UD|L743|33010\nVerano Brianza|MB|L744|20843\nVerano|BZ|L745|39010\nVerbania|VB|L746|28921-28925\nVerbicaro|CS|L747|87020\nVercana|CO|L748|22013\nVerceia|SO|L749|23020\nVercelli|VC|L750|13100\nVercurago|LC|L751|23808\nVerdellino|BG|L752|24040\nVerdello|BG|L753|24049\nVerderio|LC|M337|23879\nVerduno|CN|L758|12060\nVergato|BO|L762|40038\nVerghereto|FC|L764|47028\nVergiate|VA|L765|21029\nVermezzo con Zelo|MI|M424|20071\nVermiglio|TN|L769|38029\nVernante|CN|L771|12019\nVernasca|PC|L772|29010\nVernate|MI|L773|20080\nVernazza|SP|L774|19018\nVernio|PO|L775|59024\nVernole|LE|L776|73029\nVerolanuova|BS|L777|25028\nVerolavecchia|BS|L778|25029\nVerolengo|TO|L779|10038\nVeroli|FR|L780|03029\nVerona|VR|L781|37121-37142\nVeronella|VR|D193|37040\nVerrayes|AO|L783|11020\nVerrès|AO|C282|11029\nVerretto|PV|L784|27053\nVerrone|BI|L785|13871\nVerrua Po|PV|L788|27040\nVerrua Savoia|TO|L787|10020\nVertemate con Minoprio|CO|L792|22070\nVertova|BG|L795|24029\nVerucchio|RN|L797|47826\nVervio|SO|L799|23030\nVerzegnis|UD|L801|33020\nVerzino|KR|L802|88819\nVerzuolo|CN|L804|12039\nVescovana|PD|L805|35040\nVescovato|CR|L806|26039\nVesime|AT|L807|14059\nVespolate|NO|L808|28079\nVessalico|IM|L809|18026\nVestenanova|VR|L810|37030\nVestignè|TO|L811|10030\nVestone|BS|L812|25078\nVetralla|VT|L814|01019\nVetto|RE|L815|42020\nVezza d'Alba|CN|L817|12040\nVezza d'Oglio|BS|L816|25059\nVezzano Ligure|SP|L819|19020\nVezzano sul Crostolo|RE|L820|42030\nVezzi Portio|SV|L823|17028\nViadana|MN|L826|46019\nViadanica|BG|L827|24060\nViagrande|CT|L828|95029\nViale|AT|L829|14010\nVialfrè|TO|L830|10090\nViano|RE|L831|42030\nViareggio|LU|L833|55049\nViarigi|AT|L834|14030\nVibo Valentia|VV|F537|89900\nVibonati|SA|L835|84079\nVicalvi|FR|L836|03030\nVicari|PA|L837|90020\nVicchio|FI|L838|50039\nVicenza|VI|L840|36100\nVico del Gargano|FG|L842|71018\nVico Equense|NA|L845|80069\nVico nel Lazio|FR|L843|03010\nVicoforte|CN|L841|12080\nVicoli|PE|L846|65010\nVicolungo|NO|L847|28060\nVicopisano|PI|L850|56010\nVicovaro|RM|L851|00029\nViddalba|SS|M259|07030\nVidigulfo|PV|L854|27018\nVidor|TV|L856|31020\nVidracco|TO|L857|10080\nVieste|FG|L858|71019\nVietri di Potenza|PZ|L859|85058\nVietri sul Mare|SA|L860|84019\nVigano San Martino|BG|L865|24060\nViganò|LC|L866|23897\nVigarano Mainarda|FE|L868|44049\nVigasio|VR|L869|37068\nVigevano|PV|L872|27029\nViggianello|PZ|L873|85040\nViggiano|PZ|L874|85059\nViggiù|VA|L876|21059\nVighizzolo d'Este|PD|L878|35040\nVigliano Biellese|BI|L880|13856\nVigliano d'Asti|AT|L879|14040\nVignale Monferrato|AL|L881|15049\nVignanello|VT|L882|01039\nVignate|MI|L883|20060\nVignola-Falesina|TN|L886|38057\nVignola|MO|L885|41058\nVignole Borbera|AL|L887|15060\nVignolo|CN|L888|12010\nVignone|VB|L889|28819\nVigo di Cadore|BL|L890|32040\nVigodarzere|PD|L892|35010\nVigolo|BG|L894|24060\nVigolzone|PC|L897|29020\nVigone|TO|L898|10067\nVigonovo|VE|L899|30030\nVigonza|PD|L900|35010\nViguzzolo|AL|L904|15058\nVilla Bartolomea|VR|L912|37049\nVilla Basilica|LU|L913|55019\nVilla Biscossi|PV|L917|27035\nVilla Carcina|BS|L919|25069\nVilla Castelli|BR|L920|72029\nVilla Celiera|PE|L922|65010\nVilla Collemandina|LU|L926|55030\nVilla Cortese|MI|L928|20020\nVilla d'Adda|BG|L929|24030\nVilla d'Almè|BG|A215|24018\nVilla d'Ogna|BG|L938|24020\nVilla del Bosco|BI|L933|13868\nVilla del Conte|PD|L934|35010\nVilla di Briano|CE|D801|81030\nVilla di Chiavenna|SO|L907|23029\nVilla di Serio|BG|L936|24020\nVilla di Tirano|SO|L908|23030\nVilla Estense|PD|L937|35040\nVilla Faraldi|IM|L943|18010\nVilla Guardia|CO|L956|22079\nVilla Lagarina|TN|L957|38060\nVilla Latina|FR|A081|03040\nVilla Literno|CE|L844|81039\nVilla Minozzo|RE|L969|42030\nVilla San Giovanni in Tuscia|VT|H913|01010\nVilla San Giovanni|RC|M018|89018\nVilla San Pietro|CA|I118|09050\nVilla San Secondo|AT|M019|14020\nVilla Sant'Angelo|AQ|M023|67020\nVilla Sant'Antonio|OR|I298|09080\nVilla Santa Lucia degli Abruzzi|AQ|M021|67020\nVilla Santa Lucia|FR|L905|03030\nVilla Santa Maria|CH|M022|66047\nVilla Santina|UD|L909|33029\nVilla Santo Stefano|FR|I364|03020\nVilla Verde|OR|A609|09090\nVillabassa|BZ|L915|39039\nVillabate|PA|L916|90039\nVillachiara|BS|L923|25030\nVillacidro|SU|L924|09039\nVilladeati|AL|L931|15020\nVilladose|RO|L939|45010\nVilladossola|VB|L906|28844\nVillafalletto|CN|L942|12020\nVillafranca d'Asti|AT|L945|14018\nVillafranca di Verona|VR|L949|37069\nVillafranca in Lunigiana|MS|L946|54028\nVillafranca Padovana|PD|L947|35010\nVillafranca Piemonte|TO|L948|10068\nVillafranca Sicula|AG|L944|92020\nVillafranca Tirrena|ME|L950|98049\nVillafrati|PA|L951|90030\nVillaga|VI|L952|36021\nVillagrande Strisaili|NU|L953|08049\nVillalago|AQ|L958|67030\nVillalba|CL|L959|93010\nVillalfonsina|CH|L961|66020\nVillalvernia|AL|L963|15050\nVillamagna|CH|L964|66010\nVillamaina|AV|L965|83050\nVillamar|SU|L966|09020\nVillamarzana|RO|L967|45030\nVillamassargia|SU|L968|09010\nVillamiroglio|AL|L970|15020\nVillandro|BZ|L971|39040\nVillanova Biellese|BI|L978|13877\nVillanova Canavese|TO|L982|10070\nVillanova d'Albenga|SV|L975|17038\nVillanova d'Ardenghi|PV|L983|27030\nVillanova d'Asti|AT|L984|14019\nVillanova del Battista|AV|L973|83030\nVillanova del Ghebbo|RO|L985|45020\nVillanova del Sillaro|LO|L977|26818\nVillanova di Camposampiero|PD|L979|35010\nVillanova Marchesana|RO|L988|45030\nVillanova Mondovì|CN|L974|12089\nVillanova Monferrato|AL|L972|15030\nVillanova Monteleone|SS|L989|07019\nVillanova Solaro|CN|L990|12030\nVillanova sull'Arda|PC|L980|29010\nVillanova Truschedu|OR|L991|09084\nVillanova Tulo|SU|L992|09066\nVillanovaforru|SU|L986|09020\nVillanovafranca|SU|L987|09020\nVillanterio|PV|L994|27019\nVillanuova sul Clisi|BS|L995|25089\nVillaperuccio|SU|M278|09010\nVillapiana|CS|B903|87076\nVillaputzu|SU|L998|09040\nVillar Dora|TO|L999|10040\nVillar Focchiardo|TO|M007|10050\nVillar Pellice|TO|M013|10060\nVillar Perosa|TO|M014|10069\nVillar San Costanzo|CN|M015|12020\nVillarbasse|TO|M002|10090\nVillarboit|VC|M003|13030\nVillareggia|TO|M004|10030\nVillaricca|NA|G309|80010\nVillaromagnano|AL|M009|15050\nVillarosa|EN|M011|94010\nVillasalto|SU|M016|09040\nVillasanta|MB|M017|20852\nVillasimius|SU|B738|09049\nVillasor|SU|M025|09034\nVillaspeciosa|SU|M026|09010\nVillastellone|TO|M027|10029\nVillata|VC|M028|13010\nVillaurbana|OR|M030|09080\nVillavallelonga|AQ|M031|67050\nVillaverla|VI|M032|36030\nVille d'Anaunia|TN|M363|38019\nVille di Fiemme|TN|M431|38030,38033\nVilleneuve|AO|L981|11018\nVillesse|GO|M043|34070\nVilletta Barrea|AQ|M041|67030\nVillette|VB|M042|28856\nVillimpenta|MN|M044|46039\nVillongo|BG|M045|24060\nVillorba|TV|M048|31020\nVilminore di Scalve|BG|M050|24020\nVimercate|MB|M052|20871\nVimodrone|MI|M053|20090\nVinadio|CN|M055|12010\nVinchiaturo|CB|M057|86019\nVinchio|AT|M058|14040\nVinci|FI|M059|50059\nVinovo|TO|M060|10048\nVinzaglio|NO|M062|28060\nViola|CN|M063|12070\nVione|BS|M065|25050\nVipiteno|BZ|M067|39049\nVirle Piemonte|TO|M069|10060\nVisano|BS|M070|25010\nVische|TO|M071|10030\nVisciano|NA|M072|80030\nVisco|UD|M073|33040\nVisone|AL|M077|15010\nVisso|MC|M078|62039\nVistarino|PV|M079|27010\nVistrorio|TO|M080|10080\nVita|TP|M081|91010\nViterbo|VT|M082|01100\nViticuso|FR|M083|03040\nVito d'Asio|PN|M085|33090\nVitorchiano|VT|M086|01030\nVittoria|RG|M088|97019\nVittorio Veneto|TV|M089|31029\nVittorito|AQ|M090|67030\nVittuone|MI|M091|20010\nVitulano|BN|M093|82038\nVitulazio|CE|M092|81041\nViù|TO|M094|10070\nVivaro Romano|RM|M095|00020\nVivaro|PN|M096|33099\nViverone|BI|M098|13886\nVizzini|CT|M100|95049\nVizzola Ticino|VA|M101|21010\nVizzolo Predabissi|MI|M102|20070\nVo'|PD|M103|35030\nVobarno|BS|M104|25079\nVobbia|GE|M105|16010\nVocca|VC|M106|13020\nVodo Cadore|BL|M108|32040\nVoghera|PV|M109|27058\nVoghiera|FE|M110|44019\nVogogna|VB|M111|28805\nVolano|TN|M113|38060\nVolla|NA|M115|80040\nVolongo|CR|M116|26030\nVolpago del Montello|TV|M118|31040\nVolpara|PV|M119|27047\nVolpedo|AL|M120|15059\nVolpeglino|AL|M121|15050\nVolpiano|TO|M122|10088\nVolta Mantovana|MN|M125|46049\nVoltaggio|AL|M123|15060\nVoltago Agordino|BL|M124|32020\nVolterra|PI|M126|56048\nVoltido|CR|M127|26030\nVolturara Appula|FG|M131|71030\nVolturara Irpina|AV|M130|83050\nVolturino|FG|M132|71030\nVolvera|TO|M133|10040\nVottignasco|CN|M136|12020\nZaccanopoli|VV|M138|89867\nZafferana Etnea|CT|M139|95019\nZagarise|CZ|M140|88050\nZagarolo|RM|M141|00039\nZambrone|VV|M143|89868\nZandobbio|BG|M144|24060\nZanè|VI|M145|36010\nZanica|BG|M147|24050\nZapponeta|FG|M267|71030\nZavattarello|PV|M150|27059\nZeccone|PV|M152|27010\nZeddiani|OR|M153|09070\nZelbio|CO|M156|22020\nZelo Buon Persico|LO|M158|26839\nZeme|PV|M161|27030\nZenevredo|PV|M162|27049\nZenson di Piave|TV|M163|31050\nZerba|PC|M165|29020\nZerbo|PV|M166|27017\nZerbolò|PV|M167|27020\nZerfaliu|OR|M168|09070\nZeri|MS|M169|54029\nZermeghedo|VI|M170|36050\nZero Branco|TV|M171|31059\nZevio|VR|M172|37059\nZiano di Fiemme|TN|M173|38030\nZiano Piacentino|PC|L848|29010\nZibido San Giacomo|MI|M176|20080\nZignago|SP|M177|19020\nZimella|VR|M178|37040\nZimone|BI|M179|13887\nZinasco|PV|M180|27030\nZoagli|GE|M182|16035\nZocca|MO|M183|41059\nZogno|BG|M184|24019\nZola Predosa|BO|M185|40069\nZollino|LE|M187|73010\nZone|BS|M188|25050\nZoppè di Cadore|BL|M189|32010\nZoppola|PN|M190|33080\nZovencedo|VI|M194|36020\nZubiena|BI|M196|13888\nZuccarello|SV|M197|17039\nZugliano|VI|M199|36030\nZuglio|UD|M200|33020\nZumaglia|BI|M201|13848\nZumpano|CS|M202|87040\nZungoli|AV|M203|83030\nZungri|VV|M204|89867";

// ===== 04_comuni.js =====
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

// ===== 05_indirizzi.js =====
/**
 * Indirizzi: normalizzazione, controlli di completezza/coerenza, confronto e
 * conversione nel formato Shopify (MailingAddressInput).
 */

var Indirizzi = (function () {
  var PAESI = {
    italia: 'IT', italy: 'IT', it: 'IT', svizzera: 'CH', switzerland: 'CH', ch: 'CH',
    'san marino': 'SM', sm: 'SM', germania: 'DE', germany: 'DE', francia: 'FR', france: 'FR',
    austria: 'AT', spagna: 'ES', spain: 'ES', bulgaria: 'BG', 'regno unito': 'GB',
    'stati uniti': 'US', usa: 'US'
  };
  var TIPI_VIA = /\b(via|viale|piazza|piazzale|piazzetta|corso|largo|strada|str|vicolo|contrada|localita|frazione|borgo|salita|lungomare|lungo|traversa|rione|v|p|za|zza|le|so|go)\b/g;
  var PARTICELLE = /\b(di|del|dello|della|dei|degli|delle|da|dal|dalla|in|e|a|al|alla|ai|agli|alle|san|santa|santo|s)\b/g;
  var CIVICO_FINALE = /^(.*?)[,\s]+((?:n\.?\s*)?\d+\s*[A-Za-z]?(?:\s*\/\s*[A-Za-z0-9]+)?|snc|s\.n\.c\.?)\s*$/i;

  function t(s) {
    return Testo.spazi(s);
  }

  function codicePaese(paese) {
    var p = Testo.chiave(paese);
    if (!p) return 'IT';
    if (/^[a-z]{2}$/.test(p)) return p.toUpperCase();
    return PAESI[p] || 'IT';
  }

  /** Separa "Via Roma 16" in via + civico quando il civico non è stato indicato a parte. */
  function separaCivico(via, civico) {
    var v = t(via);
    var c = t(civico);
    if (c) return { via: v, civico: c };
    var m = CIVICO_FINALE.exec(v);
    if (m) return { via: t(m[1]), civico: t(m[2]).replace(/^n\.?\s*/i, '') };
    return { via: v, civico: '' };
  }

  function normalizzaCivico(civico) {
    var c = t(civico).replace(/^n\.?\s*/i, '').replace(/\s*\/\s*/g, '/');
    if (/^s\.?n\.?c\.?$/i.test(c)) return 'snc';
    return c.toUpperCase();
  }

  /** Normalizza un indirizzo interno (vedi la struttura in fondo al file). */
  function normalizza(ind) {
    var sep = separaCivico(ind.via, ind.civico);
    var paese = codicePaese(ind.paese);
    var n = {
      via: paese === 'IT' ? Testo.maiuscoleIndirizzo(sep.via) : t(sep.via),
      civico: normalizzaCivico(sep.civico),
      dettagli: t(ind.dettagli),
      cap: t(ind.cap).replace(/\s+/g, ''),
      comune: t(ind.comune),
      provincia: t(ind.provincia).toUpperCase().replace(/[^A-Z]/g, ''),
      paese: paese,
      presso: t(ind.presso),
      destinatarioNome: Testo.maiuscoleNome(ind.destinatarioNome),
      destinatarioCognome: Testo.maiuscoleNome(ind.destinatarioCognome),
      telefono: t(ind.telefono)
    };
    if (paese === 'IT') {
      if (/^\d{4}$/.test(n.cap)) n.cap = '0' + n.cap;
      var comune = Comuni.trova(n.comune, n.provincia || null);
      if (comune) {
        n.comune = comune.nome;
        if (!n.provincia) n.provincia = comune.sigla;
      } else {
        n.comune = Testo.maiuscoleIndirizzo(n.comune);
      }
      if (!n.provincia && n.cap) n.provincia = Comuni.siglaDaCap(n.cap) || '';
      if (n.presso && !/^c\/o\b/i.test(n.presso)) n.presso = 'C/O ' + n.presso;
    }
    return n;
  }

  /** Controlla completezza e coerenza. problemi = bloccanti, avvisi = informativi. */
  function valida(ind) {
    var problemi = [];
    var avvisi = [];
    if (!ind.via) problemi.push('via mancante');
    if (!ind.comune) problemi.push('comune mancante');
    if (ind.paese === 'IT') {
      if (!ind.civico) problemi.push('numero civico mancante');
      if (!/^\d{5}$/.test(ind.cap)) problemi.push('CAP mancante o non valido');
      if (!Comuni.siglaValida(ind.provincia)) problemi.push('provincia mancante o non valida');
      if (/^\d{5}$/.test(ind.cap) && Comuni.siglaValida(ind.provincia)) {
        var coerente = Comuni.capCoerente(ind.cap, ind.provincia);
        if (coerente === false) problemi.push('CAP ' + ind.cap + ' non compatibile con la provincia ' + ind.provincia);
        if (coerente === null) avvisi.push('CAP non verificabile');
      }
      if (ind.comune && !Comuni.trova(ind.comune, ind.provincia)) {
        avvisi.push('comune "' + ind.comune + '" non presente in tabella (frazione o nome diverso)');
      }
    } else if (!ind.cap) {
      problemi.push('codice postale mancante');
    }
    return { ok: problemi.length === 0, problemi: problemi, avvisi: avvisi };
  }

  function chiaveVia(via) {
    return Testo.chiave(via).replace(TIPI_VIA, ' ').replace(PARTICELLE, ' ').replace(/\s+/g, ' ').trim();
  }

  function chiaveConfronto(ind) {
    return [chiaveVia(ind.via), Testo.chiave(ind.civico).replace(/\s+/g, ''), t(ind.cap)].join('|');
  }

  function uguali(a, b) {
    if (!a || !b) return false;
    return chiaveConfronto(a) === chiaveConfronto(b);
  }

  function address1(ind) {
    return t(ind.via + (ind.civico ? ' ' + ind.civico : ''));
  }

  /** Converte in MailingAddressInput di Shopify. persona = {nome, cognome, azienda, telefono}. */
  function perShopify(ind, persona) {
    var indirizzo = {
      address1: address1(ind),
      city: ind.comune,
      zip: ind.cap,
      countryCode: ind.paese,
      firstName: persona.nome || null,
      lastName: persona.cognome || null
    };
    if (ind.dettagli) indirizzo.address2 = ind.dettagli;
    if (ind.paese === 'IT' && ind.provincia) indirizzo.provinceCode = ind.provincia;
    if (persona.azienda) indirizzo.company = persona.azienda;
    if (persona.telefono) indirizzo.phone = persona.telefono;
    return indirizzo;
  }

  /** Indirizzo letto da Shopify -> MailingAddressInput completo (per aggiornarlo senza perdere campi). */
  function daShopifyAInput(a) {
    var input = {};
    ['address1', 'address2', 'city', 'company', 'firstName', 'lastName', 'phone', 'provinceCode', 'zip'].forEach(function (k) {
      if (a && a[k] !== null && a[k] !== undefined && a[k] !== '') input[k] = a[k];
    });
    if (a && (a.countryCodeV2 || a.countryCode)) input.countryCode = a.countryCodeV2 || a.countryCode;
    return input;
  }

  /** Converte un indirizzo letto da Shopify nella struttura interna (per i confronti). */
  function daShopify(a) {
    var sep = separaCivico(a.address1, '');
    return normalizza({
      via: sep.via, civico: sep.civico, dettagli: a.address2, cap: a.zip, comune: a.city,
      provincia: a.provinceCode, paese: a.countryCodeV2 || a.countryCode || 'IT'
    });
  }

  return {
    normalizza: normalizza,
    valida: valida,
    uguali: uguali,
    chiaveConfronto: chiaveConfronto,
    perShopify: perShopify,
    daShopify: daShopify,
    daShopifyAInput: daShopifyAInput,
    address1: address1,
    separaCivico: separaCivico,
    codicePaese: codicePaese
  };
})();

/*
 * Struttura interna di un indirizzo:
 * { via, civico, dettagli, cap, comune, provincia, paese, presso,
 *   destinatarioNome, destinatarioCognome, telefono }
 */

// ===== 06_telefono.js =====
/**
 * Numeri di telefono: normalizzazione nel formato internazionale E.164 (+39...).
 */

var Telefono = (function () {
  /** Restituisce il numero in formato E.164 oppure '' se non è un numero plausibile. */
  function normalizza(numero, paese) {
    var grezzo = String(numero || '').trim();
    if (!grezzo) return '';
    var n = grezzo.replace(/[\s.\-()/]/g, '');
    if (/^00\d/.test(n)) n = '+' + n.slice(2);
    if (!/^\+?\d+$/.test(n)) return '';
    var italia = !paese || String(paese).toUpperCase() === 'IT';
    if (n.charAt(0) !== '+') {
      if (!italia) return '';
      if (/^39(3\d{8,9}|0\d{5,10})$/.test(n)) n = '+' + n;
      else if (/^3\d{8,9}$/.test(n) || /^0\d{5,10}$/.test(n)) n = '+39' + n;
      else return '';
    }
    if (/^\+39/.test(n)) return /^\+39(3\d{8,9}|0\d{5,10})$/.test(n) ? n : '';
    return /^\+[1-9]\d{7,14}$/.test(n) ? n : '';
  }

  function cellulare(numeroE164) {
    return /^\+393\d{8,9}$/.test(String(numeroE164 || ''));
  }

  return { normalizza: normalizza, cellulare: cellulare };
})();

// ===== 07_prefiltro.js =====
/**
 * Filtro a regole (gratuito, prima di chiamare Claude). Deve essere largo: il suo
 * compito è solo scartare ciò che sicuramente non è una conferma (mail interne,
 * automatiche, newsletter, persone con cui Migelino non ha mai parlato).
 */

var Prefiltro = (function () {
  var PAROLE_CHIAVE = [
    /conferm/, /accett/, /proced/, /firmat/, /allego/, /allegat/, /document/,
    /carta d.?identit/, /identita/, /\bci\b/, /tessera/, /codice fiscale/, /\bc\.?f\.?\b/,
    /indirizz/, /spedi/, /spediz/, /ordin/, /acquist/, /\bprova\b/, /provar/, /preventiv/,
    /bonifico/, /fattur/, /residen/, /\bok\b/, /va bene/, /d.?accordo/, /\bsi\b/
  ];
  var TIPI_DOCUMENTO = /^(application\/pdf|image\/(jpeg|jpg|png|gif|webp|heic|heif))$/i;

  function interno(email) {
    var dominio = String(email || '').split('@')[1] || '';
    return CONFIG.DOMINI_INTERNI.indexOf(dominio.toLowerCase()) >= 0;
  }

  function automatico(email) {
    return CONFIG.MITTENTI_AUTOMATICI.some(function (re) { return re.test(email); });
  }

  function haParoleChiave(testo) {
    var t = Testo.rimuoviAccenti(testo).toLowerCase();
    return PAROLE_CHIAVE.some(function (re) { return re.test(t); });
  }

  function haAllegatiDocumento(allegati) {
    return (allegati || []).some(function (a) {
      return TIPI_DOCUMENTO.test(a.mimeType) && (a.inLinea ? a.dimensione >= CONFIG.MIN_BYTE_IMMAGINE_IN_LINEA : true);
    });
  }

  /**
   * msg: { mittente, oggetto, testoNuovo, allegati }
   * contesto: { haRelazione } = Migelino ha già scritto a questo mittente
   * Restituisce { passa, motivo }.
   */
  function valuta(msg, contesto) {
    if (!msg.mittente) return { passa: false, motivo: 'mittente sconosciuto' };
    if (interno(msg.mittente)) return { passa: false, motivo: 'mittente interno' };
    if (automatico(msg.mittente)) return { passa: false, motivo: 'mittente automatico' };
    if (!contesto.haRelazione) return { passa: false, motivo: 'nessuna conversazione precedente con Migelino' };
    var testo = (msg.oggetto || '') + '\n' + (msg.testoNuovo || '');
    if (haParoleChiave(testo) || haAllegatiDocumento(msg.allegati)) return { passa: true, motivo: '' };
    return { passa: false, motivo: 'nessuna parola chiave né documento allegato' };
  }

  return {
    valuta: valuta,
    interno: interno,
    automatico: automatico,
    haParoleChiave: haParoleChiave,
    haAllegatiDocumento: haAllegatiDocumento
  };
})();

// ===== 08_claude.js =====
/**
 * Client minimo per l'API Messages di Claude (HTTP diretto: Apps Script non ha
 * un SDK ufficiale). Risposte sempre in JSON vincolato a uno schema
 * (output_config.format), con fallback automatico lato server se il modello
 * rifiuta la richiesta.
 */

var Claude = (function () {
  function ErroreClaude(messaggio, codice, dettagli) {
    this.name = 'ErroreClaude';
    this.message = messaggio;
    this.codice = codice || 0;
    this.dettagli = dettagli || '';
  }
  ErroreClaude.prototype = Object.create(Error.prototype);

  function testo(t) {
    return { type: 'text', text: String(t) };
  }

  function pdf(base64) {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }

  function immagine(base64, mimeType) {
    var tipo = String(mimeType || '').toLowerCase() === 'image/jpg' ? 'image/jpeg' : String(mimeType).toLowerCase();
    return { type: 'image', source: { type: 'base64', media_type: tipo, data: base64 } };
  }

  function corpo(opz, conFallback) {
    var richiesta = {
      model: Impostazioni.obbligatoria(CHIAVI.CLAUDE_MODEL),
      max_tokens: opz.maxToken,
      system: [{ type: 'text', text: opz.sistema, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: opz.contenuti }],
      output_config: {
        effort: opz.sforzo,
        format: { type: 'json_schema', schema: opz.schema }
      }
    };
    if (conFallback) richiesta.fallbacks = 'default';
    return richiesta;
  }

  function intestazioni(conFallback) {
    var h = {
      'x-api-key': Impostazioni.obbligatoria(CHIAVI.ANTHROPIC_API_KEY),
      'anthropic-version': CONFIG.CLAUDE_VERSIONE_API
    };
    if (conFallback) h['anthropic-beta'] = CONFIG.CLAUDE_BETA_FALLBACK;
    return h;
  }

  /** Legge la risposta: controlla il motivo di arresto e restituisce il JSON prodotto. */
  function interpreta(risposta) {
    if (risposta.stop_reason === 'refusal') {
      throw new ErroreClaude('Il modello ha rifiutato la richiesta', 200, JSON.stringify(risposta.stop_details || {}));
    }
    if (risposta.stop_reason === 'max_tokens') {
      throw new ErroreClaude('Risposta troncata (max_tokens)', 200, '');
    }
    var blocchi = (risposta.content || []).filter(function (b) { return b.type === 'text'; });
    var json = blocchi.map(function (b) { return b.text; }).join('');
    try {
      return { dati: JSON.parse(json), modello: risposta.model, uso: risposta.usage || {} };
    } catch (e) {
      throw new ErroreClaude('Risposta non in formato JSON', 200, json.slice(0, 300));
    }
  }

  /**
   * opz = { sistema, contenuti, schema, sforzo, maxToken }
   * Restituisce { dati, modello, uso }.
   */
  function chiama(opz) {
    var conFallback = true;
    var ultimoErrore = null;
    var attese = [2000, 6000, 15000];
    var sforzo = opz.sforzo;
    for (var tentativo = 0; tentativo < CONFIG.CLAUDE_TENTATIVI; tentativo++) {
      var risposta;
      try {
        risposta = UrlFetchApp.fetch(CONFIG.CLAUDE_URL, {
          method: 'post',
          contentType: 'application/json',
          headers: intestazioni(conFallback),
          payload: JSON.stringify(corpo({ sistema: opz.sistema, contenuti: opz.contenuti, schema: opz.schema, sforzo: sforzo, maxToken: opz.maxToken }, conFallback)),
          muteHttpExceptions: true
        });
      } catch (e) {
        // Timeout o rete: riprova con uno sforzo più basso (risposta più rapida).
        ultimoErrore = new ErroreClaude('Chiamata a Claude non riuscita: ' + (e && e.message ? e.message : e), 0, '');
        if (sforzo !== 'low') sforzo = 'low';
        Utilities.sleep(attese[Math.min(tentativo, attese.length - 1)]);
        continue;
      }
      var codice = risposta.getResponseCode();
      var testoRisposta = risposta.getContentText();
      if (codice === 200) return interpreta(JSON.parse(testoRisposta));
      ultimoErrore = new ErroreClaude('Errore API Claude HTTP ' + codice, codice, testoRisposta.slice(0, 500));
      if (codice === 400 && conFallback && /fallback/i.test(testoRisposta)) {
        conFallback = false;   // account o piattaforma senza fallback: riprova subito senza
        tentativo--;
        continue;
      }
      if (codice === 429 || codice === 408 || codice === 529 || codice >= 500) {
        Utilities.sleep(attese[Math.min(tentativo, attese.length - 1)]);
        continue;
      }
      throw ultimoErrore;
    }
    throw ultimoErrore;
  }

  return {
    chiama: chiama,
    testo: testo,
    pdf: pdf,
    immagine: immagine,
    ErroreClaude: ErroreClaude
  };
})();

// ===== 09_classificatore.js =====
/**
 * Riconoscimento della conferma: decide se l'ultimo messaggio del paziente è una
 * conferma di acquisto o di prova. Le regole e gli esempi vengono dalla
 * taratura con Migelino (docs/TARATURA.md): aggiornarli insieme.
 */

var Classificatore = (function () {
  var SISTEMA = [
    'Sei l\'assistente amministrativo di Migelino Italia, un servizio di audioprotesi a distanza: gli audioprotesisti seguono i pazienti per email, telefono e videochiamata e spediscono gli apparecchi acustici a casa.',
    '',
    'Il percorso tipico di un paziente:',
    '1. chiede informazioni e invia l\'esame audiometrico;',
    '2. riceve per email una proposta con preventivo (acquisto) oppure la proposta di una prova gratuita di 30 giorni;',
    '3. se decide di procedere lo comunica e invia quanto gli è stato chiesto: preventivo firmato, documento d\'identità, codice fiscale o tessera sanitaria, indirizzo di spedizione, colore;',
    '4. Migelino crea l\'ordine e spedisce.',
    '',
    'Il tuo compito: leggere la conversazione e decidere se l\'ULTIMO messaggio del paziente contiene una CONFERMA, cioè la volontà chiara di procedere con l\'acquisto o con la prova delle soluzioni acustiche proposte. Quando c\'è una conferma Migelino crea subito l\'anagrafica del cliente: un falso positivo crea un\'anagrafica inutile, un falso negativo fa perdere l\'automazione. Sii preciso.',
    '',
    'È una CONFERMA:',
    '- una dichiarazione esplicita: "confermo l\'ordine", "confermo l\'acquisto", "procediamo", "vorrei procedere con l\'ordine", "confermo la mia volontà di avvalermi di Migelino", "accetto le condizioni", "confermo ordine definitivo";',
    '- l\'invio del preventivo firmato;',
    '- l\'accettazione della prova: "accetto la prova", oppure "vorrei provare il prodotto X" insieme all\'invio dei documenti;',
    '- l\'invio dei documenti o dei dati che Migelino aveva chiesto PER PROCEDERE (documento d\'identità, tessera sanitaria, indirizzo di spedizione), anche senza la parola "confermo": è una conferma implicita;',
    '- una conferma con condizioni o richieste pratiche ("confermo, ma spedite a settembre", "confermo, colore grigio");',
    '- la conferma definitiva dopo una prova.',
    '',
    'NON è una conferma:',
    '- il consenso al trattamento dei dati (GDPR): "accetto", "acconsento", "accetto per il consenso" riferiti al trattamento dei dati personali o clinici. Migelino lo chiede quasi sempre prima di valutare gli esami: è il falso allarme più frequente;',
    '- domande su come procedere, prezzi, pagamenti o tempi ("come si procede?", "come ordino?", "quanto costa?"), anche con forte interesse, finché il paziente non accetta una proposta precisa o non invia i documenti richiesti;',
    '- l\'invio del solo esame audiometrico per una valutazione;',
    '- la conferma di un appuntamento o di una videochiamata;',
    '- assistenza, regolazioni, ringraziamenti, conferme di ricezione, di pagamento o di consegna di ordini già fatti;',
    '- i messaggi di Migelino stesso.',
    '',
    'Se l\'ultimo messaggio completa una conferma già data prima (per esempio manda il documento o l\'indirizzo mancante), è comunque una CONFERMA.',
    '',
    'Campi della risposta:',
    '- esito: CONFERMA, DUBBIA (intenzione forte ma nessuna proposta accettata o documenti inviati) oppure NON_CONFERMA;',
    '- tipo: ACQUISTO (anche dopo una prova), PROVA (prova gratuita o demo) oppure NESSUNO;',
    '- probabilita: la tua stima da 0 a 1 che sia davvero una conferma. Sopra 0,9 solo se la conferma è esplicita o i documenti richiesti sono stati inviati; tra 0,6 e 0,8 per i casi dubbi; sotto 0,3 quando chiaramente non lo è;',
    '- frase_chiave: la frase esatta del paziente che motiva la decisione;',
    '- motivazione: una riga di spiegazione.',
    '',
    'Esempi validati da Migelino (dati personali sostituiti da [..]):',
    '1. "Ecco il preventivo firmato e la carta d\'identità. Il codice fiscale per la detrazione è [CF]. Colore argento. Indirizzo: [destinatario e indirizzo di spedizione]" -> CONFERMA, ACQUISTO.',
    '2. "Con la presente confermo la mia volontà di avvalermi di Migelino per la fornitura discussa e dei servizi..." -> CONFERMA, ACQUISTO.',
    '3. Oggetto "CONFERMA DI PREVENTIVO": "Grazie per le info, tutto chiaro. Vorrei procedere con l\'ordine del PHONAK di cui ri-allego il preventivo. Ricordo il colore Nero Velluto..." -> CONFERMA, ACQUISTO.',
    '4. Dopo una prova: "Confermo ordine definitivo colore grafite gray" -> CONFERMA, ACQUISTO.',
    '5. "A seguito colloquio odierno confermo l\'acquisto degli apparecchi acustici [modello] al prezzo di [prezzo]" -> CONFERMA, ACQUISTO.',
    '6. "Accetto la prova e allego i documenti richiesti" -> CONFERMA, PROVA.',
    '7. "Confermo l\'acquisto ma avendo due impegni preferirei inviare l\'apparecchio in uso alla prima settimana di settembre" -> CONFERMA, ACQUISTO.',
    '8. Dopo "Vorrei provare il prodotto [modello]": "Allego le ultime due visite e il mio documento di identità. L\'indirizzo di spedizione è [indirizzo] e corrisponde con il mio di residenza" -> CONFERMA, PROVA (implicita).',
    '9. "Accetto per il consenso. Come potremmo procedere con l\'ordine? Come funziona per il pagamento?" -> NON_CONFERMA: è il consenso GDPR più una domanda (la conferma vera è arrivata giorni dopo).',
    '10. "Le ho inviato i miei dati per sapere come procedere con l\'ordine. Vorrei approfittare di questa offerta. Come ordino?" e poi "Mi va bene il modello Sphere. Le invio il preventivo che mi ha mandato o me lo rimanda variato?" -> DUBBIA: intenzione forte ma nessuna proposta ancora accettata formalmente (probabilita circa 0,65).'
  ].join('\n');

  var SCHEMA = {
    type: 'object',
    properties: {
      esito: { type: 'string', enum: ['CONFERMA', 'DUBBIA', 'NON_CONFERMA'] },
      tipo: { type: 'string', enum: ['ACQUISTO', 'PROVA', 'NESSUNO'] },
      probabilita: { type: 'number' },
      frase_chiave: { type: 'string' },
      motivazione: { type: 'string' }
    },
    required: ['esito', 'tipo', 'probabilita', 'frase_chiave', 'motivazione'],
    additionalProperties: false
  };

  /**
   * conversazione = { oggetto, messaggi: [{ data, ruolo: 'PAZIENTE'|'MIGELINO', nome, email, testo, allegati: [nomi] }] }
   * L'ultimo messaggio è quello da valutare (del paziente).
   */
  function trascrizione(conversazione) {
    var messaggi = conversazione.messaggi.slice(-CONFIG.MAX_MESSAGGI_CONTESTO);
    var righe = ['Oggetto della conversazione: ' + (conversazione.oggetto || '(nessuno)'), ''];
    messaggi.forEach(function (m, i) {
      var ultimo = i === messaggi.length - 1;
      righe.push('[' + (i + 1) + '] ' + m.data + ' - ' + m.ruolo + (m.nome ? ' (' + m.nome + ')' : '') +
        (ultimo ? '  <<< ULTIMO MESSAGGIO DEL PAZIENTE, DA VALUTARE' : ''));
      righe.push(Testo.tronca(m.testo || '(nessun testo)', CONFIG.MAX_CARATTERI_MESSAGGIO));
      if (m.allegati && m.allegati.length) righe.push('Allegati: ' + m.allegati.join(', '));
      righe.push('');
    });
    return righe.join('\n');
  }

  /** Decisione finale: servono sia l'esito sia la probabilità sopra soglia. */
  function categoria(risultato, sogliaConferma) {
    var p = Number(risultato.probabilita) || 0;
    if (risultato.esito === 'CONFERMA' && p >= sogliaConferma) return 'CONFERMA';
    if (risultato.esito !== 'NON_CONFERMA' && p >= CONFIG.SOGLIA_DUBBIO) return 'DUBBIA';
    return 'NON_CONFERMA';
  }

  function classifica(conversazione) {
    var r = Claude.chiama({
      sistema: SISTEMA,
      contenuti: [Claude.testo(trascrizione(conversazione))],
      schema: SCHEMA,
      sforzo: CONFIG.CLAUDE_SFORZO_CLASSIFICAZIONE,
      maxToken: CONFIG.CLAUDE_MAX_TOKEN_CLASSIFICAZIONE
    });
    var dati = r.dati;
    dati.categoria = categoria(dati, Impostazioni.sogliaConferma());
    dati.modello = r.modello;
    return dati;
  }

  return { classifica: classifica, trascrizione: trascrizione, categoria: categoria, SCHEMA: SCHEMA, SISTEMA: SISTEMA };
})();

// ===== 10_estrattore.js =====
/**
 * Estrazione dell'anagrafica da documenti (PDF/foto) e mail. Claude restituisce
 * ogni campo con valore, confidenza, fonte ed evidenza; la decisione su cosa
 * scrivere spetta poi al codice (11_decisione.js), non al modello.
 */

var Estrattore = (function () {
  var FONTI = ['DOCUMENTO_IDENTITA', 'TESSERA_SANITARIA', 'PREVENTIVO_FIRMATO', 'DICHIARAZIONE_EMAIL', 'FIRMA_EMAIL', 'NESSUNA'];
  var TIPI_DOCUMENTO = ['CARTA_IDENTITA_CARTACEA', 'CARTA_IDENTITA_ELETTRONICA', 'PATENTE', 'PASSAPORTO',
    'TESSERA_SANITARIA', 'PREVENTIVO', 'ESAME_AUDIOMETRICO', 'ALTRO'];

  var SISTEMA = [
    'Sei l\'addetto all\'anagrafica clienti di Migelino Italia (apparecchi acustici). Un paziente ha confermato l\'acquisto o la prova. Devi ricavare i dati per la sua anagrafica cliente su Shopify leggendo i documenti allegati (carta d\'identità cartacea, carta d\'identità elettronica fronte e retro, patente, passaporto, tessera sanitaria, preventivo firmato) e le email.',
    '',
    'Regola fondamentale: riporta solo ciò che è scritto nei documenti o nelle email. Non dedurre, non completare, non calcolare. Se un dato manca o non è leggibile lascia il valore vuoto ("") con confidenza 0 e fonte NESSUNA. Un campo vuoto viene completato a mano dall\'ufficio; un campo sbagliato finisce in fattura.',
    '',
    'Chi è il paziente: la persona che userà gli apparecchi e che ha confermato, di solito il mittente. Se scrive un familiare per suo conto o se i documenti sono di più persone, imposta piu_persone = true e paziente_identificato = SI solo se è chiaro chi è il paziente (altrimenti INCERTO o NO).',
    '',
    'Campi:',
    '- nome e cognome: come sul documento d\'identità, con tutti i nomi (es. "Maria Rosa"). Senza documento, dalla firma della mail solo se è chiaramente il nome completo del paziente.',
    '- sesso (M o F), data_nascita (formato AAAA-MM-GG), luogo_nascita: dal documento.',
    '- codice_fiscale: solo se scritto esplicitamente (retro della carta d\'identità elettronica, tessera sanitaria, testo o firma della mail). Mai calcolarlo.',
    '- telefono: numero del paziente scritto nelle mail o nella firma.',
    '- residenza: fonti valide sono il documento d\'identità (carta cartacea: campo Residenza; carta elettronica: retro, indirizzo di residenza) oppure una dichiarazione esplicita del paziente ("sono residente in...", "la mia residenza è...", "corrisponde con il mio di residenza"). L\'indirizzo nella firma della mail NON è la residenza (può essere l\'ufficio): usalo solo se coincide con quello del documento. Patente e passaporto di solito non riportano la residenza.',
    '- spedizione: solo se il paziente indica dove spedire ("indirizzo di spedizione", "spedite a", "Indirizzo: ..." in risposta alla richiesta di Migelino). Se dice che coincide con la residenza imposta stessa_della_residenza = SI e lascia vuoti gli altri campi dell\'indirizzo; se indica un indirizzo diverso imposta NO e compilalo; se non lo indica imposta NON_INDICATO. Non usare mai la residenza come spedizione di tua iniziativa.',
    '  - destinatario_nome e destinatario_cognome: solo se la spedizione è intestata a una persona diversa dal paziente (es. la moglie).',
    '  - presso: azienda o persona presso cui consegnare ("c/o"), se indicata.',
    '- Indirizzi italiani: separa via (con il tipo: Via, Viale, Piazza, Località...), civico, dettagli (scala, interno, piano), cap (5 cifre), comune, provincia (sigla di 2 lettere), paese (codice ISO di 2 lettere, IT per l\'Italia). Per gli indirizzi esteri usa gli stessi campi come puoi e lascia vuota la provincia.',
    '',
    'Per ogni campo indica:',
    '- confidenza da 0 a 1: quanto sei sicuro che il valore sia giusto e letto bene. Sotto 0,85 il campo non verrà scritto: abbassala se la foto è sfocata, tagliata o se hai dovuto interpretare;',
    '- fonte: da dove l\'hai preso;',
    '- evidenza: il breve testo da cui l\'hai letto.',
    '',
    'documenti: elenca ogni allegato esaminato con tipo, leggibilità e a chi è intestato.',
    'note: segnala in breve cose utili all\'ufficio (documento scaduto, foto illeggibile, spedizione presso un familiare...).'
  ].join('\n');

  function campo() {
    return { $ref: '#/$defs/campo' };
  }

  var SCHEMA = {
    type: 'object',
    $defs: {
      campo: {
        type: 'object',
        properties: {
          valore: { type: 'string' },
          confidenza: { type: 'number' },
          fonte: { type: 'string', enum: FONTI },
          evidenza: { type: 'string' }
        },
        required: ['valore', 'confidenza', 'fonte', 'evidenza'],
        additionalProperties: false
      },
      indirizzo: {
        type: 'object',
        properties: {
          via: { type: 'string' },
          civico: { type: 'string' },
          dettagli: { type: 'string' },
          cap: { type: 'string' },
          comune: { type: 'string' },
          provincia: { type: 'string' },
          paese: { type: 'string' },
          confidenza: { type: 'number' },
          fonte: { type: 'string', enum: FONTI },
          evidenza: { type: 'string' }
        },
        required: ['via', 'civico', 'dettagli', 'cap', 'comune', 'provincia', 'paese', 'confidenza', 'fonte', 'evidenza'],
        additionalProperties: false
      }
    },
    properties: {
      paziente_identificato: { type: 'string', enum: ['SI', 'NO', 'INCERTO'] },
      piu_persone: { type: 'boolean' },
      nome: campo(),
      cognome: campo(),
      sesso: campo(),
      data_nascita: campo(),
      luogo_nascita: campo(),
      codice_fiscale: campo(),
      telefono: campo(),
      residenza: { $ref: '#/$defs/indirizzo' },
      spedizione: {
        type: 'object',
        properties: {
          stessa_della_residenza: { type: 'string', enum: ['SI', 'NO', 'NON_INDICATO'] },
          indirizzo: { $ref: '#/$defs/indirizzo' },
          destinatario_nome: { type: 'string' },
          destinatario_cognome: { type: 'string' },
          presso: { type: 'string' },
          telefono_destinatario: { type: 'string' },
          evidenza: { type: 'string' }
        },
        required: ['stessa_della_residenza', 'indirizzo', 'destinatario_nome', 'destinatario_cognome', 'presso', 'telefono_destinatario', 'evidenza'],
        additionalProperties: false
      },
      documenti: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            file: { type: 'string' },
            tipo: { type: 'string', enum: TIPI_DOCUMENTO },
            leggibile: { type: 'boolean' },
            intestatario: { type: 'string' }
          },
          required: ['file', 'tipo', 'leggibile', 'intestatario'],
          additionalProperties: false
        }
      },
      note: { type: 'string' }
    },
    required: ['paziente_identificato', 'piu_persone', 'nome', 'cognome', 'sesso', 'data_nascita', 'luogo_nascita',
      'codice_fiscale', 'telefono', 'residenza', 'spedizione', 'documenti', 'note'],
    additionalProperties: false
  };

  /**
   * dossier = {
   *   mittente: { nome, email },
   *   tipoConferma, dataConferma,
   *   allegati: [{ nome, mimeType, base64, data, ruolo }],
   *   nonLeggibili: [nomi],            // es. foto HEIC
   *   messaggi: [{ data, ruolo, nome, testo, oggetto }]
   * }
   */
  function contenuti(dossier) {
    var blocchi = [];
    blocchi.push(Claude.testo(
      'Mittente della conferma: ' + (dossier.mittente.nome || '') + ' <' + dossier.mittente.email + '>\n' +
      'Tipo di conferma: ' + (dossier.tipoConferma || 'non indicato') + ', del ' + (dossier.dataConferma || '') + '\n' +
      'Allegati da esaminare: ' + dossier.allegati.length +
      (dossier.nonLeggibili && dossier.nonLeggibili.length ? '\nAllegati in formato non leggibile (non inclusi): ' + dossier.nonLeggibili.join(', ') : '')
    ));
    dossier.allegati.forEach(function (a, i) {
      blocchi.push(Claude.testo('Allegato ' + (i + 1) + ': "' + a.nome + '", inviato da ' + a.ruolo + ' il ' + a.data));
      blocchi.push(a.mimeType === 'application/pdf' ? Claude.pdf(a.base64) : Claude.immagine(a.base64, a.mimeType));
    });
    var righe = ['Email scambiate con il paziente (dalla più vecchia alla più recente):', ''];
    dossier.messaggi.forEach(function (m) {
      righe.push('--- ' + m.data + ' - ' + m.ruolo + (m.nome ? ' (' + m.nome + ')' : '') + (m.oggetto ? ' - Oggetto: ' + m.oggetto : ''));
      righe.push(Testo.tronca(m.testo || '', CONFIG.MAX_CARATTERI_MESSAGGIO));
      righe.push('');
    });
    blocchi.push(Claude.testo(righe.join('\n')));
    return blocchi;
  }

  function chiamata(dossier) {
    return Claude.chiama({
      sistema: SISTEMA,
      contenuti: contenuti(dossier),
      schema: SCHEMA,
      sforzo: CONFIG.CLAUDE_SFORZO_ESTRAZIONE,
      maxToken: CONFIG.CLAUDE_MAX_TOKEN_ESTRAZIONE
    });
  }

  function dimensioneAllegato(a) {
    return a.dimensione || Math.floor(String(a.base64 || '').length * 3 / 4);
  }

  /** Se Claude rifiuta un'immagine (dimensioni/formato), riprova una volta senza le immagini grandi. */
  function estrai(dossier) {
    var r;
    try {
      r = chiamata(dossier);
    } catch (e) {
      var suImmagine = e && e.codice === 400 && /image/i.test(String(e.dettagli || ''));
      if (!suImmagine) throw e;
      var tenuti = [];
      var esclusi = [];
      dossier.allegati.forEach(function (a) {
        if (a.mimeType !== 'application/pdf' && dimensioneAllegato(a) > CONFIG.MAX_BYTE_IMMAGINE_RIPROVA) esclusi.push(a.nome + ' (rifiutato da Claude)');
        else tenuti.push(a);
      });
      if (!esclusi.length) throw e;
      var ridotto = {};
      Object.keys(dossier).forEach(function (k) { ridotto[k] = dossier[k]; });
      ridotto.allegati = tenuti;
      ridotto.nonLeggibili = (dossier.nonLeggibili || []).concat(esclusi);
      r = chiamata(ridotto);
    }
    r.dati.modello = r.modello;
    return r.dati;
  }

  var CAMPI_SEMPLICI = ['nome', 'cognome', 'sesso', 'data_nascita', 'luogo_nascita', 'codice_fiscale', 'telefono'];

  function pieno(c) {
    return !!(c && String(c.valore || '').trim());
  }

  function indirizzoPieno(x) {
    return !!(x && (String(x.via || '') + String(x.cap || '') + String(x.comune || '')).trim());
  }

  function piuAffidabile(a, b) {
    if (!a) return b;
    if (!b) return a;
    return (Number(b.confidenza) || 0) > (Number(a.confidenza) || 0) ? b : a;
  }

  /**
   * Unisce l'estrazione salvata quando mancavano dei dati con quella nuova: per ogni
   * campo tiene il valore letto con più sicurezza. Serve quando il paziente manda i
   * documenti in un momento (o a una casella) e l'indirizzo in un altro.
   * Se nome o cognome sono in contrasto (es. un familiare) non unisce nulla.
   */
  function unisci(precedente, nuova) {
    if (!precedente) return nuova;
    var diversi = ['nome', 'cognome'].some(function (k) {
      return pieno(precedente[k]) && pieno(nuova[k]) && Testo.chiave(precedente[k].valore) !== Testo.chiave(nuova[k].valore);
    });
    if (diversi) return nuova;
    var r = JSON.parse(JSON.stringify(nuova));
    CAMPI_SEMPLICI.forEach(function (k) {
      if (pieno(precedente[k]) || pieno(nuova[k])) {
        r[k] = !pieno(nuova[k]) ? precedente[k] : !pieno(precedente[k]) ? nuova[k] : piuAffidabile(precedente[k], nuova[k]);
      }
    });
    if (!indirizzoPieno(nuova.residenza)) r.residenza = precedente.residenza;
    else if (indirizzoPieno(precedente.residenza)) r.residenza = piuAffidabile(precedente.residenza, nuova.residenza);
    var sp = nuova.spedizione || {};
    var indicataOra = sp.stessa_della_residenza === 'SI' || (sp.stessa_della_residenza === 'NO' && indirizzoPieno(sp.indirizzo));
    if (!indicataOra && precedente.spedizione) r.spedizione = precedente.spedizione;
    r.paziente_identificato = nuova.paziente_identificato === 'SI' ||
      (precedente.paziente_identificato === 'SI' && nuova.paziente_identificato !== 'NO') ? 'SI' : nuova.paziente_identificato;
    r.piu_persone = !!(precedente.piu_persone || nuova.piu_persone);
    r.documenti = (precedente.documenti || []).concat(nuova.documenti || []);
    r.note = [precedente.note, nuova.note].filter(Boolean).join(' | ');
    return r;
  }

  /** Versione ridotta da conservare nella memoria condivisa (limite 9 KB). */
  function compatta(e) {
    var c = JSON.parse(JSON.stringify(e));
    function taglia(x) {
      if (x && typeof x.evidenza === 'string') x.evidenza = x.evidenza.slice(0, 120);
    }
    CAMPI_SEMPLICI.forEach(function (k) { taglia(c[k]); });
    taglia(c.residenza);
    if (c.spedizione) { taglia(c.spedizione); taglia(c.spedizione.indirizzo); }
    c.documenti = (c.documenti || []).slice(0, 5).map(function (d) {
      return { file: String(d.file || '').slice(0, 60), tipo: d.tipo, leggibile: d.leggibile, intestatario: d.intestatario };
    });
    c.note = String(c.note || '').slice(0, 300);
    delete c.modello;
    return c;
  }

  return { estrai: estrai, contenuti: contenuti, unisci: unisci, compatta: compatta, SCHEMA: SCHEMA, SISTEMA: SISTEMA, FONTI: FONTI };
})();

// ===== 11_decisione.js =====
/**
 * Decisione: dal risultato dell'estrazione al piano di scrittura su Shopify.
 * È il punto in cui si applicano le regole di Migelino:
 *
 *  1. OBBLIGATORI: nome, cognome, indirizzo di RESIDENZA e indirizzo di SPEDIZIONE.
 *     Se ne manca anche uno solo non si crea nulla (esito DATI_MANCANTI).
 *  2. Un campo si scrive solo se supera la soglia di confidenza e i controlli
 *     automatici; altrimenti resta vuoto e viene segnalato.
 *  3. Il codice fiscale va SOLO nel campo "Azienda" dell'indirizzo; se manca o
 *     non supera i controlli resta vuoto (lo inserisce l'ufficio).
 *  4. Convenzione dell'ufficio: indirizzo predefinito = spedizione; se la residenza è
 *     diversa diventa un secondo indirizzo con il CF in Azienda (fatturazione).
 *  5. Su un cliente esistente si completano solo i campi vuoti: mai sovrascrivere.
 */

var Decisione = (function () {
  var FONTI_RESIDENZA = ['DOCUMENTO_IDENTITA', 'DICHIARAZIONE_EMAIL', 'PREVENTIVO_FIRMATO'];
  var FONTI_SPEDIZIONE = ['DICHIARAZIONE_EMAIL', 'PREVENTIVO_FIRMATO'];

  function pct(x) {
    return Math.round((Number(x) || 0) * 100) + '%';
  }

  function presente(campo) {
    return !!(campo && String(campo.valore || '').trim());
  }

  /** Valuta un campo semplice: { ok, valore, motivo }. */
  function leggiCampo(campo, soglia) {
    if (!presente(campo)) return { ok: false, valore: '', motivo: 'non trovato' };
    if ((Number(campo.confidenza) || 0) < soglia) {
      return { ok: false, valore: String(campo.valore).trim(), motivo: 'lettura incerta (' + pct(campo.confidenza) + ')' };
    }
    return { ok: true, valore: String(campo.valore).trim(), motivo: '' };
  }

  function dataValida(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return false;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    var anno = new Date().getUTCFullYear();
    return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] &&
      +m[1] >= 1900 && +m[1] <= anno;
  }

  function nomeValido(s) {
    return /[A-Za-zÀ-ÿ]{2,}/.test(s || '');
  }

  /** Indirizzo dall'estrazione: { ok, indirizzo, motivo, avvisi }. */
  function leggiIndirizzo(x, fontiAmmesse, soglia, extra) {
    var vuoto = !x || !(String(x.via || '') + String(x.cap || '') + String(x.comune || '')).trim();
    if (vuoto) return { ok: false, motivo: 'non indicato', avvisi: [] };
    if (fontiAmmesse.indexOf(x.fonte) < 0) {
      return { ok: false, motivo: 'fonte non valida (' + x.fonte + ')', avvisi: [] };
    }
    if ((Number(x.confidenza) || 0) < soglia) {
      return { ok: false, motivo: 'lettura incerta (' + pct(x.confidenza) + ')', avvisi: [] };
    }
    var ind = Indirizzi.normalizza({
      via: x.via, civico: x.civico, dettagli: x.dettagli, cap: x.cap, comune: x.comune,
      provincia: x.provincia, paese: x.paese,
      presso: extra && extra.presso, destinatarioNome: extra && extra.destinatarioNome,
      destinatarioCognome: extra && extra.destinatarioCognome, telefono: extra && extra.telefono
    });
    var v = Indirizzi.valida(ind);
    if (!v.ok) return { ok: false, motivo: v.problemi.join(', '), avvisi: v.avvisi };
    return { ok: true, indirizzo: ind, motivo: '', avvisi: v.avvisi };
  }

  function sembraCf(testo) {
    return CodiceFiscale.formatoValido(testo);
  }

  function dataItaliana(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
  }

  /** Analizza estrazione + cliente esistente e restituisce i dati accettati. */
  function analizza(e, soglia) {
    var r = { mancanti: [], scartati: [], avvisi: [] };

    var nome = leggiCampo(e.nome, soglia);
    var cognome = leggiCampo(e.cognome, soglia);
    r.nome = nome.ok && nomeValido(nome.valore) ? Testo.maiuscoleNome(nome.valore) : '';
    r.cognome = cognome.ok && nomeValido(cognome.valore) ? Testo.maiuscoleNome(cognome.valore) : '';
    if (!r.nome) r.scartati.push({ campo: 'nome', motivo: nome.motivo || 'non valido' });
    if (!r.cognome) r.scartati.push({ campo: 'cognome', motivo: cognome.motivo || 'non valido' });

    var sesso = leggiCampo(e.sesso, soglia);
    r.sesso = sesso.ok && /^[MF]$/i.test(sesso.valore) ? sesso.valore.toUpperCase() : '';
    var data = leggiCampo(e.data_nascita, soglia);
    r.dataNascita = data.ok && dataValida(data.valore) ? data.valore : '';

    // Codice fiscale: valido, coerente con il documento, mai calcolato.
    var cf = leggiCampo(e.codice_fiscale, soglia);
    r.cf = '';
    if (!presente(e.codice_fiscale)) {
      r.scartati.push({ campo: 'codice fiscale', motivo: 'non presente in documenti o mail' });
    } else if (!cf.ok) {
      r.scartati.push({ campo: 'codice fiscale', motivo: cf.motivo });
    } else {
      var valore = CodiceFiscale.normalizza(cf.valore);
      var luogo = presente(e.luogo_nascita) ? Comuni.trova(e.luogo_nascita.valore) : null;
      var verifica = CodiceFiscale.verificaCoerenza(valore, {
        cognome: r.cognome, nome: r.nome, dataNascita: r.dataNascita, sesso: r.sesso,
        codiceCatastale: luogo ? luogo.catastale : null
      });
      if (!verifica.valido) {
        r.scartati.push({ campo: 'codice fiscale', motivo: 'carattere di controllo errato' });
      } else if (!verifica.coerente) {
        r.scartati.push({ campo: 'codice fiscale', motivo: 'non coerente con nome, cognome e data di nascita del documento' });
      } else {
        r.cf = valore;
        if (verifica.luogo === false) r.avvisi.push('Luogo di nascita del CF diverso da quello letto (possibile comune soppresso)');
      }
    }

    var tel = leggiCampo(e.telefono, soglia);
    r.telefono = tel.ok ? Telefono.normalizza(tel.valore) : '';
    if (!r.telefono) r.scartati.push({ campo: 'telefono', motivo: tel.ok ? 'numero non valido' : tel.motivo });

    // Residenza
    var res = leggiIndirizzo(e.residenza, FONTI_RESIDENZA, soglia, { telefono: r.telefono });
    r.residenza = res.ok ? res.indirizzo : null;
    if (!res.ok) r.mancanti.push('indirizzo di residenza: ' + res.motivo);
    r.avvisi = r.avvisi.concat(res.avvisi || []);

    // Spedizione
    var s = e.spedizione || {};
    r.spedizione = null;
    r.spedizioneUgualeResidenza = false;
    if (s.stessa_della_residenza === 'SI') {
      if (r.residenza) {
        r.spedizione = r.residenza;
        r.spedizioneUgualeResidenza = true;
      } else {
        r.mancanti.push('indirizzo di spedizione: coincide con la residenza, che però manca');
      }
    } else if (s.stessa_della_residenza === 'NO') {
      var telDest = Telefono.normalizza(s.telefono_destinatario);
      var sped = leggiIndirizzo(s.indirizzo, FONTI_SPEDIZIONE, soglia, {
        presso: s.presso, destinatarioNome: s.destinatario_nome, destinatarioCognome: s.destinatario_cognome,
        telefono: telDest || r.telefono
      });
      if (sped.ok) {
        r.spedizione = sped.indirizzo;
        r.avvisi = r.avvisi.concat(sped.avvisi || []);
        var stessaPersona = !sped.indirizzo.destinatarioNome && !sped.indirizzo.destinatarioCognome;
        if (r.residenza && stessaPersona && !sped.indirizzo.presso && Indirizzi.uguali(sped.indirizzo, r.residenza)) {
          r.spedizione = r.residenza;
          r.spedizioneUgualeResidenza = true;
        }
      } else {
        r.mancanti.push('indirizzo di spedizione: ' + sped.motivo);
      }
    } else {
      r.mancanti.push('indirizzo di spedizione: non indicato dal paziente');
    }
    return r;
  }

  /** Persona sull'indirizzo di spedizione e valore del campo Azienda (convenzione dell'ufficio). */
  function datiSpedizione(a) {
    var sp = a.spedizione;
    var altraPersona = !!(sp.destinatarioNome || sp.destinatarioCognome);
    var azienda = sp.presso ? sp.presso : altraPersona ? '' : a.cf;
    return {
      nome: altraPersona ? sp.destinatarioNome : a.nome,
      cognome: altraPersona ? sp.destinatarioCognome : a.cognome,
      azienda: azienda,
      telefono: sp.telefono || a.telefono
    };
  }

  function nota(tipo, dataConferma, azione, daCompletare) {
    var tipoTesto = tipo === 'PROVA' ? 'conferma prova' : tipo === 'MANUALE' ? 'richiesta manuale' : 'conferma acquisto';
    var testo = 'Anagrafica ' + azione + ' automaticamente dalla mail del ' + dataItaliana(dataConferma) + ' (' + tipoTesto + ').';
    if (daCompletare.length) testo += ' Da completare: ' + daCompletare.join(', ') + '.';
    return testo;
  }

  function daCompletare(a) {
    var lista = [];
    if (!a.cf) lista.push('codice fiscale');
    if (!a.telefono) lista.push('telefono');
    return lista;
  }

  /** Piano per un cliente NUOVO. */
  function pianoNuovo(a, input) {
    var piano = {
      esito: 'CREA', clienteId: null, indirizzi: [], tag: CONFIG.TAG_CLIENTE,
      campiScritti: ['nome', 'cognome', 'email', 'residenza', 'spedizione']
    };
    if (a.cf) piano.campiScritti.push('codice fiscale');
    if (a.telefono) piano.campiScritti.push('telefono');
    piano.cliente = {
      firstName: a.nome,
      lastName: a.cognome,
      email: input.email,
      note: nota(input.tipoConferma, input.dataConferma, 'creata', daCompletare(a)),
      tags: [CONFIG.TAG_CLIENTE]
    };
    if (a.telefono) piano.cliente.phone = a.telefono;
    var paziente = { nome: a.nome, cognome: a.cognome, azienda: a.cf, telefono: a.telefono };
    if (a.spedizioneUgualeResidenza) {
      piano.indirizzi.push({ azione: 'CREA', ruolo: 'UNICO', predefinito: true, address: Indirizzi.perShopify(a.residenza, paziente) });
    } else {
      piano.indirizzi.push({ azione: 'CREA', ruolo: 'SPEDIZIONE', predefinito: true, address: Indirizzi.perShopify(a.spedizione, datiSpedizione(a)) });
      piano.indirizzi.push({ azione: 'CREA', ruolo: 'RESIDENZA', predefinito: false, address: Indirizzi.perShopify(a.residenza, paziente) });
    }
    return piano;
  }

  /** Piano per un cliente ESISTENTE: completa solo ciò che manca. */
  function pianoEsistente(a, cliente, input, avvisi) {
    var piano = { esito: 'AGGIORNA', clienteId: cliente.id, indirizzi: [], tag: CONFIG.TAG_CLIENTE, campiScritti: [] };
    var aggiornamento = {};
    if (!cliente.firstName && a.nome) { aggiornamento.firstName = a.nome; piano.campiScritti.push('nome'); }
    if (!cliente.lastName && a.cognome) { aggiornamento.lastName = a.cognome; piano.campiScritti.push('cognome'); }
    if (!cliente.phone && a.telefono) { aggiornamento.phone = a.telefono; piano.campiScritti.push('telefono'); }
    if (cliente.firstName && a.nome && Testo.chiave(cliente.firstName) !== Testo.chiave(a.nome)) {
      avvisi.push('Nome in Shopify "' + cliente.firstName + '" diverso dal documento "' + a.nome + '" (non modificato)');
    }
    if (cliente.lastName && a.cognome && Testo.chiave(cliente.lastName) !== Testo.chiave(a.cognome)) {
      avvisi.push('Cognome in Shopify "' + cliente.lastName + '" diverso dal documento "' + a.cognome + '" (non modificato)');
    }

    var paziente = { nome: a.nome || cliente.firstName, cognome: a.cognome || cliente.lastName, azienda: a.cf, telefono: a.telefono };
    var esistenti = cliente.indirizzi || [];

    function trovaUguale(ind) {
      for (var i = 0; i < esistenti.length; i++) if (Indirizzi.uguali(esistenti[i].interno, ind)) return esistenti[i];
      return null;
    }

    if (a.residenza) {
      var gia = trovaUguale(a.residenza);
      var predefinitaResidenza = a.spedizioneUgualeResidenza;
      if (!gia) {
        piano.indirizzi.push({ azione: 'CREA', ruolo: a.spedizioneUgualeResidenza ? 'UNICO' : 'RESIDENZA', predefinito: predefinitaResidenza,
          address: Indirizzi.perShopify(a.residenza, paziente) });
        piano.campiScritti.push('residenza');
      } else {
        var serveCf = a.cf && !gia.company;
        var serveDefault = predefinitaResidenza && cliente.defaultAddressId !== gia.id;
        if (serveCf || serveDefault) {
          var completo = Indirizzi.daShopifyAInput(gia.raw);
          if (serveCf) completo.company = a.cf;
          piano.indirizzi.push({ azione: 'AGGIORNA', addressId: gia.id, ruolo: 'RESIDENZA', predefinito: serveDefault, address: completo });
          if (serveCf) piano.campiScritti.push('codice fiscale');
        } else if (a.cf && gia.company && CodiceFiscale.normalizza(gia.company) !== a.cf && sembraCf(gia.company)) {
          avvisi.push('CF in Shopify diverso da quello letto (non modificato)');
        }
      }
    }

    if (a.spedizione && !a.spedizioneUgualeResidenza) {
      var giaSped = trovaUguale(a.spedizione);
      if (!giaSped) {
        piano.indirizzi.push({ azione: 'CREA', ruolo: 'SPEDIZIONE', predefinito: true, address: Indirizzi.perShopify(a.spedizione, datiSpedizione(a)) });
        piano.campiScritti.push('spedizione');
      } else if (cliente.defaultAddressId !== giaSped.id) {
        piano.indirizzi.push({ azione: 'AGGIORNA', addressId: giaSped.id, ruolo: 'SPEDIZIONE', predefinito: true,
          address: Indirizzi.daShopifyAInput(giaSped.raw) });
      }
    }

    if (!Object.keys(aggiornamento).length && !piano.indirizzi.length) {
      piano.esito = 'COMPLETO';
      return piano;
    }
    // La nota si aggiunge in coda a quella esistente, senza cancellarla.
    var riga = nota(input.tipoConferma, input.dataConferma, 'completata', daCompletare(a));
    aggiornamento.id = cliente.id;
    aggiornamento.note = cliente.note ? cliente.note + '\n' + riga : riga;
    piano.cliente = aggiornamento;
    return piano;
  }

  /**
   * input = { estrazione, email, clienteEsistente (o null), soglia, tipoConferma, dataConferma }
   * clienteEsistente = { id, firstName, lastName, phone, note, tags, defaultAddressId,
   *                      indirizzi: [{ id, company, interno (indirizzo normalizzato) }] }
   */
  function valuta(input) {
    var e = input.estrazione;
    var a = analizza(e, input.soglia);
    var esistente = input.clienteEsistente;
    var avvisi = a.avvisi.slice();
    if (e.note) avvisi.push('Nota di lettura: ' + e.note);

    var base = { mancanti: a.mancanti.slice(), scartati: a.scartati, avvisi: avvisi, dati: a };

    if (e.paziente_identificato !== 'SI') {
      base.esito = 'DUBBIO';
      base.mancanti.unshift('non è chiaro chi sia il paziente' + (e.piu_persone ? ' (documenti di più persone)' : ''));
      return base;
    }

    // Regola 1: senza nome, cognome, residenza e spedizione non si crea nulla.
    var mancaNome = !a.nome && !(esistente && esistente.firstName);
    var mancaCognome = !a.cognome && !(esistente && esistente.lastName);
    var residenzaEsistente = esistente && (esistente.indirizzi || []).some(function (i) { return sembraCf(i.company); });
    var spedizioneEsistente = esistente && esistente.defaultAddressId;
    if (mancaNome) base.mancanti.unshift('nome');
    if (mancaCognome) base.mancanti.unshift('cognome');

    var haResidenza = !!a.residenza || !!residenzaEsistente;
    var haSpedizione = !!a.spedizione || !!spedizioneEsistente;
    if (mancaNome || mancaCognome || !haResidenza || !haSpedizione) {
      base.esito = 'DATI_MANCANTI';
      if (esistente) {
        // Per un cliente esistente i dati possono già essere in Shopify: tieni solo ciò che manca davvero.
        base.mancanti = base.mancanti.filter(function (m) {
          if (/^indirizzo di residenza/.test(m)) return !haResidenza;
          if (/^indirizzo di spedizione/.test(m)) return !haSpedizione;
          return true;
        });
      }
      return base;
    }

    var piano = esistente ? pianoEsistente(a, esistente, input, avvisi) : pianoNuovo(a, input);
    piano.mancanti = [];
    piano.scartati = a.scartati;
    piano.avvisi = avvisi;
    piano.dati = a;
    return piano;
  }

  /** Riassunto leggibile per il Registro. */
  function riepilogo(piano) {
    var parti = [];
    if (piano.campiScritti && piano.campiScritti.length) parti.push('Scritti: ' + piano.campiScritti.join(', '));
    if (piano.mancanti && piano.mancanti.length) parti.push('Mancanti: ' + piano.mancanti.join('; '));
    var scartati = piano.scartati || [];
    if (scartati.length) parti.push('Non scritti: ' + scartati.map(function (s) { return s.campo + ' (' + s.motivo + ')'; }).join('; '));
    if (piano.avvisi && piano.avvisi.length) parti.push('Avvisi: ' + piano.avvisi.join('; '));
    return parti.join(' | ');
  }

  return { valuta: valuta, analizza: analizza, riepilogo: riepilogo, dataItaliana: dataItaliana };
})();

// ===== 12_shopify.js =====
/**
 * Shopify Admin GraphQL: ricerca cliente ed esecuzione del piano di scrittura.
 * Autenticazione: app del Dev Dashboard con "client credentials" (token di 24 ore
 * rinnovato in automatico) oppure, in alternativa, un token fisso già esistente.
 * Permessi necessari: read_customers, write_customers.
 */

var Shopify = (function () {
  var CHIAVE_CACHE = 'shopify_token_v1';

  var Q_CERCA = 'query CercaClienti($q: String!) { customers(first: 5, query: $q) { nodes { id firstName lastName note tags numberOfOrders ' +
    'defaultEmailAddress { emailAddress } defaultPhoneNumber { phoneNumber } defaultAddress { id } ' +
    'addressesV2(first: 20) { nodes { id firstName lastName company address1 address2 city provinceCode zip countryCodeV2 phone } } } } }';
  var M_CREA_CLIENTE = 'mutation CreaCliente($input: CustomerInput!) { customerCreate(input: $input) { customer { id } userErrors { field message } } }';
  var M_AGGIORNA_CLIENTE = 'mutation AggiornaCliente($input: CustomerInput!) { customerUpdate(input: $input) { customer { id } userErrors { field message } } }';
  var M_CREA_INDIRIZZO = 'mutation CreaIndirizzo($customerId: ID!, $address: MailingAddressInput!, $setAsDefault: Boolean) { ' +
    'customerAddressCreate(customerId: $customerId, address: $address, setAsDefault: $setAsDefault) { address { id } userErrors { field message } } }';
  var M_AGGIORNA_INDIRIZZO = 'mutation AggiornaIndirizzo($customerId: ID!, $addressId: ID!, $address: MailingAddressInput!, $setAsDefault: Boolean) { ' +
    'customerAddressUpdate(customerId: $customerId, addressId: $addressId, address: $address, setAsDefault: $setAsDefault) { address { id } userErrors { field message } } }';
  var M_TAG = 'mutation AggiungiTag($id: ID!, $tags: [String!]!) { tagsAdd(id: $id, tags: $tags) { node { id } userErrors { field message } } }';
  var M_ELIMINA = 'mutation EliminaCliente($input: CustomerDeleteInput!) { customerDelete(input: $input) { deletedCustomerId userErrors { field message } } }';
  var Q_NEGOZIO = 'query Negozio { shop { name myshopifyDomain } }';

  function ErroreShopify(messaggio, dettagli, codice) {
    this.name = 'ErroreShopify';
    this.message = messaggio;
    this.dettagli = dettagli || [];
    this.codice = codice || '';
  }
  ErroreShopify.prototype = Object.create(Error.prototype);

  function negozio() {
    return String(Impostazioni.obbligatoria(CHIAVI.SHOPIFY_SHOP)).replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
  }

  function token(rinnova) {
    var fisso = Impostazioni.leggi(CHIAVI.SHOPIFY_ACCESS_TOKEN, '');
    if (fisso) return fisso;
    var cache = CacheService.getScriptCache();
    if (!rinnova) {
      var salvato = cache.get(CHIAVE_CACHE);
      if (salvato) return salvato;
    }
    var r = UrlFetchApp.fetch('https://' + negozio() + '/admin/oauth/access_token', {
      method: 'post',
      payload: {
        grant_type: 'client_credentials',
        client_id: Impostazioni.obbligatoria(CHIAVI.SHOPIFY_CLIENT_ID),
        client_secret: Impostazioni.obbligatoria(CHIAVI.SHOPIFY_CLIENT_SECRET)
      },
      muteHttpExceptions: true
    });
    if (r.getResponseCode() !== 200) {
      throw new ErroreShopify('Shopify: token non ottenuto (HTTP ' + r.getResponseCode() + ')', [r.getContentText().slice(0, 300)]);
    }
    var dati = JSON.parse(r.getContentText());
    var durata = Math.max(60, Math.min(21600, (Number(dati.expires_in) || 3600) - 600));
    cache.put(CHIAVE_CACHE, dati.access_token, durata);
    return dati.access_token;
  }

  function graphql(query, variabili) {
    var rinnova = false;
    for (var tentativo = 0; tentativo < 4; tentativo++) {
      var r = UrlFetchApp.fetch('https://' + negozio() + '/admin/api/' + CONFIG.SHOPIFY_API_VERSIONE + '/graphql.json', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-Shopify-Access-Token': token(rinnova) },
        payload: JSON.stringify({ query: query, variables: variabili || {} }),
        muteHttpExceptions: true
      });
      var codice = r.getResponseCode();
      if (codice === 401 && !rinnova && !Impostazioni.leggi(CHIAVI.SHOPIFY_ACCESS_TOKEN, '')) { rinnova = true; continue; }
      if (codice === 429 || codice >= 500) { Utilities.sleep(2000 * (tentativo + 1)); continue; }
      if (codice !== 200) throw new ErroreShopify('Shopify HTTP ' + codice, [r.getContentText().slice(0, 300)]);
      var corpo = JSON.parse(r.getContentText());
      if (corpo.errors && corpo.errors.length) {
        var limitato = corpo.errors.some(function (e) { return e.extensions && e.extensions.code === 'THROTTLED'; });
        if (limitato) { Utilities.sleep(2000 * (tentativo + 1)); continue; }
        throw new ErroreShopify('Shopify: errore GraphQL', corpo.errors.map(function (e) { return e.message; }));
      }
      return corpo.data;
    }
    throw new ErroreShopify('Shopify non disponibile dopo più tentativi');
  }

  function erroriUtente(payload) {
    return (payload && payload.userErrors) || [];
  }

  function numerico(gid) {
    var m = /\/(\d+)(?:\?|$)/.exec(String(gid || ''));
    return m ? m[1] : '';
  }

  function urlCliente(gid) {
    return 'https://admin.shopify.com/store/' + negozio().split('.')[0] + '/customers/' + numerico(gid);
  }

  /** Cerca un cliente per email (corrispondenza esatta). Restituisce la struttura per Decisione, o null. */
  function cercaCliente(email) {
    var e = String(email || '').toLowerCase().trim();
    if (!e) return null;
    var dati = graphql(Q_CERCA, { q: 'email:"' + e.replace(/"/g, '') + '"' });
    var trovati = (dati.customers.nodes || []).filter(function (c) {
      return c.defaultEmailAddress && String(c.defaultEmailAddress.emailAddress).toLowerCase() === e;
    });
    if (!trovati.length) return null;
    var c = trovati[0];
    return {
      id: c.id,
      firstName: c.firstName || '',
      lastName: c.lastName || '',
      phone: c.defaultPhoneNumber ? c.defaultPhoneNumber.phoneNumber : '',
      note: c.note || '',
      tags: c.tags || [],
      ordini: Number(c.numberOfOrders) || 0,
      defaultAddressId: c.defaultAddress ? c.defaultAddress.id : null,
      indirizzi: (c.addressesV2.nodes || []).map(function (a) {
        return { id: a.id, company: a.company || '', interno: Indirizzi.daShopify(a), raw: a };
      })
    };
  }

  function telefonoGiaUsato(errori) {
    return errori.some(function (e) {
      return /phone/i.test(String(e.field || '')) || /phone|telefono/i.test(e.message || '');
    });
  }

  function emailGiaUsata(errori) {
    return errori.some(function (e) {
      return /email/i.test(String(e.field || '')) && /taken|already|già/i.test(e.message || '');
    });
  }

  function creaCliente(input, avvisi) {
    var d = graphql(M_CREA_CLIENTE, { input: input }).customerCreate;
    var errori = erroriUtente(d);
    if (errori.length && emailGiaUsata(errori)) {
      // creato nel frattempo (a mano o da un'altra casella): chi chiama rilegge il cliente e completa
      throw new ErroreShopify('Cliente già esistente con questa email', errori.map(function (e) { return e.message; }), 'EMAIL_ESISTENTE');
    }
    if (errori.length && input.phone && telefonoGiaUsato(errori)) {
      avvisi.push('Telefono ' + input.phone + ' già usato da un altro cliente: creato senza telefono');
      var senza = JSON.parse(JSON.stringify(input));
      delete senza.phone;
      d = graphql(M_CREA_CLIENTE, { input: senza }).customerCreate;
      errori = erroriUtente(d);
    }
    if (errori.length) throw new ErroreShopify('Creazione cliente non riuscita', errori.map(function (e) { return e.message; }));
    return d.customer.id;
  }

  function aggiornaCliente(input, avvisi) {
    var d = graphql(M_AGGIORNA_CLIENTE, { input: input }).customerUpdate;
    var errori = erroriUtente(d);
    if (errori.length && input.phone && telefonoGiaUsato(errori)) {
      avvisi.push('Telefono ' + input.phone + ' già usato da un altro cliente: non aggiunto');
      var senza = JSON.parse(JSON.stringify(input));
      delete senza.phone;
      d = graphql(M_AGGIORNA_CLIENTE, { input: senza }).customerUpdate;
      errori = erroriUtente(d);
    }
    if (errori.length) throw new ErroreShopify('Aggiornamento cliente non riuscito', errori.map(function (e) { return e.message; }));
  }

  /** Crea o aggiorna un indirizzo; se Shopify rifiuta la provincia prova le sigle equivalenti (Sardegna). */
  function scriviIndirizzo(clienteId, voce) {
    var sigle = voce.address.provinceCode ? Comuni.equivalenti(voce.address.provinceCode) : [null];
    var ultimi = [];
    for (var i = 0; i < sigle.length; i++) {
      var address = JSON.parse(JSON.stringify(voce.address));
      if (sigle[i]) address.provinceCode = sigle[i];
      var d = voce.azione === 'AGGIORNA'
        ? graphql(M_AGGIORNA_INDIRIZZO, { customerId: clienteId, addressId: voce.addressId, address: address, setAsDefault: !!voce.predefinito }).customerAddressUpdate
        : graphql(M_CREA_INDIRIZZO, { customerId: clienteId, address: address, setAsDefault: !!voce.predefinito }).customerAddressCreate;
      ultimi = erroriUtente(d);
      if (!ultimi.length) return;
      var suProvincia = ultimi.some(function (e) { return /province|provinc/i.test(String(e.field || '') + ' ' + e.message); });
      if (!suProvincia) break;
    }
    throw new ErroreShopify('Indirizzo (' + voce.ruolo + ') non salvato', ultimi.map(function (e) { return e.message; }));
  }

  function eliminaCliente(clienteId) {
    try {
      graphql(M_ELIMINA, { input: { id: clienteId } });
    } catch (e) {
      // se l'eliminazione fallisce l'errore principale viene comunque segnalato
    }
  }

  /**
   * Esegue il piano prodotto da Decisione.valuta(). Per un cliente nuovo la
   * scrittura è "tutto o niente": se un indirizzo non viene accettato il
   * cliente appena creato viene eliminato.
   * Restituisce { clienteId, url, avvisi }.
   */
  function eseguiPiano(piano) {
    var avvisi = [];
    if (piano.esito === 'CREA') {
      var id = creaCliente(piano.cliente, avvisi);
      try {
        piano.indirizzi.forEach(function (voce) { scriviIndirizzo(id, voce); });
      } catch (e) {
        eliminaCliente(id);
        throw e;
      }
      return { clienteId: id, url: urlCliente(id), avvisi: avvisi };
    }
    if (piano.esito === 'AGGIORNA') {
      if (piano.cliente) aggiornaCliente(piano.cliente, avvisi);
      piano.indirizzi.forEach(function (voce) { scriviIndirizzo(piano.clienteId, voce); });
      var t = graphql(M_TAG, { id: piano.clienteId, tags: [piano.tag] }).tagsAdd;
      if (erroriUtente(t).length) avvisi.push('Tag non aggiunto');
      return { clienteId: piano.clienteId, url: urlCliente(piano.clienteId), avvisi: avvisi };
    }
    return { clienteId: piano.clienteId || null, url: piano.clienteId ? urlCliente(piano.clienteId) : '', avvisi: avvisi };
  }

  function verifica() {
    return graphql(Q_NEGOZIO, {}).shop;
  }

  return {
    cercaCliente: cercaCliente,
    eseguiPiano: eseguiPiano,
    urlCliente: urlCliente,
    verifica: verifica,
    graphql: graphql,
    ErroreShopify: ErroreShopify
  };
})();

// ===== 13_gmail.js =====
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

  /**
   * Il mittente è già in contatto con Migelino? Vero se il messaggio risponde o cita
   * una mail di Migelino (anche di un collega, es. il paziente scrive a Silvia rispondendo
   * a una mail di Denis) oppure se da questa casella gli si è già scritto.
   */
  function haRelazione(email, msg) {
    if (msg && /@migelino\.(it|ch)\b/i.test(msg.testo || '')) return true;
    var q = 'to:' + email + ' (from:me OR from:migelino.it OR from:migelino.ch)';
    return GmailApp.search(q, 0, 1).length > 0;
  }

  /** Email della casella su cui gira lo script (chi ha attivato il trigger). */
  function casella() {
    try { return String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { return ''; }
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
    var utente = casella();
    return 'https://mail.google.com/mail/' + (utente ? '?authuser=' + encodeURIComponent(utente) : 'u/0/') + '#all/' + threadId;
  }

  return {
    dto: dto,
    nuoviMessaggi: nuoviMessaggi,
    haRelazione: haRelazione,
    casella: casella,
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

// ===== 14_stato.js =====
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

// ===== 15_registro.js =====
/**
 * Registro delle decisioni nel Foglio Google che contiene lo script, unico per
 * tutte le caselle (la colonna "Casella" dice da quale casella arriva la riga).
 * In modalità LIVE non si salvano i valori dei campi (restano solo in Shopify);
 * in modalità OMBRA si salva la proposta, per confrontarla con il lavoro dell'ufficio.
 */

var Registro = (function () {
  var CHIAVE_ID = 'REGISTRO_ID';
  var INTESTAZIONI = ['Data', 'Modalità', 'Casella', 'Esito', 'Tipo', 'Prob. conferma', 'Paziente', 'Email', 'Mail',
    'Cliente Shopify', 'Dettagli', 'Frase di conferma', 'Proposta (solo ombra)', 'Errore'];

  function documento() {
    var p = PropertiesService.getScriptProperties();
    var id = p.getProperty(CHIAVE_ID);
    if (id) return SpreadsheetApp.openById(id);
    var attivo = SpreadsheetApp.getActiveSpreadsheet();
    if (!attivo) throw new Error('Foglio del Registro non trovato: esegui "Configura" dal menu del Foglio.');
    p.setProperty(CHIAVE_ID, attivo.getId());
    return attivo;
  }

  function foglio(nome, intestazioni) {
    var doc = documento();
    var f = doc.getSheetByName(nome);
    if (!f) {
      f = doc.insertSheet(nome);
      if (intestazioni && intestazioni.length) {
        f.getRange(1, 1, 1, intestazioni.length).setValues([intestazioni]).setFontWeight('bold');
        f.setFrozenRows(1);
      }
    }
    return f;
  }

  // Link come testo semplice (Fogli li rende cliccabili): niente formule, che
  // cambiano separatore a seconda della lingua del Foglio.
  function collegamento(url) {
    return url ? String(url) : '';
  }

  /**
   * voce = { modalita, casella, esito, tipo, probabilita, paziente, email, linkMail, linkCliente,
   *          dettagli, frase, proposta, errore }
   */
  function scrivi(voce) {
    var f = foglio(CONFIG.FOGLI.REGISTRO, INTESTAZIONI);
    f.appendRow([
      new Date(),
      voce.modalita || '',
      voce.casella || '',
      voce.esito || '',
      voce.tipo || '',
      voce.probabilita === undefined || voce.probabilita === null ? '' : Math.round(voce.probabilita * 100) + '%',
      voce.paziente || '',
      voce.email || '',
      collegamento(voce.linkMail),
      collegamento(voce.linkCliente),
      voce.dettagli || '',
      voce.frase || '',
      voce.modalita === 'OMBRA' && voce.proposta ? JSON.stringify(voce.proposta) : '',
      voce.errore || ''
    ]);
  }

  return { scrivi: scrivi, foglio: foglio, documento: documento, INTESTAZIONI: INTESTAZIONI };
})();

// ===== 16_pipeline.js =====
/**
 * Pipeline: dal messaggio Gmail all'anagrafica su Shopify.
 *
 *  filtro a regole -> riconoscimento conferma (Claude) -> raccolta mail e allegati
 *  -> estrazione (Claude) -> cliente esistente? -> decisione (regole Migelino)
 *  -> scrittura su Shopify (solo LIVE) -> etichetta Gmail -> Registro
 *
 * Gira sulla casella di chi ha attivato il trigger (Denis, Silvia, Marco...).
 * La scrittura su Shopify avviene sotto un blocco condiviso tra le caselle, così
 * due caselle che ricevono la stessa conferma non creano due volte il cliente.
 */

var Pipeline = (function () {
  var ETICHETTA_PER_ESITO = {
    CREA: CONFIG.ETICHETTE.CREATA,
    AGGIORNA: CONFIG.ETICHETTE.AGGIORNATA,
    COMPLETO: CONFIG.ETICHETTE.AGGIORNATA,
    DATI_MANCANTI: CONFIG.ETICHETTE.DATI_MANCANTI,
    DUBBIO: CONFIG.ETICHETTE.DUBBIA,
    DUBBIA: CONFIG.ETICHETTE.DUBBIA,
    ERRORE: CONFIG.ETICHETTE.ERRORE
  };
  var TESTO_ESITO = {
    CREA: 'Anagrafica creata',
    AGGIORNA: 'Anagrafica completata',
    COMPLETO: 'Anagrafica già completa',
    DATI_MANCANTI: 'Dati mancanti: nulla creato',
    DUBBIO: 'Paziente non chiaro: nulla creato',
    DUBBIA: 'Conferma dubbia',
    NON_CONFERMA: 'Non è una conferma',
    ERRORE: 'Errore'
  };

  function scadenza(inizio) {
    return Date.now() - inizio > CONFIG.MAX_MS_ESECUZIONE;
  }

  /** Riduce il piano a ciò che serve nel Registro in modalità ombra. */
  function proposta(piano) {
    return { esito: piano.esito, cliente: piano.cliente || null, indirizzi: (piano.indirizzi || []).map(function (i) {
      return { ruolo: i.ruolo, azione: i.azione, predefinito: i.predefinito, address: i.address };
    }) };
  }

  /**
   * Cerca il cliente, decide ed eventualmente scrive su Shopify sotto un blocco
   * condiviso tra tutte le caselle. Se nel frattempo il cliente è stato creato
   * (a mano o da un'altra casella) rilegge e completa invece di duplicare.
   */
  function decidiEScrivi(msg, estrazione, tipo, modalita, avvisiRaccolta) {
    var lock = LockService.getScriptLock();
    lock.waitLock(60000);
    try {
      for (var tentativo = 0; tentativo < 2; tentativo++) {
        var esistente = Shopify.cercaCliente(msg.mittente);
        var piano = Decisione.valuta({
          estrazione: estrazione,
          email: msg.mittente,
          clienteEsistente: esistente,
          soglia: Impostazioni.sogliaCampo(),
          tipoConferma: tipo,
          dataConferma: msg.dataIso
        });
        piano.avvisi = piano.avvisi.concat(avvisiRaccolta);
        var risultato = { clienteId: esistente ? esistente.id : null, url: esistente ? Shopify.urlCliente(esistente.id) : '', avvisi: [] };
        if (modalita === 'LIVE' && (piano.esito === 'CREA' || piano.esito === 'AGGIORNA')) {
          try {
            risultato = Shopify.eseguiPiano(piano);
          } catch (e) {
            if (e && e.codice === 'EMAIL_ESISTENTE' && tentativo === 0) continue;
            throw e;
          }
          piano.avvisi = piano.avvisi.concat(risultato.avvisi);
        }
        return { piano: piano, risultato: risultato };
      }
      throw new Error('Cliente creato nel frattempo ma non ritrovato su Shopify');
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Elabora un messaggio. opzioni:
   *  - forzato: true se richiesto con l'etichetta "▶ Crea" (salta riconoscimento)
   *  - modalita: 'LIVE' | 'OMBRA'
   * Restituisce { esito, usatoClaude }.
   */
  function elaboraMessaggio(msg, opzioni) {
    var modalita = opzioni.modalita;
    var casella = Posta.casella();
    var voce = {
      modalita: modalita, casella: casella, email: msg.mittente, paziente: msg.nome, linkMail: Posta.link(msg.threadId)
    };
    var statoPrecedente = Stato.statoPaziente(msg.mittente);
    var completamento = !!(statoPrecedente && statoPrecedente.esito === 'DATI_MANCANTI');
    var tipo = opzioni.forzato ? 'MANUALE' : completamento ? statoPrecedente.tipo : '';

    try {
      if (!opzioni.forzato && !completamento) {
        var filtro = Prefiltro.valuta(msg, { haRelazione: !!statoPrecedente || Posta.haRelazione(msg.mittente, msg) });
        if (!filtro.passa) return { esito: 'IGNORATO', usatoClaude: false };

        var riconoscimento = Classificatore.classifica(Posta.conversazione(msg.threadId, msg.id));
        voce.tipo = riconoscimento.tipo;
        voce.probabilita = riconoscimento.probabilita;
        voce.frase = riconoscimento.frase_chiave;
        if (riconoscimento.categoria !== 'CONFERMA') {
          voce.esito = TESTO_ESITO[riconoscimento.categoria];
          voce.dettagli = riconoscimento.motivazione;
          if (riconoscimento.categoria === 'DUBBIA') {
            if (modalita === 'LIVE') Posta.impostaEsito(msg.threadId, CONFIG.ETICHETTE.DUBBIA);
            Stato.salvaStatoPaziente(msg.mittente, { esito: 'DUBBIA', tipo: riconoscimento.tipo, threadId: msg.threadId, casella: casella });
          }
          Registro.scrivi(voce);
          return { esito: riconoscimento.categoria, usatoClaude: true };
        }
        tipo = riconoscimento.tipo;
      } else {
        voce.tipo = tipo;
        voce.frase = opzioni.forzato ? 'Richiesta manuale (etichetta ▶ Crea)' : 'Completamento dopo dati mancanti';
      }

      // Raccolta ed estrazione
      var raccolta = Posta.dossier(msg.mittente, opzioni.finoAMs || null);
      var estrazione = Estrattore.estrai({
        mittente: { nome: msg.nome, email: msg.mittente },
        tipoConferma: tipo,
        dataConferma: msg.dataIso,
        allegati: raccolta.allegati,
        nonLeggibili: raccolta.nonLeggibili,
        messaggi: raccolta.messaggi
      });
      // Dati letti in precedenza (anche da un'altra casella) quando mancava qualcosa
      if (completamento && statoPrecedente.estrazione) estrazione = Estrattore.unisci(statoPrecedente.estrazione, estrazione);
      var nomeCompleto = [estrazione.nome && estrazione.nome.valore, estrazione.cognome && estrazione.cognome.valore].filter(Boolean).join(' ');
      if (nomeCompleto) voce.paziente = Testo.maiuscoleNome(nomeCompleto);

      var avvisiRaccolta = raccolta.nonLeggibili.length ? ['Allegati non leggibili: ' + raccolta.nonLeggibili.join(', ')] : [];
      var scrittura = decidiEScrivi(msg, estrazione, tipo, modalita, avvisiRaccolta);
      var piano = scrittura.piano;
      var risultato = scrittura.risultato;

      voce.esito = TESTO_ESITO[piano.esito] + (modalita === 'OMBRA' && (piano.esito === 'CREA' || piano.esito === 'AGGIORNA') ? ' (simulata)' : '');
      voce.linkCliente = risultato.url;
      voce.dettagli = Decisione.riepilogo(piano);
      voce.proposta = proposta(piano);
      if (modalita === 'LIVE') {
        Posta.impostaEsito(msg.threadId, ETICHETTA_PER_ESITO[piano.esito]);
        // la conferma poteva essere in un'altra conversazione della stessa casella: aggiorna anche quella
        var stessaCasella = !statoPrecedente || !statoPrecedente.casella || statoPrecedente.casella === casella;
        if (completamento && stessaCasella && statoPrecedente.threadId && statoPrecedente.threadId !== msg.threadId) {
          try { Posta.impostaEsito(statoPrecedente.threadId, ETICHETTA_PER_ESITO[piano.esito]); } catch (x) { /* conversazione non più disponibile */ }
        }
      }
      var nuovoStato = { esito: piano.esito, tipo: tipo, threadId: msg.threadId, casella: casella };
      if (piano.esito === 'DATI_MANCANTI') nuovoStato.estrazione = Estrattore.compatta(estrazione); // per completare dopo
      Stato.salvaStatoPaziente(msg.mittente, nuovoStato);
      Registro.scrivi(voce);
      return { esito: piano.esito, usatoClaude: true };
    } catch (e) {
      voce.esito = TESTO_ESITO.ERRORE;
      voce.errore = String(e && e.message ? e.message : e) + (e && e.dettagli ? ' — ' + [].concat(e.dettagli).join('; ') : '');
      if (modalita === 'LIVE') {
        try { Posta.impostaEsito(msg.threadId, CONFIG.ETICHETTE.ERRORE); } catch (x) { /* ignora */ }
      }
      Registro.scrivi(voce);
      return { esito: 'ERRORE', usatoClaude: true };
    }
  }

  /** Conversazioni con l'etichetta "▶ Crea" messa a mano dall'ufficio. */
  function elaboraManuali(inizio, modalita) {
    var threads = Posta.conversazioniConEtichetta(CONFIG.ETICHETTE.CREA_MANUALE, 5);
    threads.forEach(function (t) {
      if (scadenza(inizio)) return;
      var esterni = t.getMessages().filter(function (m) { return !Prefiltro.interno(Testo.estraiEmail(m.getFrom())); });
      Posta.togliEtichetta(t.getId(), CONFIG.ETICHETTE.CREA_MANUALE);
      if (!esterni.length) return;
      var ultimo = esterni[esterni.length - 1];
      Stato.segnaElaborato(ultimo.getId()); // evita che venga rielaborato anche come messaggio nuovo
      elaboraMessaggio(Posta.dto(ultimo), { forzato: true, modalita: modalita });
    });
  }

  /**
   * Conversazioni di questa casella ferme su "Dati mancanti" il cui paziente è stato
   * poi completato (anche da un'altra casella): aggiorna l'etichetta.
   */
  function riallineaEtichette(modalita) {
    if (modalita !== 'LIVE') return;
    Posta.conversazioniConEtichetta(CONFIG.ETICHETTE.DATI_MANCANTI, 20).forEach(function (t) {
      var esterni = t.getMessages().filter(function (m) { return !Prefiltro.interno(Testo.estraiEmail(m.getFrom())); });
      if (!esterni.length) return;
      var stato = Stato.statoPaziente(Testo.estraiEmail(esterni[esterni.length - 1].getFrom()));
      if (stato && (stato.esito === 'CREA' || stato.esito === 'AGGIORNA' || stato.esito === 'COMPLETO')) {
        Posta.impostaEsito(t.getId(), ETICHETTA_PER_ESITO[stato.esito]);
      }
    });
  }

  /** Esecuzione periodica (trigger ogni 10 minuti). */
  function esegui() {
    var inizio = Date.now();
    var lock = LockService.getUserLock(); // un giro alla volta per casella; le caselle non si bloccano a vicenda
    if (!lock.tryLock(5000)) return;
    try {
      var modalita = Impostazioni.modalita();
      Posta.creaEtichette();
      elaboraManuali(inizio, modalita);
      riallineaEtichette(modalita);

      var messaggi = Posta.nuoviMessaggi(Stato.ultimoControllo());
      var conClaude = 0;
      var ultimo = null;
      var completato = true;
      for (var i = 0; i < messaggi.length; i++) {
        if (scadenza(inizio) || conClaude >= CONFIG.MAX_MESSAGGI_PER_ESECUZIONE) { completato = false; break; }
        var m = messaggi[i];
        if (!Stato.giaElaborato(m.getId())) {
          // segnato PRIMA: un errore imprevisto non deve far ripetere (e pagare) la stessa elaborazione a ogni giro
          Stato.segnaElaborato(m.getId());
          try {
            var r = elaboraMessaggio(Posta.dto(m), { forzato: false, modalita: modalita });
            if (r.usatoClaude) conClaude++;
          } catch (e) {
            Logger.log('Errore imprevisto sul messaggio ' + m.getId() + ': ' + (e && e.message ? e.message : e));
            conClaude++;
          }
        }
        ultimo = m.getDate().getTime();
      }
      if (completato) Stato.salvaUltimoControllo(inizio);
      else if (ultimo) Stato.salvaUltimoControllo(ultimo);
      Stato.battito(Posta.casella(), messaggi.length + ' messaggi nuovi, ' + conClaude + ' analizzati');
      Stato.pulisci();
    } finally {
      lock.releaseLock();
    }
  }

  return { esegui: esegui, elaboraMessaggio: elaboraMessaggio };
})();

// ===== 17_collaudo.js =====
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
 * Usa la casella di chi lo avvia: va avviato dall'account che inoltra le
 * conferme all'ufficio ordini.
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
      if (!Prefiltro.valuta(dto, { haRelazione: Posta.haRelazione(email2, dto) }).passa) continue;
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
    var lock = LockService.getUserLock();
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

// ===== 18_main.js =====
/**
 * Punti di ingresso: menu del Foglio, configurazione, trigger.
 * Le funzioni qui sotto sono quelle che si vedono nell'editor di Apps Script.
 *
 * Più caselle: il Foglio (con lo script) si condivide con i colleghi; ognuno apre
 * il Foglio e usa "Attiva il controllo sulla mia casella". Il trigger gira con
 * l'account di chi lo attiva e quindi legge la sua casella. Chiavi, modalità,
 * Registro e stato dei pazienti sono in comune.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Anagrafiche')
    .addItem('1. Configura chiavi e impostazioni (una volta sola)', 'configura')
    .addItem('2. Verifica connessioni e caselle', 'verificaConnessioni')
    .addItem('3. Attiva il controllo sulla mia casella (ogni 10 minuti)', 'attivaAutomazione')
    .addSeparator()
    .addItem('Esegui adesso sulla mia casella', 'esegui')
    .addItem('Avvia collaudo sullo storico', 'avviaCollaudo')
    .addItem('Cambia modalità (OMBRA / LIVE, per tutte le caselle)', 'cambiaModalita')
    .addSeparator()
    .addItem('Disattiva il controllo sulla mia casella', 'disattivaAutomazione')
    .addToUi();
}

/** Chiede le impostazioni una alla volta; lasciare vuoto = mantenere il valore attuale. */
function configura() {
  var ui = SpreadsheetApp.getUi();
  Registro.documento(); // memorizza l'ID di questo Foglio come Registro
  var voci = [
    [CHIAVI.ANTHROPIC_API_KEY, 'Chiave API di Claude (console.anthropic.com)', true],
    [CHIAVI.CLAUDE_MODEL, 'Modello Claude da usare (vedi guida di installazione)', false],
    [CHIAVI.SHOPIFY_SHOP, 'Dominio Shopify (es. nome-negozio.myshopify.com)', false],
    [CHIAVI.SHOPIFY_CLIENT_ID, 'Shopify: Client ID dell\'app (Dev Dashboard)', false],
    [CHIAVI.SHOPIFY_CLIENT_SECRET, 'Shopify: Client Secret dell\'app', true],
    [CHIAVI.SHOPIFY_ACCESS_TOKEN, 'Shopify: token fisso (solo se NON usi Client ID/Secret)', true]
  ];
  for (var i = 0; i < voci.length; i++) {
    var chiave = voci[i][0];
    var attuale = Impostazioni.leggi(chiave, '');
    var mostra = attuale ? (voci[i][2] ? '(già impostata)' : attuale) : '(vuota)';
    var r = ui.prompt('Configurazione ' + (i + 1) + '/' + voci.length, voci[i][1] + '\nValore attuale: ' + mostra + '\n\nLascia vuoto per non cambiarlo.', ui.ButtonSet.OK_CANCEL);
    if (r.getSelectedButton() !== ui.Button.OK) return;
    var valore = r.getResponseText().trim();
    if (valore) Impostazioni.scrivi(chiave, valore);
  }
  if (!Impostazioni.leggi(CHIAVI.MODALITA, '')) Impostazioni.scrivi(CHIAVI.MODALITA, CONFIG.MODALITA_PREDEFINITA);
  ui.alert('Impostazioni salvate. Modalità attuale: ' + Impostazioni.modalita() + '.\nOra usa "2. Verifica connessioni".');
}

/** Prova Claude, Shopify e Gmail e mostra l'esito. */
function verificaConnessioni() {
  var righe = [];
  try {
    var r = Claude.chiama({
      sistema: 'Rispondi solo con il JSON richiesto.',
      contenuti: [Claude.testo('Scrivi ok=true.')],
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
      sforzo: 'low',
      maxToken: 2000
    });
    righe.push('Claude: OK (' + r.modello + ')');
  } catch (e) {
    righe.push('Claude: ERRORE - ' + e.message + (e.dettagli ? ' ' + e.dettagli : ''));
  }
  try {
    var negozio = Shopify.verifica();
    righe.push('Shopify: OK (' + negozio.name + ' - ' + negozio.myshopifyDomain + ')');
  } catch (e) {
    righe.push('Shopify: ERRORE - ' + e.message + (e.dettagli ? ' ' + [].concat(e.dettagli).join('; ') : ''));
  }
  try {
    Posta.creaEtichette();
    righe.push('Gmail: OK (etichette "' + CONFIG.ETICHETTE.RADICE + '" pronte)');
  } catch (e) {
    righe.push('Gmail: ERRORE - ' + e.message);
  }
  righe.push('Modalità: ' + Impostazioni.modalita());
  righe.push('');
  righe.push('Questa casella: ' + (Posta.casella() || 'sconosciuta') + (triggerAttivo() ? ' (controllo attivo)' : ' (controllo NON attivo)'));
  righe.push('Caselle registrate:');
  var caselle = Stato.elencoCaselle();
  if (!caselle.length) righe.push('  nessuna');
  caselle.forEach(function (c) {
    var giro = c.ultimoGiro ? Utilities.formatDate(new Date(c.ultimoGiro), 'Europe/Rome', 'dd/MM HH:mm') : 'mai';
    righe.push('  ' + c.email + ': ' + (c.attiva ? 'attiva' : 'disattivata') + ', ultimo giro ' + giro + (c.riepilogo ? ' (' + c.riepilogo + ')' : ''));
  });
  SpreadsheetApp.getUi().alert(righe.join('\n'));
}

function triggerAttivo() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'esegui'; });
}

function rimuoviTrigger(nomeFunzione) {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === nomeFunzione) ScriptApp.deleteTrigger(t);
  });
}

function attivaAutomazione() {
  rimuoviTrigger('esegui');
  ScriptApp.newTrigger('esegui').timeBased().everyMinutes(CONFIG.MINUTI_TRIGGER).create();
  Posta.creaEtichette();
  var casella = Posta.casella();
  Stato.registraCasella(casella, true);
  SpreadsheetApp.getUi().alert('Controllo attivo sulla casella ' + casella + ' ogni ' + CONFIG.MINUTI_TRIGGER + ' minuti.\nModalità: ' +
    Impostazioni.modalita() + (Impostazioni.modalita() === 'OMBRA' ? ' (registra soltanto, non scrive su Shopify).' : '.'));
}

function disattivaAutomazione() {
  rimuoviTrigger('esegui');
  Stato.registraCasella(Posta.casella(), false);
  SpreadsheetApp.getUi().alert('Controllo disattivato sulla casella ' + Posta.casella() + '.');
}

function cambiaModalita() {
  var ui = SpreadsheetApp.getUi();
  var attuale = Impostazioni.modalita();
  var nuova = attuale === 'LIVE' ? 'OMBRA' : 'LIVE';
  var spiegazione = nuova === 'LIVE'
    ? 'In modalità LIVE il sistema CREA e COMPLETA le anagrafiche su Shopify e mette le etichette in Gmail.'
    : 'In modalità OMBRA il sistema lavora e registra nel Foglio cosa farebbe, senza scrivere su Shopify né etichettare.';
  var r = ui.alert('Passare da ' + attuale + ' a ' + nuova + '?', spiegazione, ui.ButtonSet.YES_NO);
  if (r === ui.Button.YES) {
    Impostazioni.scrivi(CHIAVI.MODALITA, nuova);
    ui.alert('Modalità attuale: ' + nuova);
  }
}

/** Funzione chiamata dal trigger ogni 10 minuti (e da "Esegui adesso"). */
function esegui() {
  Pipeline.esegui();
}

function avviaCollaudo() {
  var ui = SpreadsheetApp.getUi();
  var r = ui.alert('Avviare il collaudo sullo storico?',
    'Il sistema rilegge le conferme degli ultimi mesi (sola lettura) e confronta i risultati con le anagrafiche create a mano. ' +
    'Dura circa 1-2 ore e usa l\'API di Claude (costo stimato 15-25 euro). Il risultato apparirà nel foglio "' + CONFIG.FOGLI.RIEPILOGO + '".',
    ui.ButtonSet.YES_NO);
  if (r !== ui.Button.YES) return;
  if (!Impostazioni.leggi(CHIAVI.EMAIL_UFFICIO_ORDINI, '')) {
    var email = ui.prompt('Email dell\'ufficio ordini',
      'Indirizzo a cui vengono inoltrate le mail dei pazienti che confermano (serve a riconoscere le conferme storiche).',
      ui.ButtonSet.OK_CANCEL);
    if (email.getSelectedButton() !== ui.Button.OK || !email.getResponseText().trim()) return;
    Impostazioni.scrivi(CHIAVI.EMAIL_UFFICIO_ORDINI, email.getResponseText().trim());
  }
  var esito = Collaudo.avvia();
  ui.alert('Collaudo avviato: ' + esito.positivi + ' conferme storiche e ' + esito.negativi + ' casi di controllo. Prosegue da solo ogni 5 minuti.');
}

/** Chiamata dal trigger del collaudo. */
function continuaCollaudo() {
  Collaudo.continua();
}
