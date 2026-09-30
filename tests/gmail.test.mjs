// Test della raccolta di mail e allegati del paziente e del secondo tentativo sulle immagini.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente } from './_ambiente.mjs';
import { AllegatoFinto, MessaggioFinto, ThreadFinto, gmailFinta, SERVIZI_BASE, PROPRIETA_BASE, rispostaClaude } from './_servizi_finti.mjs';

const MB = 1024 * 1024;
const ora = Date.now();
const fa = (minuti) => new Date(ora - minuti * 60000).toISOString();

function ambienteConPosta(threads, fetch) {
  const gmail = gmailFinta(threads);
  return creaAmbiente({ proprieta: PROPRIETA_BASE, globali: { ...SERVIZI_BASE, GmailApp: gmail.GmailApp }, fetch });
}

test('Dossier: solo allegati del paziente, HEIC e immagini enormi segnalati, audiometrie in fondo, niente doppioni', () => {
  const t = new ThreadFinto('t1', [
    new MessaggioFinto({ id: 'a', da: 'Operatore <info@migelino.it>', a: 'mario@example.com', data: fa(100), corpo: 'Proposta',
      allegati: [new AllegatoFinto('preventivo.pdf', 'application/pdf')] }),
    new MessaggioFinto({ id: 'b', da: 'Mario <mario@example.com>', data: fa(50), corpo: 'Ecco gli esami',
      allegati: [new AllegatoFinto('audiometria.pdf', 'application/pdf'), new AllegatoFinto('ci.jpg', 'image/jpeg', 2 * MB)] }),
    new MessaggioFinto({ id: 'c', da: 'Mario <mario@example.com>', data: fa(10), corpo: 'Ecco i documenti',
      allegati: [new AllegatoFinto('ci.jpg', 'image/jpeg', 2 * MB), new AllegatoFinto('retro.heic', 'image/heic'),
        new AllegatoFinto('foto-enorme.png', 'image/png', 9 * MB), new AllegatoFinto('preventivo-firmato.pdf', 'application/pdf')],
      inLinea: [new AllegatoFinto('logo.png', 'image/png', 5000)] })
  ]);
  const { ctx } = ambienteConPosta([t]);
  const d = JSON.parse(JSON.stringify(ctx.Posta.dossier('mario@example.com', null)));
  // documenti prima (dal più recente; "ci.jpg" conta una volta sola, dal primo invio), audiometrie in fondo
  assert.deepEqual(d.allegati.map((a) => a.nome), ['preventivo-firmato.pdf', 'ci.jpg', 'audiometria.pdf']);
  assert.ok(d.nonLeggibili.some((n) => /retro\.heic/.test(n)));
  assert.ok(d.nonLeggibili.some((n) => /foto-enorme\.png \(immagine troppo grande\)/.test(n)));
  assert.equal(d.messaggi.length, 3);
  assert.deepEqual(d.messaggi.map((m) => m.ruolo), ['MIGELINO', 'PAZIENTE', 'PAZIENTE']);
});

test('Dossier per il collaudo: ignora i messaggi successivi alla data di riferimento', () => {
  const t = new ThreadFinto('t1', [
    new MessaggioFinto({ id: 'a', da: 'Mario <mario@example.com>', data: fa(50), corpo: 'Primo' }),
    new MessaggioFinto({ id: 'b', da: 'Mario <mario@example.com>', data: fa(5), corpo: 'Dopo' })
  ]);
  const { ctx } = ambienteConPosta([t]);
  const d = ctx.Posta.dossier('mario@example.com', ora - 20 * 60000);
  assert.equal(d.messaggi.length, 1);
});

test('Estrazione: se Claude rifiuta un\'immagine riprova senza le immagini grandi', () => {
  const corpi = [];
  const { ctx } = ambienteConPosta([], (_u, p) => {
    const corpo = JSON.parse(p.payload);
    corpi.push(corpo);
    if (corpi.length === 1) return { codice: 400, corpo: { type: 'error', error: { type: 'invalid_request_error', message: 'messages.0.content.2.image.source.base64: image dimensions exceed max allowed size' } } };
    return rispostaClaude({ ok: true });
  });
  ctx.Estrattore.estrai({
    mittente: { nome: 'Mario', email: 'mario@example.com' }, tipoConferma: 'ACQUISTO', dataConferma: '2026-09-30',
    allegati: [
      { nome: 'grande.jpg', mimeType: 'image/jpeg', base64: 'QUJD', dimensione: 4 * MB, data: '', ruolo: 'PAZIENTE' },
      { nome: 'ci.pdf', mimeType: 'application/pdf', base64: 'QUJD', dimensione: 1 * MB, data: '', ruolo: 'PAZIENTE' }
    ],
    nonLeggibili: [], messaggi: []
  });
  assert.equal(corpi.length, 2);
  const tipi = corpi[1].messages[0].content.map((b) => b.type);
  assert.ok(!tipi.includes('image'));
  assert.ok(tipi.includes('document'));
  assert.match(corpi[1].messages[0].content[0].text, /grande\.jpg \(rifiutato da Claude\)/);
});
