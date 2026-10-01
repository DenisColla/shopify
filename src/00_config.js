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

  cancella: function (chiave) {
    this._proprieta().deleteProperty(chiave);
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
