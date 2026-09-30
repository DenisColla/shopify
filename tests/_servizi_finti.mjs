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
  return {
    fogli,
    SpreadsheetApp: { getActiveSpreadsheet: () => documento, openById: () => documento }
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
 */
export function shopifyFinto(opzioni = {}) {
  const operazioni = [];
  const errori = { ...(opzioni.errori || {}) };
  function risposta(url, parametri) {
    if (url.endsWith('/admin/oauth/access_token')) {
      return { codice: 200, corpo: { access_token: 'token-finto', scope: 'read_customers,write_customers', expires_in: 86399 } };
    }
    const { query, variables } = JSON.parse(parametri.payload);
    const nome = /(?:query|mutation)\s+(\w+)/.exec(query)[1];
    operazioni.push({ nome, variables, token: parametri.headers['X-Shopify-Access-Token'] });
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
      case 'Negozio': return { codice: 200, corpo: { data: { shop: { name: 'Negozio finto', myshopifyDomain: 'negozio-finto.myshopify.com' } } } };
      default: throw new Error('operazione Shopify non prevista: ' + nome);
    }
  }
  return { operazioni, risposta };
}
