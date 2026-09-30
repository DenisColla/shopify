/**
 * Registro delle decisioni nel Foglio Google che contiene lo script.
 * In modalità LIVE non si salvano i valori dei campi (restano solo in Shopify);
 * in modalità OMBRA si salva la proposta, per confrontarla con il lavoro dell'ufficio.
 */

var Registro = (function () {
  var CHIAVE_ID = 'REGISTRO_ID';
  var INTESTAZIONI = ['Data', 'Modalità', 'Esito', 'Tipo', 'Prob. conferma', 'Paziente', 'Email', 'Mail',
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
   * voce = { modalita, esito, tipo, probabilita, paziente, email, linkMail, linkCliente,
   *          dettagli, frase, proposta, errore }
   */
  function scrivi(voce) {
    var f = foglio(CONFIG.FOGLI.REGISTRO, INTESTAZIONI);
    f.appendRow([
      new Date(),
      voce.modalita || '',
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
