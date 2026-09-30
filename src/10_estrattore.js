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

  return { estrai: estrai, contenuti: contenuti, SCHEMA: SCHEMA, SISTEMA: SISTEMA, FONTI: FONTI };
})();
