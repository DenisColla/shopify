/**
 * Finestra "Contratto di vendita" nel Foglio: menu, pagina HTML (src/html/contratto.html,
 * incorporata dal build come HTML_CONTRATTO) e funzioni chiamate dalla pagina.
 *
 * La pagina riceve il sorgente di contrattoNucleo() e lo esegue nel browser: l'anteprima
 * si aggiorna senza chiamare lo script. I controlli e il PDF restano lato script.
 */

var ContrattoUi = (function () {
  function menu(ui) {
    ui.createMenu('Contratti')
      .addItem('Nuovo contratto di vendita', 'apriContratto')
      .addItem('Riapri il contratto della riga selezionata', 'riapriContratto')
      .addSeparator()
      .addItem('Imposta il mio nome e la mia firma', 'impostaFirmaContratto')
      .addItem('Imposta la cartella Drive dei contratti', 'impostaCartellaContratti')
      .addToUi();
  }

  /** JSON sicuro dentro un <script>: "</" non deve chiudere il blocco. */
  function jsonPerPagina(valore) {
    return JSON.stringify(valore === undefined ? null : valore).replace(/<\//g, '<\\/');
  }

  function pagina(datiIniziali) {
    var op = ContrattoArchivio.operatore();
    var t = HtmlService.createTemplate(HTML_CONTRATTO);
    t.nucleoSorgente = contrattoNucleo.toString();
    t.risorseJson = jsonPerPagina(contrattoRisorse());
    t.datiJson = jsonPerPagina(datiIniziali || null);
    t.operatoreJson = jsonPerPagina({ email: op.email, nome: op.nome, haFirma: !!op.firmaFileId });
    t.versione = CONFIG.VERSIONE;
    return t.evaluate().setTitle('Contratto di vendita');
  }

  function mostra(dati, titolo) {
    SpreadsheetApp.getUi().showModalDialog(pagina(dati).setWidth(1500).setHeight(900), titolo || 'Nuovo contratto di vendita');
  }

  return { menu: menu, pagina: pagina, mostra: mostra };
})();

// ---------------------------------------------------------------- voci di menu
function apriContratto() {
  ContrattoUi.mostra(null, 'Nuovo contratto di vendita');
}

function riapriContratto() {
  var dati = ContrattoArchivio.riapriDaRigaAttiva();
  if (!dati) {
    SpreadsheetApp.getUi().alert('Seleziona prima una riga del foglio "' + CONFIG.FOGLI.CONTRATTI + '" (colonna "Dati" compilata).');
    return;
  }
  ContrattoUi.mostra(dati, 'Contratto ' + (dati.numero ? dati.numero + ' ' : '') + '(nuova versione)');
}

function impostaFirmaContratto() {
  var ui = SpreadsheetApp.getUi();
  var attuale = ContrattoArchivio.operatore();
  var r1 = ui.prompt('Nome e cognome sotto la firma',
    'Compare nel contratto sotto "' + CONFIG.CONTRATTO.FIRMA_PER + '".\nValore attuale: ' + (attuale.nome || '(vuoto)') +
    '\n\nLascia vuoto per non cambiarlo, scrivi - per cancellarlo.', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  var r2 = ui.prompt('Immagine della firma',
    'Link (o ID) del file PNG/JPG su Drive con la tua firma, su sfondo bianco. Il file deve essere leggibile dal tuo account.' +
    '\nValore attuale: ' + (attuale.firmaFileId || '(nessuna firma)') +
    '\n\nLascia vuoto per non cambiarlo, scrivi - per cancellarlo.', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  var nome = r1.getResponseText().trim();
  var file = r2.getResponseText().trim();
  var esito = ContrattoArchivio.impostaFirma(nome === '' ? null : nome, file === '' ? null : file);
  ui.alert('Firma: ' + (esito.immagine ? 'OK, immagine letta da Drive' : esito.errore || 'nessuna immagine impostata') +
    '\nNome: ' + (esito.nome || '(vuoto)'));
}

function impostaCartellaContratti() {
  var ui = SpreadsheetApp.getUi();
  var attuale = Impostazioni.leggi(CHIAVI.CONTRATTI_CARTELLA_ID, '');
  var r = ui.prompt('Cartella Drive dei contratti',
    'Link (o ID) della cartella in cui salvare i PDF; viene creata una sottocartella per anno.\n' +
    'Valore attuale: ' + (attuale || '(automatica: cartella "' + CONFIG.CONTRATTO.CARTELLA_DRIVE + '" accanto a questo Foglio)') +
    '\n\nLascia vuoto per non cambiarlo.', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK || !r.getResponseText().trim()) return;
  try {
    var c = ContrattoArchivio.impostaCartella(r.getResponseText().trim());
    ui.alert('Cartella impostata: ' + c.nome + '\n' + c.url);
  } catch (e) {
    ui.alert('Cartella non accessibile: ' + (e && e.message ? e.message : e));
  }
}

// --------------------------------------------- funzioni chiamate dalla pagina
function contrattoValida(dati) {
  var c = ContrattoControlli.valida(dati);
  return { errori: c.errori, avvisi: c.avvisi, dati: c.dati, totale: c.totale };
}

function contrattoGenera(dati, opzioni) {
  return ContrattoArchivio.genera(dati, opzioni);
}

function contrattoFirma() {
  var f = ContrattoArchivio.firma();
  return { nome: f.nome, immagine: f.immagine, errore: f.errore };
}

/** Pubblicazione facoltativa come web app (Distribuisci > Nuova distribuzione > App web). */
function doGet() {
  return ContrattoUi.pagina(null);
}
