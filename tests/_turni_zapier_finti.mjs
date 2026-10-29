// Ambiente finto per eseguire turni/zapier/workflow.ts in Node: runtime durevole, SDK Zapier, zod
// e una Gmail in memoria. I pacchetti reali non servono: il caricatore li sostituisce con questi finti.
import { register } from 'node:module';

const stub = (codice) => 'data:text/javascript,' + encodeURIComponent(codice);
const MODULI = {
  '@zapier/zapier-durable': stub('export const defineDurable = (nome, run) => ({ nome, run });'),
  '@zapier/zapier-sdk': stub(`export const createZapierSdk = () => ({
    fetch: (...a) => globalThis.__turni.fetch(...a),
    createActionRun: (...a) => globalThis.__turni.createActionRun(...a),
    getActionRun: (...a) => globalThis.__turni.getActionRun(...a) });`),
  // zod minimo: lo schema accetta tutto (qui si prova il flusso, non la validazione).
  zod: stub(`const s = () => { const o = { parse: (v) => v }; for (const k of ['loose','nullable','optional']) o[k] = () => o; return o; };
    export const z = { object: s, string: s, array: s, boolean: s, unknown: s };`),
};
const caricatore = `const M = ${JSON.stringify(MODULI)};
export async function resolve(spec, ctx, next) { return M[spec] ? { url: M[spec], shortCircuit: true } : next(spec, ctx); }`;
register(stub(caricatore));

const pausa = () => new Promise((r) => setImmediate(r));

/** Gmail in memoria con le sole API usate dal workflow, più le esecuzioni d'azione di Zapier. */
export class GmailFinta {
  constructor() {
    this.etichette = [{ id: 'INBOX', name: 'INBOX' }, { id: 'SENT', name: 'SENT' }, { id: 'UNREAD', name: 'UNREAD' }];
    this.messaggi = [];
    this.inoltri = [];
    this.run = new Map();
    this.n = 0;
    // esitoInoltro(inputs) => 'ok' | 'attesa' | 'sconosciuto' | { errore } | { eccezione }
    this.esitoInoltro = () => 'ok';
    this.guasti = { bloccoCreatoMaRisposta502: 0, patch500: 0, deleteBlocco503: 0, ricerca503: 0, thread503: 0 };
  }
  arriva(id, threadId, da, { cc = [], allegati = 0 } = {}) {
    this.messaggi.push({ id, threadId, labelIds: ['INBOX', 'UNREAD'], testo: '', ordine: this.n++ });
    return { id, message_id: id, thread_id: threadId, subject: 'Oggetto ' + id, from: { name: 'Cliente ' + id, email: da },
      reply_to: { name: '', email: '' }, to: { emails: ['support@migelino.ch'] }, cc: { emails: cc }, labels: ['UNREAD', 'INBOX'],
      attachment_count: allegati };
  }
  id(nome) { return this.etichette.find((l) => l.name === nome)?.id; }
  nomeDi(id) { return this.etichette.find((l) => l.id === id)?.name; }
  etichetteDi(id) { return this.messaggi.find((m) => m.id === id).labelIds.map((l) => this.nomeDi(l)).filter((n) => n && n.startsWith('Turno')); }
  prossimo() { return this.etichette.filter((l) => l.name.startsWith('Turno/➜')).map((l) => l.name); }
  blocchi() { return this.etichette.filter((l) => l.name.startsWith('Turno/🔒')); }
  esiste(nome, tranne) { return this.etichette.some((l) => l.id !== tranne && l.name.toLowerCase() === nome.toLowerCase()); }

  async fetch(url, opzioni = {}) {
    await pausa();
    const u = new URL(url);
    const p = u.pathname.replace('/gmail/v1/users/me', '');
    const metodo = opzioni.method ?? 'GET';
    const corpo = opzioni.body ? JSON.parse(opzioni.body) : null;
    const r = (stato, dati) => ({ ok: stato < 300, status: stato, text: async () => (dati === undefined ? '' : JSON.stringify(dati)) });
    let m;
    if (p === '/labels' && metodo === 'GET') return r(200, { labels: this.etichette.map((l) => ({ ...l })) });
    if (p === '/labels' && metodo === 'POST') {
      if (this.esiste(corpo.name)) return r(409, { error: 'Label name exists or conflicts' });
      const l = { id: 'Label_' + this.n++, name: corpo.name };
      this.etichette.push(l);
      if (corpo.name.startsWith('Turno/🔒') && this.guasti.bloccoCreatoMaRisposta502 > 0) {
        this.guasti.bloccoCreatoMaRisposta502--;
        return r(502, { error: 'Bad gateway' }); // creata davvero, ma la risposta si perde
      }
      return r(200, l);
    }
    if ((m = /^\/labels\/([^/]+)$/.exec(p))) {
      const l = this.etichette.find((x) => x.id === m[1]);
      if (metodo === 'DELETE' && l && l.name.startsWith('Turno/🔒') && this.guasti.deleteBlocco503 > 0) {
        this.guasti.deleteBlocco503--;
        return r(503, { error: 'unavailable' });
      }
      if (!l) return r(404, { error: 'not found' });
      if (metodo === 'DELETE') {
        this.etichette = this.etichette.filter((x) => x !== l);
        this.messaggi.forEach((x) => { x.labelIds = x.labelIds.filter((id) => id !== l.id); });
        return r(204);
      }
      if (metodo === 'PATCH') {
        if (this.guasti.patch500 > 0) { this.guasti.patch500--; return r(500, { error: 'backend' }); }
        if (this.esiste(corpo.name, l.id)) return r(409, { error: 'conflict' });
        l.name = corpo.name;
        return r(200, l);
      }
      return r(200, l);
    }
    if ((m = /^\/threads\/([^/]+)$/.exec(p))) {
      if (this.guasti.thread503 > 0) { this.guasti.thread503--; return r(503, { error: 'unavailable' }); }
      const lista = this.messaggi.filter((x) => x.threadId === m[1]).sort((a, b) => a.ordine - b.ordine);
      return lista.length ? r(200, { messages: lista.map((x) => ({ id: x.id, labelIds: [...x.labelIds] })) }) : r(404, {});
    }
    if ((m = /^\/messages\/([^/]+)\/modify$/.exec(p))) {
      const x = this.messaggi.find((y) => y.id === m[1]);
      const tutti = [...(corpo.addLabelIds ?? []), ...(corpo.removeLabelIds ?? [])];
      if (tutti.some((id) => !id || !this.etichette.some((l) => l.id === id))) return r(400, { error: 'Invalid label' });
      x.labelIds = x.labelIds.filter((id) => !(corpo.removeLabelIds ?? []).includes(id));
      for (const id of corpo.addLabelIds ?? []) if (!x.labelIds.includes(id)) x.labelIds.push(id);
      return r(200, { id: x.id, labelIds: x.labelIds });
    }
    if ((m = /^\/messages\/([^/]+)$/.exec(p))) {
      const x = this.messaggi.find((y) => y.id === m[1]);
      return x ? r(200, { id: x.id, labelIds: [...x.labelIds] }) : r(404, {});
    }
    if (p === '/messages' && metodo === 'GET') {
      if (this.guasti.ricerca503 > 0) { this.guasti.ricerca503--; return r(503, { error: 'unavailable' }); }
      const cerca = /^in:sent "(.+)"$/.exec(u.searchParams.get('q'))[1];
      const trovati = this.messaggi.filter((x) => x.labelIds.includes('SENT') && x.testo.includes(cerca));
      return r(200, trovati.length ? { messages: [{ id: trovati[0].id }] } : { resultSizeEstimate: 0 });
    }
    throw new Error(`API Gmail non prevista nel test: ${metodo} ${p}`);
  }

  async createActionRun({ action, inputs }) {
    await pausa();
    if (action !== 'forward_email') throw new Error('azione non prevista: ' + action);
    const esito = this.esitoInoltro(inputs);
    if (esito?.eccezione) throw new Error(esito.eccezione);
    const id = 'run' + this.n++;
    this.run.set(id, { inputs, esito });
    if (esito === 'ok') this.invia(inputs);
    return { data: { id, implementation_id: 'GoogleMailV2CLIAPI@2.14.0' } };
  }

  async getActionRun({ run }) {
    await pausa();
    const { esito } = this.run.get(run);
    if (esito === 'attesa') return { data: { id: run, status: 'waiting', results: [], errors: [] } };
    if (esito === 'sconosciuto') return { data: { id: run, status: 'unknown', results: [], errors: [] } };
    if (esito?.errore) return { data: { id: run, status: 'error', results: [], errors: [{ code: 'x', title: 'Errore', detail: esito.errore }] } };
    return { data: { id: run, status: 'success', results: [{ id: 'fwd' }], errors: [] } };
  }

  invia(inputs) {
    const originale = this.messaggi.find((x) => x.id === inputs.message_id);
    this.messaggi.push({ id: 'fwd' + this.n++, threadId: 'f' + this.n, labelIds: ['SENT'], testo: inputs.additional_message, ordine: this.n++ });
    this.inoltri.push({ id: inputs.message_id, a: inputs.to[0], allegati: inputs.include_attachments, nota: inputs.additional_message,
      replyTo: inputs.reply_to, nome: inputs.from_name, thread: originale.threadId });
  }
}

/**
 * Contesto durevole finto: passi memorizzati per nome con i tentativi del runtime reale (5 se non indicati),
 * attese che lasciano girare le altre esecuzioni. "sezione" conta quante esecuzioni sono tra scegli-turno
 * e rilascia-blocco nello stesso momento (deve restare 1).
 */
export function contesto(sezione = { dentro: 0, massimo: 0 }) {
  const passi = new Map();
  const ctx = {
    nomi: [],
    attese: 0,
    async step(a, b) {
      const { name, run, maxAttempts = 5 } = typeof a === 'string' ? { name: a, run: b } : a;
      if (passi.has(name)) throw new Error('passo ripetuto con lo stesso nome: ' + name);
      ctx.nomi.push(name);
      if (name === 'scegli-turno') { sezione.dentro++; sezione.massimo = Math.max(sezione.massimo, sezione.dentro); }
      if (name === 'rilascia-blocco') sezione.dentro--;
      let errore;
      for (let i = 0; i < maxAttempts; i++) {
        try { const v = await run(); passi.set(name, v); return v; } catch (e) { errore = e; await pausa(); }
      }
      const esaurito = new Error(`Step "${name}" exhausted`);
      esaurito.cause = errore;
      throw esaurito;
    },
    async wait(nome) { ctx.attese++; ctx.nomi.push(nome); for (let i = 0; i < 20; i++) await pausa(); },
  };
  return ctx;
}

export async function caricaWorkflow() {
  return (await import('../turni/zapier/workflow.ts')).default;
}
