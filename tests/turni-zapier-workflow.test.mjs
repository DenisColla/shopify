// Flusso completo di turni/zapier/workflow.ts su una Gmail in memoria (tests/_turni_zapier_finti.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GmailFinta, contesto, caricaWorkflow } from './_turni_zapier_finti.mjs';

const wf = await caricaWorkflow();

function ambiente() {
  const g = new GmailFinta();
  globalThis.__turni = g;
  const sezione = { dentro: 0, massimo: 0 };
  const esegui = (record, ctx = contesto(sezione)) => wf.run(ctx, record);
  const a = () => g.inoltri.map((i) => [i.id, i.a.split('@')[0]]);
  const conta = () => g.inoltri.reduce((c, i) => ({ ...c, [i.a.split('@')[0]]: (c[i.a.split('@')[0]] ?? 0) + 1 }), {});
  return { g, esegui, a, conta, sezione };
}

test('Conversazioni nuove una dopo l\'altra: Denis, Marco, Silvia, Denis; etichette e "➜ prossimo" aggiornati', async () => {
  const { g, esegui, a } = ambiente();
  for (const id of ['m1', 'm2', 'm3', 'm4']) await esegui(g.arriva(id, 't' + id, id + '@example.com'));
  assert.deepEqual(a(), [['m1', 'denis'], ['m2', 'marcoz'], ['m3', 'silvia'], ['m4', 'denis']]);
  assert.deepEqual(g.etichetteDi('m2'), ['Turno/Marco']);
  assert.deepEqual(g.prossimo(), ['Turno/➜ prossimo: Marco']);
  assert.equal(g.blocchi().length, 0, 'blocco rilasciato');
  assert.equal(g.inoltri[0].replyTo, 'm1@example.com');
  assert.equal(g.inoltri[0].nome, 'Cliente m1 via Support');
  assert.equal(g.inoltri[0].allegati, true);
  assert.match(g.inoltri[0].nota, /^Turno: Denis[\s\S]*Rif\. turno m1$/);
});

test('Sette conversazioni nuove nello stesso istante: una sola assegnazione alla volta, giro equilibrato', async () => {
  const { g, esegui, conta, sezione } = ambiente();
  const record = Array.from({ length: 7 }, (_, i) => g.arriva('p' + i, 'tp' + i, `p${i}@example.com`));
  const ctx = record.map(() => contesto(sezione));
  await Promise.all(record.map((r, i) => esegui(r, ctx[i])));
  assert.ok(ctx.some((c) => c.attese > 0), 'le esecuzioni si sono contese il blocco');
  assert.equal(sezione.massimo, 1);
  assert.deepEqual(conta(), { denis: 3, marcoz: 2, silvia: 2 });
  assert.deepEqual(g.prossimo(), ['Turno/➜ prossimo: Marco']);
});

test('Due mail della stessa conversazione nuova nello stesso istante: stesso collega, la seconda come seguito', async () => {
  const { g, esegui, a } = ambiente();
  const r1 = g.arriva('s1', 'ts', 'cliente@example.com');
  const r2 = g.arriva('s2', 'ts', 'cliente@example.com');
  const ctx = [contesto(), contesto()];
  const esiti = await Promise.all([esegui(r1, ctx[0]), esegui(r2, ctx[1])]);
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
  const esito = await esegui(g.arriva('c2', 'tc', 'cliente@example.com'), ctx);
  assert.equal(esito.seguito, true);
  assert.ok(!ctx.nomi.some((n) => n.startsWith('prendi-blocco')));
  assert.match(g.inoltri.at(-1).nota, /già assegnata a te/);
  await esegui(g.arriva('d1', 'td', 'nuovo@example.com'));
  assert.deepEqual(a(), [['c1', 'denis'], ['c2', 'denis'], ['d1', 'marcoz']]);
});

test('Riassegnazione a mano (etichetta cambiata) e "➜ prossimo" rinominata a mano', async () => {
  const { g, esegui, a } = ambiente();
  await esegui(g.arriva('r1', 'tr', 'cliente@example.com'));
  const m = g.messaggi.find((x) => x.id === 'r1');
  m.labelIds = m.labelIds.filter((l) => l !== g.id('Turno/Denis')).concat(g.id('Turno/Silvia'));
  g.etichette.find((l) => l.name.startsWith('Turno/➜')).name = 'Turno/➜ prossimo: Silvia';
  await esegui(g.arriva('r2', 'tr', 'cliente@example.com'));
  await esegui(g.arriva('x1', 'tx', 'nuovo@example.com'));
  assert.deepEqual(a(), [['r1', 'denis'], ['r2', 'silvia'], ['x1', 'silvia']]);
  assert.deepEqual(g.prossimo(), ['Turno/➜ prossimo: Denis']);
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

test('Allegati troppo grandi: secondo inoltro senza allegati, con avviso nella nota', async () => {
  const { g, esegui } = ambiente();
  g.esitoInoltro = (inputs) => (inputs.include_attachments ? { errore: 'Message too large (exceeds 25MB)' } : 'ok');
  const esito = await esegui(g.arriva('f1', 'tf', 'cliente@example.com', { allegati: 3 }));
  assert.equal(esito.senza_allegati, true);
  assert.equal(g.inoltri.length, 1);
  assert.equal(g.inoltri[0].allegati, false);
  assert.match(g.inoltri[0].nota, /Allegati non inclusi/);
});

test('Errore passeggero (limite di frequenza): nuovo tentativo con gli allegati, nessun inoltro senza allegati', async () => {
  const { g, esegui } = ambiente();
  let volte = 0;
  g.esitoInoltro = () => (volte++ === 0 ? { errore: 'User-rate limit exceeded' } : 'ok');
  const ctx = contesto();
  const esito = await esegui(g.arriva('q1', 'tq', 'cliente@example.com', { allegati: 2 }), ctx);
  assert.equal(esito.senza_allegati, false);
  assert.equal(g.inoltri.length, 1);
  assert.equal(g.inoltri[0].allegati, true);
  assert.doesNotMatch(g.inoltri[0].nota, /Allegati non inclusi/);
  assert.ok(ctx.nomi.includes('riprova-inoltro-con-allegati-1'));
});

test('Inoltro sempre rifiutato: ⛔, conversazione non assegnata, blocco rilasciato, esecuzione fallita', async () => {
  const { g, esegui, a } = ambiente();
  g.esitoInoltro = () => ({ errore: 'Invalid recipient' });
  await assert.rejects(esegui(g.arriva('z1', 'tz', 'cliente@example.com', { allegati: 1 })), /Inoltro a Denis non riuscito/);
  assert.deepEqual(g.etichetteDi('z1'), ['Turno/⛔ Non inoltrata']);
  assert.equal(g.blocchi().length, 0);
  assert.equal(g.run.size, 3, 'tre tentativi, nessun ripiego senza allegati per un errore che non è di dimensione');
  g.esitoInoltro = () => 'ok';
  await esegui(g.arriva('z2', 'tz2', 'altro@example.com'));
  assert.deepEqual(a(), [['z2', 'marcoz']], 'il turno di Denis è stato consumato dalla mail non inoltrata');
});

test('Inoltro rimasto in coda da Zapier: niente seconda copia, ⛔ con esito incerto, la conversazione resta al collega', async () => {
  const { g, esegui, a } = ambiente();
  g.esitoInoltro = () => 'attesa';
  await assert.rejects(esegui(g.arriva('w1', 'tw', 'cliente@example.com', { allegati: 1 })), /esito incerto/);
  assert.equal(g.run.size, 1, 'avviato una volta sola');
  assert.deepEqual(g.etichetteDi('w1'), ['Turno/Denis', 'Turno/⛔ Non inoltrata']);
  g.esitoInoltro = () => 'ok';
  const esito = await esegui(g.arriva('w2', 'tw', 'cliente@example.com'));
  assert.equal(esito.seguito, true);
  assert.deepEqual(a(), [['w2', 'denis']], 'il seguito va a chi potrebbe aver ricevuto la prima mail');
});

test('Esito "unknown" di Zapier: mai contato come inviato', async () => {
  const { g, esegui } = ambiente();
  g.esitoInoltro = () => 'sconosciuto';
  await assert.rejects(esegui(g.arriva('u1', 'tu', 'cliente@example.com')), /esito incerto/);
  assert.deepEqual(g.etichetteDi('u1'), ['Turno/Denis', 'Turno/⛔ Non inoltrata']);
});

test('Ricerca nella posta inviata sempre in errore: nessun inoltro alla cieca, ⛔ e assegnazione tolta', async () => {
  const { g, esegui } = ambiente();
  g.guasti.ricerca503 = 100;
  await assert.rejects(esegui(g.arriva('v1', 'tv', 'cliente@example.com')), /Inoltro a Denis non riuscito/);
  assert.equal(g.run.size, 0);
  assert.deepEqual(g.etichetteDi('v1'), ['Turno/⛔ Non inoltrata']);
});

test('Lettura della conversazione impossibile: ⛔ sulla mail ed esecuzione fallita', async () => {
  const { g, esegui } = ambiente();
  await esegui(g.arriva('j0', 'tj0', 'primo@example.com')); // etichette già pronte
  g.guasti.thread503 = 100;
  await assert.rejects(esegui(g.arriva('j1', 'tj1', 'cliente@example.com')), /exhausted/);
  assert.deepEqual(g.etichetteDi('j1'), ['Turno/⛔ Non inoltrata']);
});

test('Stesso record eseguito due volte: nessun secondo inoltro e niente "seguito"', async () => {
  const { g, esegui } = ambiente();
  const r = g.arriva('d1', 'td', 'cliente@example.com');
  await esegui(r);
  const secondo = await esegui(r);
  assert.equal(g.inoltri.length, 1);
  assert.equal(g.run.size, 1);
  assert.equal(secondo.seguito, false);
  assert.equal(secondo.inoltrata_a, 'Denis');
  assert.deepEqual(g.prossimo(), ['Turno/➜ prossimo: Marco'], 'il giro non avanza due volte');
});

test('Mail già trattata rieseguita dopo un giro completo: nessun collega saltato, nessuna copia in più', async () => {
  const { g, esegui, a } = ambiente();
  const r1 = g.arriva('h1', 'th1', 'uno@example.com');
  await esegui(r1);
  await esegui(g.arriva('h2', 'th2', 'due@example.com'));
  await esegui(g.arriva('h3', 'th3', 'tre@example.com'));
  await esegui(r1); // il giro è di nuovo su Denis
  await esegui(g.arriva('h4', 'th4', 'quattro@example.com'));
  assert.deepEqual(a(), [['h1', 'denis'], ['h2', 'marcoz'], ['h3', 'silvia'], ['h4', 'denis']]);
});

test('Seguito già inoltrato e rieseguito: resta un seguito, nessuna copia in più', async () => {
  const { g, esegui } = ambiente();
  await esegui(g.arriva('g1', 'tg', 'cliente@example.com'));
  const r2 = g.arriva('g2', 'tg', 'cliente@example.com');
  await esegui(r2);
  const di_nuovo = await esegui(r2);
  assert.equal(di_nuovo.seguito, true);
  assert.equal(g.inoltri.length, 2);
});

test('Scrittura del turno impossibile: ⛔, nessuna assegnazione a metà, il giro non avanza', async () => {
  const { g, esegui, a } = ambiente();
  await esegui(g.arriva('i0', 'ti0', 'primo@example.com'));
  g.guasti.patch500 = 100;
  await assert.rejects(esegui(g.arriva('i1', 'ti1', 'cliente@example.com')), /exhausted/);
  assert.deepEqual(g.etichetteDi('i1'), ['Turno/⛔ Non inoltrata']);
  assert.equal(g.blocchi().length, 0);
  g.guasti.patch500 = 0;
  await esegui(g.arriva('i2', 'ti2', 'altro@example.com'));
  assert.deepEqual(a(), [['i0', 'denis'], ['i2', 'marcoz']], 'Marco non perde il turno');
});

test('Rinomina di "➜ prossimo" fallita una volta: ripetuta, il giro avanza di uno', async () => {
  const { g, esegui, a } = ambiente();
  await esegui(g.arriva('k0', 'tk0', 'primo@example.com'));
  g.guasti.patch500 = 1;
  await esegui(g.arriva('k1', 'tk1', 'cliente@example.com'));
  await esegui(g.arriva('k2', 'tk2', 'altro@example.com'));
  assert.deepEqual(a(), [['k0', 'denis'], ['k1', 'marcoz'], ['k2', 'silvia']]);
});

test('"➜ prossimo" doppia (creata a mano): quella in più viene tolta', async () => {
  const { g, esegui, a } = ambiente();
  await esegui(g.arriva('y0', 'ty0', 'primo@example.com'));
  g.etichette.push({ id: 'Label_doppia', name: 'Turno/➜ prossimo: Silvia' });
  await esegui(g.arriva('y1', 'ty1', 'cliente@example.com'));
  assert.deepEqual(a(), [['y0', 'denis'], ['y1', 'marcoz']]);
  assert.deepEqual(g.prossimo(), ['Turno/➜ prossimo: Silvia']);
});

test('Blocco orfano (creato da una risposta persa): tolto per ID dopo ~3 minuti e si procede', async () => {
  const { g, esegui, a } = ambiente();
  g.guasti.bloccoCreatoMaRisposta502 = 1;
  const ctx = contesto();
  await esegui(g.arriva('b1', 'tb', 'cliente@example.com'), ctx);
  assert.deepEqual(a(), [['b1', 'denis']]);
  assert.ok(ctx.nomi.some((n) => n.startsWith('forza-blocco-')));
  assert.ok(ctx.attese >= 19);
  assert.equal(g.blocchi().length, 0);
});

test('Blocco orfano e raffica di mail: lo sblocco forzato non toglie mai un blocco vivo', async () => {
  const { g, esegui, conta, sezione } = ambiente();
  g.etichette.push({ id: 'Label_orfano', name: 'Turno/🔒 assegnazione in corso' });
  const record = Array.from({ length: 6 }, (_, i) => g.arriva('o' + i, 'to' + i, `o${i}@example.com`));
  await Promise.all(record.map((r) => esegui(r, contesto(sezione))));
  assert.equal(sezione.massimo, 1, 'mai due esecuzioni insieme nella sezione critica');
  assert.deepEqual(conta(), { denis: 2, marcoz: 2, silvia: 2 });
  assert.equal(g.blocchi().length, 0);
});

test('Rilascio del blocco fallito: la mail parte comunque, il blocco rimasto viene tolto dalla mail successiva', async () => {
  const { g, esegui, a } = ambiente();
  g.guasti.deleteBlocco503 = 3; // i tre tentativi del rilascio
  await esegui(g.arriva('l1', 'tl1', 'cliente@example.com'));
  assert.deepEqual(a(), [['l1', 'denis']]);
  assert.equal(g.blocchi().length, 1, 'rimasto');
  await esegui(g.arriva('l2', 'tl2', 'altro@example.com'));
  assert.deepEqual(a(), [['l1', 'denis'], ['l2', 'marcoz']]);
  assert.equal(g.blocchi().length, 0);
});
