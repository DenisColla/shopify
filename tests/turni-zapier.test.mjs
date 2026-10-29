// Test della logica dei turni su Zapier (turni/zapier/lib/turni.ts). Indirizzi inventati, tranne la squadra.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as t from '../turni/zapier/lib/turni.ts';

const ID = { 'Turno/Denis': 'L1', 'Turno/Marco': 'L2', 'Turno/Silvia': 'L3' };

test('Giro: con conteggi uguali Denis, Marco, Silvia, poi di nuovo Denis', () => {
  const conteggi = [0, 0, 0];
  const giro = [];
  for (let i = 0; i < 7; i++) {
    const p = t.prossimo(conteggi);
    giro.push(p.nome);
    conteggi[t.SQUADRA.indexOf(p)]++;
  }
  assert.deepEqual(giro, ['Denis', 'Marco', 'Silvia', 'Denis', 'Marco', 'Silvia', 'Denis']);
});

test('Giro: si riequilibra dopo due mail arrivate insieme o una riassegnazione', () => {
  assert.equal(t.prossimo([2, 0, 0]).nome, 'Marco');
  assert.equal(t.prossimo([2, 1, 0]).nome, 'Silvia');
  assert.equal(t.prossimo([2, 1, 1]).nome, 'Marco');
  assert.equal(t.prossimo([1, 1, 1]).nome, 'Denis');
});

test('Conversazione già assegnata: vale l\'etichetta di turno su uno qualsiasi dei messaggi', () => {
  assert.equal(t.giaAssegnato(['INBOX', 'UNREAD'], ID), null);
  assert.equal(t.giaAssegnato(['INBOX', 'L3'], ID).nome, 'Silvia');
  assert.equal(t.giaAssegnato(['L2', 'SENT'], ID).nome, 'Marco');
  assert.equal(t.giaAssegnato(['L2'], {}), null, 'senza etichette create non c\'è assegnazione');
});

test('Esclusioni: casella stessa, squadra, mail di errore; gli altri passano', () => {
  assert.equal(t.motivoEsclusione(''), 'mittente-sconosciuto');
  assert.equal(t.motivoEsclusione('support@migelino.ch'), 'inviata-dalla-casella');
  assert.equal(t.motivoEsclusione('marcoz@migelino.it'), 'mittente-della-squadra');
  assert.equal(t.motivoEsclusione('mailer-daemon@googlemail.com'), 'notifica-di-errore');
  assert.equal(t.motivoEsclusione('cliente@example.com'), null);
  assert.equal(t.motivoEsclusione('automation@migelino.ch'), null, 'colleghi fuori dal giro: informazione da inoltrare');
});

test('Indirizzi e nomi da formati diversi', () => {
  assert.equal(t.indirizzo('Mario Rossi <Mario.Rossi@Example.com>'), 'mario.rossi@example.com');
  assert.equal(t.indirizzo({ email: ' MARCOZ@migelino.it ' }), 'marcoz@migelino.it');
  assert.equal(t.indirizzo(null), '');
  assert.equal(t.nome('"Mario Rossi" <m@example.com>'), 'Mario Rossi');
  assert.equal(t.nome({ name: 'Anna' }), 'Anna');
  assert.equal(t.nomeMittente('', 'm@example.com'), 'm@example.com via Support');
  assert.equal(t.nomeMittente('Mario "Il" <Rossi>', 'm@example.com'), 'Mario Il Rossi via Support');
});

test('Etichette: radice prima, una per collega, più quella di errore', () => {
  assert.deepEqual(t.tutteLeEtichette(), ['Turno', 'Turno/Denis', 'Turno/Marco', 'Turno/Silvia', 'Turno/⛔ Non inoltrata']);
  assert.match(t.nota(t.SQUADRA[1], 'm@example.com', false), /Turno: Marco[\s\S]*direttamente a m@example\.com/);
  assert.match(t.nota(t.SQUADRA[2], 'm@example.com', true), /già assegnata a te/);
});
