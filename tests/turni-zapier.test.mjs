// Test della logica dei turni su Zapier (turni/zapier/lib/turni.ts). Indirizzi inventati, tranne la squadra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as t from '../turni/zapier/lib/turni.ts';

const ETICHETTE = [
  { id: 'L0', name: 'Turno' }, { id: 'L1', name: 'Turno/Denis' }, { id: 'L2', name: 'turno/MARCO' },
  { id: 'L3', name: 'Turno/Silvia' }, { id: 'L9', name: 'Turno/⛔ Non inoltrata' }, { id: 'X', name: 'INBOX' }
];
const { ids: ID } = t.mappaEtichette(ETICHETTE);

test('Etichette fisse: trovate senza badare alle maiuscole, chiavi con il nome canonico', () => {
  assert.deepEqual(ID, { 'Turno': 'L0', 'Turno/Denis': 'L1', 'Turno/Marco': 'L2', 'Turno/Silvia': 'L3', 'Turno/⛔ Non inoltrata': 'L9' });
  assert.deepEqual(t.mappaEtichette([{ id: 'L1', name: 'Turno/Denis' }]).mancanti, ['Turno', 'Turno/Marco', 'Turno/Silvia', 'Turno/⛔ Non inoltrata']);
});

test('Giro dall\'etichetta "➜ prossimo": Denis, Marco, Silvia, poi di nuovo Denis', () => {
  let etichetta = null; // prima volta: non esiste ancora
  const giro = [];
  for (let i = 0; i < 7; i++) {
    const p = t.prossimoDa(etichetta);
    giro.push(p.nome);
    etichetta = { id: 'P', name: t.etichettaProssimo(t.dopo(p)) };
  }
  assert.deepEqual(giro, ['Denis', 'Marco', 'Silvia', 'Denis', 'Marco', 'Silvia', 'Denis']);
});

test('Etichetta "➜ prossimo" cambiata a mano: vale il nome scritto, se non si riconosce si riparte da Denis', () => {
  const elenco = (nome) => [...ETICHETTE, { id: 'P', name: nome }];
  assert.equal(t.prossimoDa(t.etichettaDelProssimo(elenco('Turno/➜ prossimo: Silvia'))).nome, 'Silvia');
  assert.equal(t.prossimoDa(t.etichettaDelProssimo(elenco('turno/➜ Prossimo:   marco '))).nome, 'Marco');
  assert.equal(t.prossimoDa(t.etichettaDelProssimo(elenco('Turno/➜ prossimo: Luca'))).nome, 'Denis');
  assert.equal(t.etichettaDelProssimo(ETICHETTE), null);
});

test('Conversazione già assegnata: un altro messaggio (seguito) o solo il messaggio stesso (esecuzione ripetuta)', () => {
  const msg = (id, ...labelIds) => ({ id, labelIds });
  assert.equal(t.assegnazioneEsistente([msg('a', 'INBOX', 'UNREAD')], 'a', ID), null);
  assert.deepEqual(t.assegnazioneEsistente([msg('a', 'L3'), msg('b', 'INBOX')], 'b', ID), { persona: t.SQUADRA[2], seguito: true });
  assert.deepEqual(t.assegnazioneEsistente([msg('a', 'INBOX', 'L1')], 'a', ID), { persona: t.SQUADRA[0], seguito: false });
  assert.deepEqual(t.assegnazioneEsistente([msg('a', 'L2'), msg('b', 'L2', 'INBOX')], 'b', ID), { persona: t.SQUADRA[1], seguito: true },
    'seguito rieseguito: resta un seguito');
  assert.equal(t.assegnazioneEsistente([msg('a', 'SENT'), { id: 'b', labelIds: null }], 'b', ID), null);
});

test('Esclusioni: casella stessa, squadra, mail di errore; gli altri passano', () => {
  assert.equal(t.motivoEsclusione(''), 'mittente-sconosciuto');
  assert.equal(t.motivoEsclusione('support@migelino.ch'), 'inviata-dalla-casella');
  assert.equal(t.motivoEsclusione('marcoz@migelino.it'), 'mittente-della-squadra');
  assert.equal(t.motivoEsclusione('mailer-daemon@googlemail.com'), 'notifica-di-errore');
  assert.equal(t.motivoEsclusione('cliente@example.com'), null);
  assert.equal(t.motivoEsclusione('automation@migelino.ch'), null, 'colleghi fuori dal giro: informazione da inoltrare');
});

test('Collega già destinatario diretto (A o Cc): niente doppione', () => {
  assert.equal(t.giaDestinatario(t.SQUADRA[1], ['support@migelino.ch', 'Marco <MarcoZ@migelino.it>']), true);
  assert.equal(t.giaDestinatario(t.SQUADRA[1], ['support@migelino.ch']), false);
  assert.equal(t.giaDestinatario(t.SQUADRA[0], []), false);
});

test('Indirizzi, nomi e nota', () => {
  assert.equal(t.indirizzo('Mario Rossi <Mario.Rossi@Example.com>'), 'mario.rossi@example.com');
  assert.equal(t.indirizzo({ email: ' MARCOZ@migelino.it ' }), 'marcoz@migelino.it');
  assert.equal(t.indirizzo({ name: '', email: '' }), '');
  assert.equal(t.nome('"Mario Rossi" <m@example.com>'), 'Mario Rossi');
  assert.equal(t.nomeMittente('', 'm@example.com'), 'm@example.com via Support');
  assert.equal(t.nomeMittente('Mario "Il" <Rossi>', 'm@example.com'), 'Mario Il Rossi via Support');
  const n = t.nota(t.SQUADRA[1], 'm@example.com', false, true, '1a2b3c');
  assert.match(n, /^Turno: Marco[\s\S]*direttamente a m@example\.com[\s\S]*Allegati non inclusi \(troppo grandi[\s\S]*Rif\. turno 1a2b3c$/);
  assert.match(t.nota(t.SQUADRA[2], 'm@example.com', true, false, 'x'), /già assegnata a te/);
});

test('Scelta sotto blocco: conversazione nuova, seguito, esecuzione ripetuta (mai il giro)', () => {
  const msg = (id, ...labelIds) => ({ id, labelIds });
  const elenco = (prossimo, ...altri) => [...ETICHETTE, ...(prossimo ? [{ id: 'P', name: prossimo }] : []), ...altri];
  // nuova, prima volta in assoluto
  let s = t.scegli([msg('a', 'INBOX')], 'a', ID, elenco(null));
  assert.deepEqual(s, { nome: 'Denis', idProssimo: null, nuovoNome: 'Turno/➜ prossimo: Marco', doppioni: [], seguito: false, applica: true, aggiungi: 'L1', rinomina: true });
  // nuova, giro su Silvia
  s = t.scegli([msg('a', 'INBOX')], 'a', ID, elenco('Turno/➜ prossimo: Silvia'));
  assert.equal(s.nome, 'Silvia'); assert.equal(s.aggiungi, 'L3'); assert.equal(s.nuovoNome, 'Turno/➜ prossimo: Denis'); assert.equal(s.idProssimo, 'P');
  // seguito: nessuna scrittura
  s = t.scegli([msg('a', 'L2'), msg('b', 'INBOX')], 'b', ID, elenco('Turno/➜ prossimo: Silvia'));
  assert.equal(s.seguito, true); assert.equal(s.applica, false); assert.equal(s.nome, 'Marco');
  // esecuzione ripetuta di una mail già assegnata: il giro non si tocca, anche se dopo un giro completo è di nuovo sul suo nome
  for (const giro of ['Turno/➜ prossimo: Marco', 'Turno/➜ prossimo: Silvia']) {
    s = t.scegli([msg('a', 'L2')], 'a', ID, elenco(giro));
    assert.equal(s.nome, 'Marco'); assert.equal(s.applica, false); assert.equal(s.rinomina, false); assert.equal(s.aggiungi, null);
  }
  // "➜ prossimo" doppie: le altre da togliere
  s = t.scegli([msg('a')], 'a', ID, elenco('Turno/➜ prossimo: Marco', { id: 'P2', name: 'turno/➜ prossimo: Silvia' }));
  assert.deepEqual(s.doppioni, ['P2']); assert.equal(s.nome, 'Marco');
});

test('Errore di dimensione distinto dai limiti di frequenza; sfasamento stabile', () => {
  assert.equal(t.erroreDiDimensione('Message too large (exceeds 25MB)'), true);
  assert.equal(t.erroreDiDimensione('552 5.3.4 Message size exceeds fixed limit'), true);
  assert.equal(t.erroreDiDimensione('User-rate limit exceeded'), false);
  assert.equal(t.erroreDiDimensione('Rate limit: request size quota'), false);
  assert.equal(t.erroreDiDimensione(null), false);
  assert.equal(t.sfasamento('1a2b', 3), t.sfasamento('1a2b', 3));
  for (let i = 0; i < 10; i++) assert.ok(t.sfasamento('abc' + i, i) >= 0 && t.sfasamento('abc' + i, i) <= 4);
});
