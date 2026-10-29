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

test('Conversazione già assegnata: il messaggio stesso (esecuzione ripetuta) o un altro messaggio (seguito)', () => {
  const msg = (id, ...labelIds) => ({ id, labelIds });
  assert.equal(t.assegnazioneEsistente([msg('a', 'INBOX', 'UNREAD')], 'a', ID), null);
  assert.deepEqual(t.assegnazioneEsistente([msg('a', 'L3'), msg('b', 'INBOX')], 'b', ID), { persona: t.SQUADRA[2], seguito: true });
  assert.deepEqual(t.assegnazioneEsistente([msg('a', 'INBOX', 'L1')], 'a', ID), { persona: t.SQUADRA[0], seguito: false });
  assert.deepEqual(t.assegnazioneEsistente([msg('a', 'L2'), msg('b', 'L2', 'INBOX')], 'b', ID), { persona: t.SQUADRA[1], seguito: false });
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
  assert.match(n, /^Turno: Marco[\s\S]*direttamente a m@example\.com[\s\S]*allegati non si sono potuti inoltrare[\s\S]*Rif\. turno 1a2b3c$/);
  assert.match(t.nota(t.SQUADRA[2], 'm@example.com', true, false, 'x'), /già assegnata a te/);
});
