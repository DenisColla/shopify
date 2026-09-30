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
