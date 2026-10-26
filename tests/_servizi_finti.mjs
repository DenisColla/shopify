// Finti servizi Google (Gmail, Fogli, Lock) e finte API (Claude, Shopify) per i test.
// Tutti i dati sono inventati.

export class AllegatoFinto {
  constructor(nome, tipo, byte = 50000) { this.nome = nome; this.tipo = tipo; this.byte = byte; }
  getName() { return this.nome; }
  getContentType() { return this.tipo; }
  getSize() { return this.byte; }
  getBytes() { return Buffer.from('contenuto-finto-' + this.nome); }
}

export class MessaggioFinto {
  constructor({ id, da, a = 'info@migelino.it', data, oggetto = 'Re: Preventivo', corpo = '', allegati = [], inLinea = [] }) {
    Object.assign(this, { id, da, a, data: new Date(data), oggetto, corpo, allegati, inLinea });
    this.thread = null;
  }
  getId() { return this.id; }
  getThread() { return this.thread; }
  getFrom() { return this.da; }
  getTo() { return this.a; }
  getDate() { return this.data; }
  getSubject() { return this.oggetto; }
  getPlainBody() { return this.corpo; }
  isInTrash() { return false; }
  getAttachments(opzioni = {}) {
    const normali = opzioni.includeAttachments === false ? [] : this.allegati;
    const linea = opzioni.includeInlineImages ? this.inLinea : [];
    return [...normali, ...linea];
  }
}

export class ThreadFinto {
  constructor(id, messaggi) {
    this.id = id;
    this.messaggi = messaggi;
    this.etichette = new Set();
    messaggi.forEach((m) => { m.thread = this; });
  }
  getId() { return this.id; }
  getMessages() { return this.messaggi; }
  getFirstMessageSubject() { return this.messaggi[0].oggetto; }
  addLabel(l) { this.etichette.add(l.getName()); return this; }
  removeLabel(l) { this.etichette.delete(l.getName()); return this; }
}

/** Gmail finta: le ricerche vengono risolte guardando gli indirizzi nella query. */
export function gmailFinta(threads) {
  const etichette = new Map();
  const etichetta = (nome) => {
    if (!etichette.has(nome)) {
      etichette.set(nome, { getName: () => nome, getThreads: () => threads.filter((t) => t.etichette.has(nome)) });
    }
    return etichette.get(nome);
  };
  const coinvolge = (t, email) => t.getMessages().some((m) => m.getFrom().toLowerCase().includes(email) || m.getTo().toLowerCase().includes(email));
  return {
    etichetta,
    GmailApp: {
      search: (q) => {
        const relazione = /^to:(\S+) \(from:me/.exec(q);
        if (relazione) {
          return threads.filter((t) => t.getMessages().some((m) => m.getTo().toLowerCase().includes(relazione[1]) && /migelino/.test(m.getFrom())));
        }
        const paziente = /^\(from:(\S+) OR/.exec(q);
        if (paziente) return threads.filter((t) => coinvolge(t, paziente[1]));
        return threads.slice();
      },
      getThreadById: (id) => threads.find((t) => t.getId() === id),
      getUserLabelByName: (nome) => (etichette.has(nome) ? etichette.get(nome) : null),
      createLabel: (nome) => etichetta(nome),
      getMessageById: (id) => threads.flatMap((t) => t.getMessages()).find((m) => m.getId() === id)
    }
  };
}

/** Fogli Google finto: registra le righe aggiunte. */
export function fogliFinti() {
  const fogli = new Map();
  const foglio = (nome) => {
    if (!fogli.has(nome)) {
      const righe = [];
      fogli.set(nome, {
        righe,
        appendRow: (r) => righe.push(r),
        getRange: () => ({ setValues: (v) => { v.forEach((r) => righe.push(r)); return { setFontWeight: () => {} }; }, setFontWeight: () => {}, setValue: () => {} }),
        setFrozenRows: () => {},
        clearContents: () => { righe.length = 0; },
        getDataRange: () => ({ getValues: () => righe })
      });
    }
    return fogli.get(nome);
  };
  const documento = {
    getId: () => 'foglio-finto',
    getSheetByName: (n) => (fogli.has(n) ? fogli.get(n) : null),
    insertSheet: (n) => foglio(n)
  };
  // Foglio attivo e riga selezionata (per "Riapri il contratto della riga selezionata").
  const attivo = { nome: '', riga: 0 };
  const fogliAttivo = () => ({
    getName: () => attivo.nome,
    getActiveRange: () => (attivo.riga ? { getRow: () => attivo.riga } : null),
    getRange: (r, c) => ({ getValue: () => { const f = fogli.get(attivo.nome); return f && f.righe[r - 1] ? f.righe[r - 1][c - 1] : ''; } })
  });
  return {
    fogli,
    attivo,
    SpreadsheetApp: { getActiveSpreadsheet: () => documento, openById: () => documento, getActiveSheet: fogliAttivo }
  };
}

const lockFinto = () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} });

/** Servizi di base; "casella" = account su cui gira lo script. */
export function serviziBase(casella = 'operatore@example.com') {
  return {
    LockService: { getScriptLock: lockFinto, getUserLock: lockFinto },
    Session: { getScriptTimeZone: () => 'Europe/Rome', getEffectiveUser: () => ({ getEmail: () => casella }) }
  };
}

export const SERVIZI_BASE = serviziBase();

export const PROPRIETA_BASE = {
  ANTHROPIC_API_KEY: 'chiave-finta',
  CLAUDE_MODEL: 'modello-finto',
  SHOPIFY_SHOP: 'negozio-finto.myshopify.com',
  SHOPIFY_CLIENT_ID: 'id-finto',
  SHOPIFY_CLIENT_SECRET: 'segreto-finto'
};

/** Risposta API Claude con blocco di pensiero (vuoto) e JSON nel blocco di testo. */
export function rispostaClaude(dati, stop = 'end_turn') {
  return {
    codice: 200,
    corpo: {
      id: 'msg_finto', model: 'modello-finto', stop_reason: stop,
      content: [{ type: 'thinking', thinking: '', signature: 'x' }, { type: 'text', text: JSON.stringify(dati) }],
      usage: { input_tokens: 100, output_tokens: 50 }
    }
  };
}

/**
 * API Shopify finta: registra le operazioni GraphQL.
 * opzioni.clienti: clienti già esistenti (nodi GraphQL)
 * opzioni.errori: { nomeOperazione: [userErrors] } restituiti alla prima chiamata
 * opzioni.tokenValidi: token accettati dalle API (predefinito: quelli emessi dalla finta richiesta del token)
 * opzioni.rifiutaTokenUnaVolta: la prima chiamata GraphQL risponde 401 (token scaduto o revocato)
 * opzioni.rispostaToken: risposta della richiesta del token ({ codice, corpo })
 * opzioni.permessi: permessi dell'app installata
 * opzioni.datiProtettiNegati: la lettura dei campi protetti dei clienti restituisce un errore
 */
export function shopifyFinto(opzioni = {}) {
  const operazioni = [];
  const tokenEmessi = [];
  const errori = { ...(opzioni.errori || {}) };
  let rifiuta = Boolean(opzioni.rifiutaTokenUnaVolta);
  function risposta(url, parametri) {
    if (url.endsWith('/admin/oauth/access_token')) {
      if (opzioni.rispostaToken) return opzioni.rispostaToken;
      const t = 'token-finto' + (tokenEmessi.length ? '-' + tokenEmessi.length : '');
      tokenEmessi.push(t);
      return { codice: 200, corpo: { access_token: t, scope: 'read_customers,write_customers', expires_in: 86399 } };
    }
    const { query, variables } = JSON.parse(parametri.payload);
    const nome = /(?:query|mutation)\s+(\w+)/.exec(query)[1];
    const token = parametri.headers['X-Shopify-Access-Token'];
    operazioni.push({ nome, variables, token });
    const validi = opzioni.tokenValidi || tokenEmessi;
    if (rifiuta || !validi.includes(token)) {
      rifiuta = false;
      return { codice: 401, corpo: { errors: '[API] Invalid API key or access token (unrecognized login or wrong password)' } };
    }
    const erroreUnaVolta = errori[nome];
    if (erroreUnaVolta) delete errori[nome];
    const ue = erroreUnaVolta || [];
    switch (nome) {
      case 'CercaClienti': {
        const clienti = typeof opzioni.clienti === 'function' ? opzioni.clienti(operazioni) : opzioni.clienti || [];
        return { codice: 200, corpo: { data: { customers: { nodes: clienti } } } };
      }
      case 'CreaCliente': return { codice: 200, corpo: { data: { customerCreate: { customer: ue.length ? null : { id: 'gid://shopify/Customer/777' }, userErrors: ue } } } };
      case 'AggiornaCliente': return { codice: 200, corpo: { data: { customerUpdate: { customer: { id: variables.input.id }, userErrors: ue } } } };
      case 'CreaIndirizzo': return { codice: 200, corpo: { data: { customerAddressCreate: { address: ue.length ? null : { id: 'gid://shopify/MailingAddress/' + operazioni.length }, userErrors: ue } } } };
      case 'AggiornaIndirizzo': return { codice: 200, corpo: { data: { customerAddressUpdate: { address: { id: variables.addressId }, userErrors: ue } } } };
      case 'AggiungiTag': return { codice: 200, corpo: { data: { tagsAdd: { node: { id: variables.id }, userErrors: [] } } } };
      case 'EliminaCliente': return { codice: 200, corpo: { data: { customerDelete: { deletedCustomerId: variables.input.id, userErrors: [] } } } };
      case 'Negozio': return { codice: 200, corpo: { data: {
        shop: { name: 'Negozio finto', myshopifyDomain: 'negozio-finto.myshopify.com' },
        currentAppInstallation: { accessScopes: (opzioni.permessi || ['read_customers', 'write_customers']).map((handle) => ({ handle })) }
      } } };
      case 'ProvaClienti': return opzioni.datiProtettiNegati
        ? { codice: 200, corpo: { data: { customers: { nodes: [{ id: 'gid://shopify/Customer/1', firstName: null }] } },
          errors: [{ message: 'This app is not approved to access the Customer object.', path: ['customers', 'nodes', 0, 'firstName'] }] } }
        : { codice: 200, corpo: { data: { customers: { nodes: [] } } } };
      default: throw new Error('operazione Shopify non prevista: ' + nome);
    }
  }
  return { operazioni, risposta };
}

// ------------------------------------------------------------- contratti
/** Drive finto: cartelle e file in memoria. opzioni.immagini = { fileId: { tipo, byte } } per le firme. */
export function driveFinto(opzioni = {}) {
  const file = new Map();
  const cartelle = new Map();
  let contatore = 0;
  const nuovoId = (prefisso) => prefisso + '-' + (++contatore);
  function blobFinto(nome, tipo, byte) {
    return {
      getName: () => nome, getContentType: () => tipo, getBytes: () => byte,
      setName(n) { nome = n; return this; },
      getAs: (t) => blobFinto(nome.replace(/\.html$/, '.pdf'), t, Buffer.from('%PDF-finto ' + byte.toString())),
      getDataAsString: () => byte.toString()
    };
  }
  function cartella(id, nome, genitore) {
    const sotto = new Map();
    const c = {
      getId: () => id, getName: () => nome, getUrl: () => 'https://drive.google.com/drive/folders/' + id,
      getFoldersByName: (n) => iteratore(sotto.has(n) ? [sotto.get(n)] : []),
      createFolder: (n) => { const f = cartella(nuovoId('cartella'), n, c); sotto.set(n, f); cartelle.set(f.getId(), f); return f; },
      createFile: (blob) => {
        const id = nuovoId('file');
        const f = { id, nome: blob.getName(), tipo: blob.getContentType(), byte: blob.getBytes(), cartella: c,
          getId: () => id, getName: () => blob.getName(), getUrl: () => 'https://drive.google.com/file/d/' + id + '/view', getBlob: () => blob };
        file.set(id, f);
        return f;
      },
      getParents: () => iteratore(genitore ? [genitore] : [])
    };
    return c;
  }
  const iteratore = (lista) => { let i = 0; return { hasNext: () => i < lista.length, next: () => lista[i++] }; };
  const radice = cartella('radice', 'Il mio Drive', null);
  cartelle.set('radice', radice);
  const cartellaFoglio = radice.createFolder('Gestionale');
  const foglio = { getId: () => 'foglio-finto', getParents: () => iteratore([cartellaFoglio]) };
  Object.entries(opzioni.immagini || {}).forEach(([id, img]) => {
    file.set(id, { getId: () => id, getName: () => id + '.png', getBlob: () => blobFinto(id + '.png', img.tipo || 'image/png', img.byte || Buffer.from('png-finto')) });
  });
  return {
    file, cartelle, cartellaFoglio,
    DriveApp: {
      getRootFolder: () => radice,
      getFolderById: (id) => { if (!cartelle.has(id)) throw new Error('Cartella non trovata: ' + id); return cartelle.get(id); },
      getFileById: (id) => {
        if (id === 'foglio-finto') return foglio;
        if (!file.has(id)) throw new Error('File non trovato: ' + id);
        return file.get(id);
      }
    },
    Utilities: {
      newBlob: (contenuto, tipo, nome) => blobFinto(nome || 'blob', tipo, Buffer.from(String(contenuto)))
    }
  };
}

/** HtmlService finto: valuta gli scriptlet <?!= espr ?> e <?= espr ?> con le variabili assegnate al template. */
export function htmlServiceFinto() {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return {
    HtmlService: {
      createTemplate: (sorgente) => {
        const t = {
          evaluate() {
            const html = sorgente.replace(/<\?(!?)=\s*([\s\S]*?)\s*\?>/g, (m, grezzo, espr) => {
              const valore = new Function('t', 'with (t) { return (' + espr + '); }')(t);
              return grezzo ? String(valore) : esc(valore);
            });
            const uscita = { html, titolo: '', larghezza: 0, altezza: 0,
              setTitle(x) { this.titolo = x; return this; }, setWidth(x) { this.larghezza = x; return this; },
              setHeight(x) { this.altezza = x; return this; }, getContent: () => html };
            return uscita;
          }
        };
        return t;
      }
    }
  };
}

/** Gmail finta minima per le bozze dei contratti. */
export function bozzeGmailFinte() {
  const bozze = [];
  return {
    bozze,
    GmailApp: {
      createDraft: (a, oggetto, corpo, opzioni) => {
        const id = 'bozza-' + (bozze.length + 1);
        bozze.push({ a, oggetto, corpo, opzioni });
        return { getId: () => id, getMessageId: () => 'msg-' + id };
      }
    }
  };
}
