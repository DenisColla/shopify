// Test dei turni della casella condivisa (turni/Turni.gs). Indirizzi e mail inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { ProprietaFinte } from './_ambiente.mjs';

const radice = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sorgente = readFileSync(path.join(radice, 'turni', 'Turni.gs'), 'utf8');
const CASELLA = 'info@migelino.it';
const SQUADRA = [
  { nome: 'Denis', email: 'denis@migelino.it' },
  { nome: 'Marco', email: 'marco@migelino.it' },
  { nome: 'Silvia', email: 'silvia@migelino.it' }
];

class Messaggio {
  constructor(id, da, dataMs, rispondiA = '') { Object.assign(this, { id, da, dataMs, rispondiA, thread: null }); }
  getId() { return this.id; }
  getFrom() { return this.da; }
  getReplyTo() { return this.rispondiA; }
  getDate() { return new Date(this.dataMs); }
  getSubject() { return 'Oggetto ' + this.id; }
  getThread() { return this.thread; }
  isInTrash() { return false; }
  forward(a, opzioni) { this.thread.gmail.inoltra(this, a, opzioni); }
}

class Conversazione {
  constructor(gmail, id) { Object.assign(this, { gmail, id, messaggi: [], etichette: new Set() }); }
  getId() { return this.id; }
  getMessages() { return this.messaggi; }
  getLabels() { return [...this.etichette].map((n) => ({ getName: () => n })); }
  addLabel(l) { this.etichette.add(l.getName()); return this; }
  removeLabel(l) { this.etichette.delete(l.getName()); return this; }
}

function ambiente({ squadra = SQUADRA, opzioni = {} } = {}) {
  let adesso = Date.parse('2026-10-29T09:00:00Z');
  const proprieta = new ProprietaFinte();
  const conversazioni = [];
  const inoltri = [];
  const trigger = [];
  const ricerche = [];
  const gmail = {
    fallisce: null, // (messaggio, destinatario) => true per simulare un errore di Gmail
    inoltra(m, a, opz) {
      if (this.fallisce && this.fallisce(m, a)) throw new Error('errore Gmail');
      inoltri.push({ id: m.id, a, replyTo: opz.replyTo });
    }
  };
  const ctx = {
    console: { error: () => {}, log: () => {} },
    Logger: { log: () => {} },
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [adesso])); } static now() { return adesso; } },
    PropertiesService: { getScriptProperties: () => proprieta },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => CASELLA }), getScriptTimeZone: () => 'Europe/Rome' },
    Utilities: { formatDate: (d) => d.toISOString() },
    GmailApp: {
      search: (q, inizio, quanti) => {
        ricerche.push(q);
        const dopoMs = Number(/after:(\d+)/.exec(q)[1]) * 1000;
        const trovate = conversazioni.filter((c) => c.messaggi.some((m) => m.dataMs > dopoMs))
          .sort((x, y) => Math.max(...y.messaggi.map((m) => m.dataMs)) - Math.max(...x.messaggi.map((m) => m.dataMs)));
        return trovate.slice(inizio, inizio + quanti);
      },
      getUserLabelByName: () => null,
      createLabel: (nome) => ({ getName: () => nome })
    },
    ScriptApp: {
      getProjectTriggers: () => trigger.slice(),
      deleteTrigger: (t) => trigger.splice(trigger.indexOf(t), 1),
      newTrigger: (funzione) => ({
        timeBased: () => ({ everyMinutes: (minuti) => ({ create: () => trigger.push({ getHandlerFunction: () => funzione, minuti }) }) })
      })
    }
  };
  vm.createContext(ctx);
  vm.runInContext(sorgente, ctx, { filename: 'Turni.gs' });
  ctx.TURNI.SQUADRA = squadra;
  Object.assign(ctx.TURNI, opzioni);

  return {
    ctx, proprieta, inoltri, trigger, ricerche, gmail, conversazioni,
    passano: (minuti) => { adesso += minuti * 60000; },
    /** Nuova mail (nuova conversazione o risposta in una esistente) arrivata "adesso". */
    arriva(idConv, idMsg, da, rispondiA) {
      let c = conversazioni.find((x) => x.id === idConv);
      if (!c) { c = new Conversazione(gmail, idConv); conversazioni.push(c); }
      const m = new Messaggio(idMsg, da, adesso, rispondiA);
      m.thread = c;
      c.messaggi.push(m);
      return c;
    }
  };
}

const destinatari = (a) => a.inoltri.map((i) => i.a.split('@')[0]);

test('Installazione: rifiuta indirizzi da compilare, crea un solo controllo anche se rieseguita', () => {
  const vuota = ambiente({ squadra: [{ nome: 'Marco', email: 'DA_COMPILARE' }] });
  assert.throws(() => vuota.ctx.installaTurni(), /Indirizzo non valido per Marco/);
  assert.equal(vuota.trigger.length, 0);

  const a = ambiente();
  a.ctx.installaTurni();
  a.ctx.installaTurni();
  assert.equal(a.trigger.length, 1);
  assert.equal(a.trigger[0].getHandlerFunction(), 'controllaTurni');
  assert.equal(a.trigger[0].minuti, 1);
});

test('Nuove conversazioni a giro Denis, Marco, Silvia, Denis; risposta al cliente; etichetta di turno', () => {
  const a = ambiente();
  a.arriva('vecchia', 'v1', 'Prima <prima@example.com>'); // arrivata prima dell'installazione: ignorata
  a.passano(1);
  a.ctx.installaTurni();
  ['c1', 'c2', 'c3', 'c4'].forEach((c, i) => { a.passano(1); a.arriva(c, c + '-1', `Cliente ${i} <cliente${i}@example.com>`); });
  a.arriva('form', 'form-1', 'Shopify <mailer@shopify.com>', 'cliente.form@example.com');
  a.passano(1);
  a.ctx.controllaTurni();

  assert.deepEqual(destinatari(a), ['denis', 'marco', 'silvia', 'denis', 'marco']);
  assert.equal(a.inoltri[0].replyTo, 'Cliente 0 <cliente0@example.com>');
  assert.equal(a.inoltri[4].replyTo, 'cliente.form@example.com', 'vale il Reply-To del modulo, non il mittente');
  assert.deepEqual([...a.conversazioni.find((c) => c.id === 'c2').etichette], ['Turno/Marco']);
  assert.deepEqual([...a.conversazioni.find((c) => c.id === 'vecchia').etichette], []);
});

test('Le risposte nella stessa conversazione vanno allo stesso collega e non fanno avanzare il giro', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  a.passano(1); a.arriva('c1', 'c1-1', 'uno@example.com');
  a.passano(1); a.arriva('c2', 'c2-1', 'due@example.com');
  a.ctx.controllaTurni();
  a.passano(5); a.arriva('c1', 'c1-2', 'uno@example.com'); // risposta del cliente a Denis
  a.arriva('c1', 'c1-3', 'uno@example.com');
  a.passano(1); a.arriva('c3', 'c3-1', 'tre@example.com');
  a.ctx.controllaTurni();
  assert.deepEqual(destinatari(a), ['denis', 'marco', 'denis', 'denis', 'silvia']);
});

test('Riassegnazione a mano: cambiando l\'etichetta le risposte seguono il nuovo collega', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  a.passano(1); const c = a.arriva('c1', 'c1-1', 'uno@example.com');
  a.ctx.controllaTurni();
  c.etichette.clear(); c.etichette.add('Turno/Silvia');
  a.passano(3); a.arriva('c1', 'c1-2', 'uno@example.com');
  a.ctx.controllaTurni();
  assert.deepEqual(destinatari(a), ['denis', 'silvia']);
});

test('Turno puro (STESSA_PERSONA_PER_CONVERSAZIONE = false): ogni mail al collega successivo', () => {
  const a = ambiente({ opzioni: { STESSA_PERSONA_PER_CONVERSAZIONE: false } });
  a.ctx.installaTurni();
  a.passano(1); a.arriva('c1', 'c1-1', 'uno@example.com');
  a.passano(1); a.arriva('c1', 'c1-2', 'uno@example.com');
  a.passano(1); a.arriva('c1', 'c1-3', 'uno@example.com');
  a.ctx.controllaTurni();
  assert.deepEqual(destinatari(a), ['denis', 'marco', 'silvia']);
});

test('Mai inoltrate: mail della casella stessa, dei colleghi del giro, di errore', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  a.passano(1);
  a.arriva('c1', 'c1-1', 'uno@example.com');
  a.arriva('c1', 'c1-2', 'Info <info@migelino.it>');           // inoltro o risposta della casella condivisa
  a.arriva('c2', 'c2-1', 'Marco <MARCO@migelino.it>');         // collega in copia o risposta automatica
  a.arriva('c3', 'c3-1', 'Mail Delivery <mailer-daemon@googlemail.com>');
  a.arriva('c4', 'c4-1', 'Collega <altro@migelino.it>');       // altro collega fuori dal giro: è un'informazione, va inoltrata
  a.ctx.controllaTurni();
  assert.deepEqual(a.inoltri.map((i) => [i.id, i.a.split('@')[0]]), [['c1-1', 'denis'], ['c4-1', 'marco']]);
});

test('Nessun doppione tra un controllo e l\'altro; la memoria delle mail viste resta piccola', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  a.passano(1); a.arriva('c1', 'c1-1', 'uno@example.com');
  a.ctx.controllaTurni();
  a.ctx.controllaTurni();
  a.passano(1); a.ctx.controllaTurni();
  assert.equal(a.inoltri.length, 1);
  assert.match(a.ricerche.at(-1), /^in:inbox -in:chats after:\d+$/);
  a.passano(180); // dopo il margine di un'ora la mail esce dalla finestra e dalla memoria
  a.ctx.controllaTurni();
  a.passano(1); a.ctx.controllaTurni();
  assert.equal(a.inoltri.length, 1);
  assert.deepEqual(JSON.parse(a.proprieta.getProperty('TURNI_VISTI')), {});
});

test('Errore temporaneo di Gmail: riprova al controllo dopo, senza saltare nessuno nel giro', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  a.passano(1); a.arriva('c1', 'c1-1', 'uno@example.com');
  a.passano(1); a.arriva('c2', 'c2-1', 'due@example.com');
  a.gmail.fallisce = () => true;
  a.ctx.controllaTurni();
  assert.equal(a.inoltri.length, 0);
  a.gmail.fallisce = null;
  a.passano(1); a.ctx.controllaTurni();
  assert.deepEqual(a.inoltri.map((i) => [i.id, i.a.split('@')[0]]), [['c1-1', 'denis'], ['c2-1', 'marco']]);
  assert.deepEqual(JSON.parse(a.proprieta.getProperty('TURNI_ERRORI')), {});
});

test('Mail che non si riesce mai a inoltrare: dopo 3 tentativi etichetta "Non inoltrata" e il giro prosegue', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  a.passano(1); const bloccata = a.arriva('c1', 'c1-1', 'uno@example.com');
  a.gmail.fallisce = (m) => m.id === 'c1-1';
  for (let i = 0; i < 3; i++) { a.passano(1); a.ctx.controllaTurni(); }
  assert.ok(bloccata.etichette.has('Turno/⛔ Non inoltrata'));
  a.passano(1); a.arriva('c2', 'c2-1', 'due@example.com');
  a.ctx.controllaTurni();
  a.passano(1); a.ctx.controllaTurni();
  assert.deepEqual(a.inoltri.map((i) => [i.id, i.a.split('@')[0]]), [['c2-1', 'denis']]);
  assert.ok(Number(a.proprieta.getProperty('TURNI_ULTIMO')) > 0, 'il controllo torna a completarsi');
});

test('Molte mail insieme: oltre il limite per esecuzione il resto passa al controllo dopo, nell\'ordine di arrivo', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  for (let i = 0; i < 55; i++) { a.passano(0.5); a.arriva('c' + i, 'm' + i, `c${i}@example.com`); }
  a.ctx.controllaTurni();
  assert.equal(a.inoltri.length, 40);
  a.passano(1); a.ctx.controllaTurni();
  assert.equal(a.inoltri.length, 55);
  assert.deepEqual(a.inoltri.map((i) => i.id), Array.from({ length: 55 }, (_, i) => 'm' + i));
  const conteggio = destinatari(a).reduce((t, d) => ({ ...t, [d]: (t[d] || 0) + 1 }), {});
  assert.deepEqual(conteggio, { denis: 19, marco: 18, silvia: 18 });
});

test('Disinstallazione: niente controllo e, reinstallando, niente arretrati; il giro continua', () => {
  const a = ambiente();
  a.ctx.installaTurni();
  a.passano(1); a.arriva('c1', 'c1-1', 'uno@example.com');
  a.ctx.controllaTurni();
  a.ctx.disinstallaTurni();
  assert.equal(a.trigger.length, 0);
  a.passano(10); a.arriva('c2', 'c2-1', 'due@example.com'); // arrivata a controllo spento
  a.passano(1); a.ctx.installaTurni();
  a.passano(1); a.arriva('c3', 'c3-1', 'tre@example.com');
  a.ctx.controllaTurni();
  assert.deepEqual(a.inoltri.map((i) => [i.id, i.a.split('@')[0]]), [['c1-1', 'denis'], ['c3-1', 'marco']]);
});
