// Test delle misure del collaudo sullo storico (dati inventati).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente, PERSONE_FINTE } from './_ambiente.mjs';
import { fogliFinti, SERVIZI_BASE } from './_servizi_finti.mjs';
import { estrazioneMario } from './_estrazioni.mjs';

test('Confronto dei campi estratti con l\'anagrafica di riferimento', () => {
  const { ctx } = creaAmbiente();
  const cf = ctx.CodiceFiscale.calcola(PERSONE_FINTE.mario);
  const e = estrazioneMario(cf);
  const residenza = ctx.Indirizzi.normalizza({ via: 'Via Appia Nuova', civico: '100', cap: '00183', comune: 'Roma', provincia: 'RM' });
  const rif = { nome: 'Mario', cognome: 'Rossi', telefono: '+393331234567', cf, residenza, spedizione: residenza };
  const c = JSON.parse(JSON.stringify(ctx.Collaudo.confronta(e, rif)));
  for (const campo of ['nome', 'cognome', 'cf', 'residenza', 'spedizione', 'telefono']) {
    assert.equal(c[campo].giusto, true, campo);
  }
  const sbagliato = JSON.parse(JSON.stringify(ctx.Collaudo.confronta(e, { ...rif, cognome: 'Bianchi' })));
  assert.equal(sbagliato.cognome.giusto, false);
});

test('Riepilogo: precisione e richiamo per soglia', () => {
  const fogli = fogliFinti();
  const { ctx } = creaAmbiente({ globali: { ...SERVIZI_BASE, SpreadsheetApp: fogli.SpreadsheetApp } });
  const riga = (d) => ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', JSON.stringify(d)];
  const campoGiusto = { presente: true, confidenza: 0.95, giusto: true };
  const campi = { nome: campoGiusto, cognome: campoGiusto, cf: campoGiusto, residenza: campoGiusto, spedizione: { presente: true, confidenza: 0.7, giusto: false }, telefono: campoGiusto };
  ctx.Collaudo.scriviRiepilogo([
    riga({ tipo: 'POSITIVO', esito: 'CONFERMA', probabilita: 0.97, riferimento: true, campi, decisione: 'CREA' }),
    riga({ tipo: 'POSITIVO', esito: 'CONFERMA', probabilita: 0.8, riferimento: true, campi, decisione: 'DATI_MANCANTI' }),
    riga({ tipo: 'NEGATIVO', esito: 'NON_CONFERMA', probabilita: 0.1 }),
    riga({ tipo: 'NEGATIVO', esito: 'CONFERMA', probabilita: 0.9 })
  ]);
  const righe = JSON.parse(JSON.stringify(fogli.fogli.get('Riepilogo collaudo').righe));
  const a085 = righe.find((r) => r[0] === 0.85);
  assert.deepEqual(a085.slice(1), [1, 1, 1, 1, '50%', '50%']);
  const sped085 = righe.find((r) => r[0] === 'spedizione' && r[1] === 0.85);
  assert.deepEqual(sped085.slice(2, 6), [0, 0, '—', '0%']);
  const sped06 = righe.find((r) => r[0] === 'spedizione' && r[1] === 0.6);
  assert.deepEqual(sped06.slice(2, 6), [2, 0, '0%', '100%']);
  assert.ok(righe.some((r) => r[0] === 'Positivi' && r[1] === 2 && r[3] === 1));
});
