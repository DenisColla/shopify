/**
 * Archivio dei contratti: numero progressivo, PDF su Drive, riga nel foglio
 * "Contratti", bozza Gmail facoltativa, firma dell'operatore.
 *
 * La firma (immagine PNG/JPG) resta su Drive: ogni operatore imposta nome e
 * file dal menu "Contratti > Imposta il mio nome e la mia firma"; i valori
 * stanno nelle Proprietà dell'utente, quindi ognuno vede solo la propria.
 */

var ContrattoArchivio = (function () {
  var INTESTAZIONI = ['Data', 'Numero', 'Operatore', 'Cliente', 'Email', 'Telefono', 'Totale', 'Pagamento', 'PDF',
    'Preventivo', 'Bozza email', 'Stato', 'Dati'];
  var FUSO = 'Europe/Rome';

  function nucleo() {
    return contrattoNucleo(contrattoRisorse());
  }

  function proprietaUtente() {
    return PropertiesService.getUserProperties();
  }

  /** Estrae l'ID da un link di Drive (file o cartella) oppure restituisce il testo com'è. */
  function idDrive(testo) {
    var t = String(testo || '').trim();
    var m = /\/(?:d|folders)\/([A-Za-z0-9_-]{10,})/.exec(t) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(t);
    return m ? m[1] : t;
  }

  function operatore() {
    var u = proprietaUtente();
    return {
      email: Posta.casella(),
      nome: u.getProperty(CHIAVI.FIRMATARIO_NOME) || '',
      firmaFileId: u.getProperty(CHIAVI.FIRMA_FILE_ID) || ''
    };
  }

  /** Nome e firma (immagine in base64) dell'operatore corrente; immagine vuota se non impostata o non leggibile. */
  function firma() {
    var op = operatore();
    var f = { nome: op.nome, immagine: '', errore: '' };
    if (op.firmaFileId) {
      try {
        var blob = DriveApp.getFileById(op.firmaFileId).getBlob();
        var tipo = blob.getContentType() || 'image/png';
        if (!/^image\//.test(tipo)) throw new Error('il file non è un\'immagine (' + tipo + ')');
        f.immagine = 'data:' + tipo + ';base64,' + Utilities.base64Encode(blob.getBytes());
      } catch (e) {
        f.errore = 'Firma non leggibile da Drive: ' + (e && e.message ? e.message : e);
      }
    }
    return f;
  }

  function impostaFirma(nome, fileIdOUrl) {
    var u = proprietaUtente();
    if (nome !== null && nome !== undefined) {
      if (nome === '-' || nome === '') u.deleteProperty(CHIAVI.FIRMATARIO_NOME);
      else u.setProperty(CHIAVI.FIRMATARIO_NOME, Testo.spazi(nome));
    }
    if (fileIdOUrl !== null && fileIdOUrl !== undefined) {
      var id = idDrive(fileIdOUrl);
      if (id === '-' || id === '') u.deleteProperty(CHIAVI.FIRMA_FILE_ID);
      else u.setProperty(CHIAVI.FIRMA_FILE_ID, id);
    }
    return firma();
  }

  /** Numero progressivo per anno (es. 2026/0012), sotto blocco condiviso tra le caselle. */
  function prossimoNumero(adesso) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var anno = Utilities.formatDate(adesso || new Date(), FUSO, 'yyyy');
      var m = /^(\d{4})\/(\d+)$/.exec(Impostazioni.leggi(CHIAVI.CONTRATTO_ULTIMO_NUMERO, ''));
      var n = m && m[1] === anno ? Number(m[2]) + 1 : 1;
      var cifre = String(n);
      var numero = anno + '/' + (cifre.length < 4 ? ('0000' + cifre).slice(-4) : cifre);
      Impostazioni.scrivi(CHIAVI.CONTRATTO_ULTIMO_NUMERO, numero);
      return numero;
    } finally {
      lock.releaseLock();
    }
  }

  /** Cartella dei contratti (creata accanto al Foglio se non impostata) e sottocartella dell'anno. */
  function cartella(anno) {
    var id = Impostazioni.leggi(CHIAVI.CONTRATTI_CARTELLA_ID, '');
    var radice = null;
    if (id) {
      try { radice = DriveApp.getFolderById(id); } catch (e) { radice = null; }
    }
    if (!radice) {
      var genitori = DriveApp.getFileById(Registro.documento().getId()).getParents();
      var base = genitori.hasNext() ? genitori.next() : DriveApp.getRootFolder();
      var esistenti = base.getFoldersByName(CONFIG.CONTRATTO.CARTELLA_DRIVE);
      radice = esistenti.hasNext() ? esistenti.next() : base.createFolder(CONFIG.CONTRATTO.CARTELLA_DRIVE);
      Impostazioni.scrivi(CHIAVI.CONTRATTI_CARTELLA_ID, radice.getId());
    }
    if (!anno) return radice;
    var sotto = radice.getFoldersByName(String(anno));
    return sotto.hasNext() ? sotto.next() : radice.createFolder(String(anno));
  }

  function impostaCartella(idOUrl) {
    var id = idDrive(idOUrl);
    var c = DriveApp.getFolderById(id); // errore se non accessibile
    Impostazioni.scrivi(CHIAVI.CONTRATTI_CARTELLA_ID, c.getId());
    return { id: c.getId(), nome: c.getName(), url: c.getUrl() };
  }

  function pulisciNome(s) {
    return Testo.rimuoviAccenti(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  /** Stessa convenzione dei preventivi già su Drive: Cognome_Contratto_Nome_AAAA-MM-GG */
  function nomeFile(dati, data) {
    var giorno = Utilities.formatDate(data, FUSO, 'yyyy-MM-dd');
    return [pulisciNome(dati.cliente.cognome) || 'Cliente', 'Contratto', pulisciNome(dati.cliente.nome) || 'Senza-nome', giorno].join('_');
  }

  function pdfDaHtml(html, nome) {
    return Utilities.newBlob(html, 'text/html', nome + '.html').getAs('application/pdf').setName(nome + '.pdf');
  }

  function foglio() {
    return Registro.foglio(CONFIG.FOGLI.CONTRATTI, INTESTAZIONI);
  }

  function bozzaEmail(dati, numero, pdf, sottotitolo, nomeOperatore) {
    if (!dati.cliente.email) return null;
    var c = CONFIG.CONTRATTO;
    var oggetto = 'Contratto di vendita n. ' + numero + ' - Migelino Italia';
    var corpo = 'Gentile ' + Testo.spazi((dati.cliente.titolo ? dati.cliente.titolo + ' ' : '') + dati.cliente.cognome) + ',\n\n' +
      'in allegato trova il contratto di vendita n. ' + numero + (sottotitolo ? ' (' + sottotitolo + ')' : '') + '.\n' +
      'La preghiamo di controllare i dati, firmare dove indicato e rispedircelo via email: va bene anche una foto leggibile delle due pagine.\n\n' +
      'Restiamo a disposizione per qualsiasi chiarimento.\n\nCordiali saluti\n' + (nomeOperatore ? nomeOperatore + '\n' : '') +
      'Migelino Italia\n' + c.SITO + ' | ' + c.EMAIL_SUPPORTO;
    var bozza = GmailApp.createDraft(dati.cliente.email, oggetto, corpo, { attachments: [pdf], name: 'Migelino Italia' });
    var idMessaggio = bozza.getMessageId ? bozza.getMessageId() : '';
    return { id: bozza.getId(), url: 'https://mail.google.com/mail/' + (Posta.casella() ? '?authuser=' + encodeURIComponent(Posta.casella()) : 'u/0/') + '#drafts' + (idMessaggio ? '/' + idMessaggio : '') };
  }

  /**
   * Genera il contratto: controlli, numero, PDF su Drive, riga nel foglio "Contratti",
   * bozza Gmail se opzioni.bozzaEmail. Restituisce { numero, pdfUrl, pdfNome, totale, bozzaUrl, avvisi }.
   * Con errori bloccanti lancia un Error con la proprietà `errori`.
   */
  function genera(datiGrezzi, opzioni) {
    opzioni = opzioni || {};
    var controllo = ContrattoControlli.valida(datiGrezzi);
    if (controllo.errori.length) {
      var errore = new Error('Contratto non generato. ' + controllo.errori.join('; '));
      errore.errori = controllo.errori;
      throw errore;
    }
    var dati = controllo.dati;
    var avvisi = controllo.avvisi.slice();
    var n = nucleo();
    var adesso = new Date();
    var f = firma();
    if (f.errore) avvisi.push(f.errore);
    if (!f.immagine) avvisi.push('Nessuna firma impostata per questo operatore: lo spazio "' + CONFIG.CONTRATTO.FIRMA_PER + '" resta da firmare a mano');
    var op = operatore();

    dati.numero = prossimoNumero(adesso);
    var html = n.html(dati, { firma: { nome: f.nome, immagine: f.immagine } });
    var nome = nomeFile(dati, adesso);
    var pdf = pdfDaHtml(html, nome);
    var file = cartella(Utilities.formatDate(adesso, FUSO, 'yyyy')).createFile(pdf);
    var calcolo = n.calcola(dati);
    var sottotitolo = dati.sottotitolo || n.sottotitoloProposto(dati);
    var esito = { numero: dati.numero, pdfUrl: file.getUrl(), pdfNome: file.getName(), totale: calcolo.totale, bozzaUrl: '', avvisi: avvisi };

    if (opzioni.bozzaEmail) {
      try {
        var b = bozzaEmail(dati, dati.numero, pdf, sottotitolo, f.nome || op.email);
        if (b) esito.bozzaUrl = b.url;
        else avvisi.push('Bozza email non creata: manca l\'email del cliente');
      } catch (e) {
        avvisi.push('Bozza email non creata: ' + (e && e.message ? e.message : e));
      }
    }

    foglio().appendRow([
      adesso, dati.numero, op.email, n.nomeCliente(dati), dati.cliente.email, dati.cliente.telefono,
      calcolo.totale, calcolo.pagamento.nome, esito.pdfUrl, dati.preventivo.numero, esito.bozzaUrl,
      'Generato', JSON.stringify(dati)
    ]);
    return esito;
  }

  /** Dati salvati nella riga selezionata del foglio "Contratti" (per riaprire un contratto), o null. */
  function riapriDaRigaAttiva() {
    var f = SpreadsheetApp.getActiveSheet();
    if (!f || f.getName() !== CONFIG.FOGLI.CONTRATTI) return null;
    var riga = f.getActiveRange() ? f.getActiveRange().getRow() : 0;
    if (riga < 2) return null;
    var colonna = INTESTAZIONI.indexOf('Dati') + 1;
    var testo = f.getRange(riga, colonna).getValue();
    try {
      var dati = JSON.parse(String(testo || ''));
      return dati && typeof dati === 'object' ? dati : null;
    } catch (e) {
      return null;
    }
  }

  return {
    INTESTAZIONI: INTESTAZIONI,
    operatore: operatore,
    firma: firma,
    impostaFirma: impostaFirma,
    prossimoNumero: prossimoNumero,
    cartella: cartella,
    impostaCartella: impostaCartella,
    nomeFile: nomeFile,
    pdfDaHtml: pdfDaHtml,
    genera: genera,
    riapriDaRigaAttiva: riapriDaRigaAttiva,
    idDrive: idDrive
  };
})();
