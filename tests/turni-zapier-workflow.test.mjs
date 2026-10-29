// Flusso completo di turni/zapier/workflow.ts su una Gmail in memoria (tests/_turni_zapier_finti.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GmailFinta, contesto, caricaWorkflow } from './_turni_zapier_finti.mjs';

const wf = await caricaWorkflow();

function ambiente() {
  const g = new GmailFinta();
  globalThis.__turni = g;
  const esegui = (record) => wf.run(contesto(), record);
  const a = () => g.inoltri.map((i) => [i.id, i.a.split('@')[0]]);
  return { g, esegui, a };
}

test('Conversazioni nuove una dopo l\'altra: Denis, Marco, Silvia, Denis; etichette e "➜ prossimo" aggiornati', async () => {
  const { g, esegui, a } = ambiente();
  for (const id of ['m1', 'm2', 'm3', 'm4']) await esegui(g.arriva(id, 't' + id, id + '@example.com'));
  assert.deepEqual(a(), [['m1', 'denis'], ['m2', 'marcoz'], ['m3', 'silvia'], ['m4', 'denis']]);
  assert.deepEqual(g.etichetteDi('m2'), ['Turno/Marco']);
  assert.ok(g.etichette.some((l) => l.name === 'Turno/➜ prossimo: Marco'));
  assert.ok(!g.etichette.some((l) => l.name.startsWith('Turno/🔒')), 'blocco rilasciato');
  assert.equal(g.inoltri[0].replyTo, 'm1@example.com');
  assert.equal(g.inoltri[0].nome, 'Cliente m1 via Support');
  assert.match(g.inoltri[0].nota, /Turno: Denis[\s\S]*Rif\. turno m1$/);
});

test('Tre conversazioni nuove nello stesso istante: una a testa, nessun collega due volte', async () => {
  const { g, esegui, a } = ambiente();
  const record = ['p1', 'p2', 'p3'].map((id) => g.arriva(id, 't' + id, id + '@example.com'));
  const ctx = record.map(() => contesto());
  await Promise.all(record.map((r, i) => wf.run(ctx[i], r)));
  assert.ok(ctx.some((c) => c.attese > 0), 'le esecuzioni si sono contese il blocco');
  assert.deepEqual(a().map((x) => x[1]).sort(), ['denis', 'marcoz', 'silvia']);
  assert.ok(g.etichette.some((l) => l.name === 'Turno/➜ prossimo: Denis'));
});

test('Due mail della stessa conversazione nuova nello stesso istante: stesso collega, la seconda come seguito', async () => {
  const { g, esegui, a } = ambiente();
  const r1 = g.arriva('s1', 'ts', 'cliente@example.com');
  const r2 = g.arriva('s2', 'ts', 'cliente@example.com');
  const ctx = [contesto(), contesto()];
  const esiti = await Promise.all([wf.run(ctx[0], r1), wf.run(ctx[1], r2)]);
  assert.ok(ctx.every((c) => c.nomi.includes('prendi-blocco-0')), 'entrambe hanno visto la conversazione come nuova');
  assert.deepEqual(a().map((x) => x[1]), ['denis', 'denis']);
  assert.deepEqual(esiti.map((e) => e.seguito).sort(), [false, true]);
  await esegui(g.arriva('n1', 'tn', 'altro@example.com'));
  assert.equal(a().at(-1)[1], 'marcoz', 'il giro è avanzato di uno solo');
});

test('Risposta del cliente giorni dopo: allo stesso collega, senza blocco e senza far avanzare il giro', async () => {
  const { g, esegui, a } = ambiente();
  await esegui(g.arriva('c1', 'tc', 'cliente@example.com'));
  const ctx = contesto();
  const esito = await wf.run(ctx, g.arriva('c2', 'tc', 'cliente@example.com'));
  assert.equal(esito.seguito, true);
  assert.ok(!ctx.nomi.some((n) => n.startsWith('prendi-blocco')));
  assert.match(g.inoltri.at(-1).nota, /già assegnata a te/);
  await esegui(g.arriva('d1', 'td', 'nuovo@example.com'));
  assert.deepEqual(a(), [['c1', 'denis'], ['c2', 'denis'], ['d1', 'marcoz']]);
});

test('Riassegnazione a mano (etichetta cambiata) e "➜ prossimo" rinominata a mano', async () => {
  const { g, esegui, a } = ambiente();
  await esegui(g.arriva('r1', 'tr', 'cliente@example.com'));
  const id = (n) => g.etichette.find((l) => l.name === n).id;
  const m = g.messaggi.find((x) => x.id === 'r1');
  m.labelIds = m.labelIds.filter((l) => l !== id('Turno/Denis')).concat(id('Turno/Silvia'));
  g.etichette.find((l) => l.name.startsWith('Turno/➜')).name = 'Turno/➜ prossimo: Silvia';
  await esegui(g.arriva('r2', 'tr', 'cliente@example.com'));
  await esegui(g.arriva('x1', 'tx', 'nuovo@example.com'));
  assert.deepEqual(a(), [['r1', 'denis'], ['r2', 'silvia'], ['x1', 'silvia']]);
  assert.ok(g.etichette.some((l) => l.name === 'Turno/➜ prossimo: Denis'));
});

test('Esclusi: la casella stessa, la squadra, le mail di errore; nessuna chiamata a Gmail', async () => {
  const { g, esegui, a } = ambiente();
  const esiti = [];
  for (const da of ['support@migelino.ch', 'Silvia@Migelino.it', 'mailer-daemon@googlemail.com']) esiti.push(await esegui(g.arriva('e' + esiti.length, 'te', da)));
  assert.deepEqual(esiti.map((e) => e.reason), ['inviata-dalla-casella', 'mittente-della-squadra', 'notifica-di-errore']);
  assert.equal(a().length, 0);
  assert.equal(g.etichette.length, 3, 'nessuna etichetta creata');
});

test('Collega già in copia: nessun inoltro doppio, ma la conversazione resta sua', async () => {
  const { g, esegui, a } = ambiente();
  const esito = await esegui(g.arriva('k1', 'tk', 'cliente@example.com', { cc: ['denis@migelino.it'] }));
  assert.equal(esito.gia_destinatario, true);
  assert.equal(a().length, 0);
  assert.deepEqual(g.etichetteDi('k1'), ['Turno/Denis']);
});

test('Allegati che non passano: secondo inoltro senza allegati, con avviso nella nota', async () => {
  const { g, esegui } = ambiente();
  g.fallisce = (inputs) => inputs.include_attachments === true;
  const esito = await esegui(g.arriva('f1', 'tf', 'cliente@example.com'));
  assert.equal(esito.senza_allegati, true);
  assert.equal(g.inoltri.length, 1);
  assert.equal(g.inoltri[0].allegati, false);
  assert.match(g.inoltri[0].nota, /allegati non si sono potuti inoltrare/);
});

test('Inoltro impossibile: etichetta ⛔, conversazione non assegnata, blocco rilasciato, esecuzione fallita', async () => {
  const { g, esegui, a } = ambiente();
  g.fallisce = () => true;
  await assert.rejects(esegui(g.arriva('z1', 'tz', 'cliente@example.com')), /inoltro rifiutato/);
  assert.deepEqual(g.etichetteDi('z1'), ['Turno/⛔ Non inoltrata']);
  assert.ok(!g.etichette.some((l) => l.name.startsWith('Turno/🔒')));
  // Rilancio dopo la correzione: arriva, e la ⛔ sparisce.
  g.fallisce = null;
  await esegui(g.arriva('z1b', 'tz2', 'altro@example.com'));
  assert.deepEqual(a(), [['z1b', 'marcoz']], 'il turno di Denis è stato consumato dalla mail non inoltrata');
});

test('Stesso record eseguito due volte: nessun secondo inoltro e niente "seguito"', async () => {
  const { g, esegui } = ambiente();
  const r = g.arriva('d1', 'td', 'cliente@example.com');
  await esegui(r);
  const secondo = await esegui(r);
  assert.equal(g.inoltri.length, 1);
  assert.equal(secondo.seguito, false);
  assert.equal(secondo.inoltrata_a, 'Denis');
});

test('Blocco lasciato da un\'esecuzione interrotta: dopo l\'attesa viene tolto e si procede', async () => {
  const { g, esegui, a } = ambiente();
  g.etichette.push({ id: 'Label_vecchio', name: 'Turno/🔒 assegnazione in corso' });
  const ctx = contesto();
  await wf.run(ctx, g.arriva('b1', 'tb', 'cliente@example.com'));
  assert.deepEqual(a(), [['b1', 'denis']]);
  assert.ok(ctx.nomi.includes('forza-blocco-abbandonato'));
  assert.equal(ctx.attese, 19);
  assert.ok(!g.etichette.some((l) => l.name.startsWith('Turno/🔒')));
});
