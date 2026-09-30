// Test del modulo decisionale: regole di Migelino su cosa scrivere in Shopify.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente, PERSONE_FINTE } from './_ambiente.mjs';
import { campo, indirizzo, spedizioneVuota, estrazioneMario, SPEDIZIONE_MOGLIE } from './_estrazioni.mjs';

const { ctx } = creaAmbiente();
const { Decisione, CodiceFiscale, Indirizzi } = ctx;
const puro = (x) => JSON.parse(JSON.stringify(x));
const CF_MARIO = CodiceFiscale.calcola(PERSONE_FINTE.mario);

function valuta(estrazione, clienteEsistente = null, soglia = 0.85) {
  return puro(Decisione.valuta({
    estrazione, email: 'mario.rossi@example.com', clienteEsistente, soglia,
    tipoConferma: 'ACQUISTO', dataConferma: '2026-09-30'
  }));
}

// ------------------------------------------------------------------ cliente nuovo
test('Completo, spedizione = residenza: un solo indirizzo con CF in Azienda', () => {
  const p = valuta(estrazioneMario(CF_MARIO));
  assert.equal(p.esito, 'CREA');
  assert.deepEqual(p.cliente, {
    firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com', phone: '+393331234567',
    note: 'Anagrafica creata automaticamente dalla mail del 30/09/2026 (conferma acquisto).',
    tags: ['anagrafica-auto']
  });
  assert.equal(p.indirizzi.length, 1);
  assert.deepEqual(p.indirizzi[0], {
    azione: 'CREA', ruolo: 'UNICO', predefinito: true,
    address: {
      address1: 'Via Appia Nuova 100', city: 'Roma', zip: '00183', countryCode: 'IT', provinceCode: 'RM',
      firstName: 'Mario', lastName: 'Rossi', company: CF_MARIO, phone: '+393331234567'
    }
  });
});

test('Spedizione a un familiare: predefinito = spedizione (senza CF), secondo indirizzo = residenza con CF', () => {
  const p = valuta(estrazioneMario(CF_MARIO, { spedizione: SPEDIZIONE_MOGLIE }));
  assert.equal(p.esito, 'CREA');
  assert.equal(p.indirizzi.length, 2);
  const [sped, res] = p.indirizzi;
  assert.equal(sped.ruolo, 'SPEDIZIONE');
  assert.equal(sped.predefinito, true);
  assert.equal(sped.address.firstName, 'Lucia');
  assert.equal(sped.address.lastName, 'Verdi');
  assert.equal(sped.address.company, undefined);
  assert.equal(sped.address.phone, '+393477654321');
  assert.equal(res.ruolo, 'RESIDENZA');
  assert.equal(res.predefinito, false);
  assert.equal(res.address.company, CF_MARIO);
  assert.equal(res.address.firstName, 'Mario');
});

test('Spedizione "presso" un\'azienda: C/O nel campo Azienda dell\'indirizzo di spedizione', () => {
  const sped = { ...SPEDIZIONE_MOGLIE, destinatario_nome: '', destinatario_cognome: '', presso: 'Ditta Esempio S.r.l.' };
  const p = valuta(estrazioneMario(CF_MARIO, { spedizione: sped }));
  assert.equal(p.indirizzi[0].address.company, 'C/O Ditta Esempio S.r.l.');
  assert.equal(p.indirizzi[0].address.firstName, 'Mario');
  assert.equal(p.indirizzi[1].address.company, CF_MARIO);
});

test('Spedizione diversa ma intestata al paziente: CF anche sulla spedizione', () => {
  const sped = { ...SPEDIZIONE_MOGLIE, destinatario_nome: '', destinatario_cognome: '', telefono_destinatario: '' };
  const p = valuta(estrazioneMario(CF_MARIO, { spedizione: sped }));
  assert.equal(p.indirizzi[0].address.company, CF_MARIO);
  assert.equal(p.indirizzi[0].address.phone, '+393331234567');
});

test('Spedizione indicata ma uguale alla residenza: un solo indirizzo', () => {
  const sped = spedizioneVuota({
    stessa_della_residenza: 'NO',
    indirizzo: indirizzo({ via: 'V. Appia Nuova', civico: '100', cap: '00183', comune: 'Roma', provincia: 'RM', fonte: 'DICHIARAZIONE_EMAIL' })
  });
  const p = valuta(estrazioneMario(CF_MARIO, { spedizione: sped }));
  assert.equal(p.esito, 'CREA');
  assert.equal(p.indirizzi.length, 1);
  assert.equal(p.indirizzi[0].ruolo, 'UNICO');
});

// ------------------------------------------------------------------ regola: niente residenza o spedizione = niente anagrafica
test('Spedizione NON indicata: nessuna creazione', () => {
  const p = valuta(estrazioneMario(CF_MARIO, { spedizione: spedizioneVuota() }));
  assert.equal(p.esito, 'DATI_MANCANTI');
  assert.equal(p.cliente, undefined);
  assert.ok(p.mancanti.some((m) => m.startsWith('indirizzo di spedizione')));
});

test('Residenza mancante (es. patente senza residenza): nessuna creazione', () => {
  const p = valuta(estrazioneMario(CF_MARIO, { residenza: indirizzo({ confidenza: 0, fonte: 'NESSUNA', paese: '' }) }));
  assert.equal(p.esito, 'DATI_MANCANTI');
  assert.ok(p.mancanti.some((m) => m.startsWith('indirizzo di residenza')));
  // "stessa della residenza" senza residenza = anche la spedizione manca
  assert.ok(p.mancanti.some((m) => m.startsWith('indirizzo di spedizione')));
});

test('Residenza presa dalla firma della mail: non vale, nessuna creazione', () => {
  const e = estrazioneMario(CF_MARIO);
  e.residenza.fonte = 'FIRMA_EMAIL';
  const p = valuta(e);
  assert.equal(p.esito, 'DATI_MANCANTI');
  assert.match(p.mancanti.join(' '), /fonte non valida/);
});

test('Residenza letta male (confidenza bassa): nessuna creazione', () => {
  const e = estrazioneMario(CF_MARIO);
  e.residenza.confidenza = 0.6;
  assert.equal(valuta(e).esito, 'DATI_MANCANTI');
});

test('Spedizione senza numero civico: nessuna creazione', () => {
  const sped = { ...SPEDIZIONE_MOGLIE, indirizzo: { ...SPEDIZIONE_MOGLIE.indirizzo, civico: '' } };
  const p = valuta(estrazioneMario(CF_MARIO, { spedizione: sped }));
  assert.equal(p.esito, 'DATI_MANCANTI');
  assert.match(p.mancanti.join(' '), /civico/);
});

test('CAP incompatibile con la provincia: nessuna creazione', () => {
  const e = estrazioneMario(CF_MARIO);
  e.residenza.cap = '20121';
  assert.equal(valuta(e).esito, 'DATI_MANCANTI');
});

test('Nome letto male: nessuna creazione', () => {
  const e = estrazioneMario(CF_MARIO, { nome: campo('MARIO', 0.5) });
  const p = valuta(e);
  assert.equal(p.esito, 'DATI_MANCANTI');
  assert.ok(p.mancanti.includes('nome'));
});

test('Paziente non chiaro (documenti di più persone): DUBBIO', () => {
  const p = valuta(estrazioneMario(CF_MARIO, { paziente_identificato: 'INCERTO', piu_persone: true }));
  assert.equal(p.esito, 'DUBBIO');
  assert.equal(p.cliente, undefined);
});

// ------------------------------------------------------------------ codice fiscale
test('CF mancante: si crea comunque, Azienda vuota e nota "da completare"', () => {
  const p = valuta(estrazioneMario(CF_MARIO, { codice_fiscale: campo('', 0, 'NESSUNA') }));
  assert.equal(p.esito, 'CREA');
  assert.equal(p.indirizzi[0].address.company, undefined);
  assert.match(p.cliente.note, /Da completare: codice fiscale/);
});

test('CF con carattere di controllo errato: non scritto', () => {
  const sbagliato = CF_MARIO.slice(0, 15) + (CF_MARIO[15] === 'A' ? 'B' : 'A');
  const p = valuta(estrazioneMario(CF_MARIO, { codice_fiscale: campo(sbagliato, 0.99, 'TESSERA_SANITARIA') }));
  assert.equal(p.esito, 'CREA');
  assert.equal(p.indirizzi[0].address.company, undefined);
  assert.ok(p.scartati.some((s) => s.campo === 'codice fiscale' && /controllo/.test(s.motivo)));
});

test('CF di un\'altra persona: non scritto', () => {
  const altro = CodiceFiscale.calcola(PERSONE_FINTE.anna);
  const p = valuta(estrazioneMario(CF_MARIO, { codice_fiscale: campo(altro, 0.99, 'TESSERA_SANITARIA') }));
  assert.equal(p.indirizzi[0].address.company, undefined);
  assert.ok(p.scartati.some((s) => /non coerente/.test(s.motivo)));
});

test('Telefono non valido: non scritto, il resto sì', () => {
  const p = valuta(estrazioneMario(CF_MARIO, { telefono: campo('12345', 0.99, 'FIRMA_EMAIL') }));
  assert.equal(p.esito, 'CREA');
  assert.equal(p.cliente.phone, undefined);
  assert.match(p.cliente.note, /telefono/);
});

test('Indirizzi esteri (Svizzera): accettati senza provincia', () => {
  const res = indirizzo({ via: 'Bahnhofstrasse', civico: '1', cap: '8001', comune: 'Zürich', provincia: '', paese: 'CH' });
  const p = valuta(estrazioneMario(CF_MARIO, { residenza: res }));
  assert.equal(p.esito, 'CREA');
  assert.equal(p.indirizzi[0].address.countryCode, 'CH');
  assert.equal(p.indirizzi[0].address.provinceCode, undefined);
});

// ------------------------------------------------------------------ cliente esistente
function clienteEsistente({ conCf = true, nome = 'Mario', cognome = 'Rossi', indirizzi } = {}) {
  const raw = {
    id: 'gid://shopify/MailingAddress/1?model_name=CustomerAddress', firstName: nome, lastName: cognome,
    company: conCf ? CF_MARIO : null, address1: 'Via Appia Nuova 100', address2: null, city: 'Roma',
    provinceCode: 'RM', zip: '00183', countryCodeV2: 'IT', phone: '+393331234567'
  };
  const lista = indirizzi || [raw];
  return {
    id: 'gid://shopify/Customer/1', firstName: nome, lastName: cognome, phone: '+393331234567', note: '', tags: [],
    defaultAddressId: lista[0].id,
    indirizzi: lista.map((a) => ({ id: a.id, company: a.company || '', interno: Indirizzi.daShopify(a), raw: a }))
  };
}

test('Cliente esistente già completo: nulla da fare', () => {
  const p = valuta(estrazioneMario(CF_MARIO), clienteEsistente());
  assert.equal(p.esito, 'COMPLETO');
  assert.equal(p.indirizzi.length, 0);
});

test('Cliente esistente senza CF: aggiunge il CF all\'indirizzo senza toccare il resto', () => {
  const p = valuta(estrazioneMario(CF_MARIO), clienteEsistente({ conCf: false }));
  assert.equal(p.esito, 'AGGIORNA');
  assert.equal(p.indirizzi.length, 1);
  assert.equal(p.indirizzi[0].azione, 'AGGIORNA');
  assert.equal(p.indirizzi[0].address.company, CF_MARIO);
  assert.equal(p.indirizzi[0].address.address1, 'Via Appia Nuova 100');
  assert.equal(p.cliente.firstName, undefined); // già presente: non sovrascritto
  assert.match(p.cliente.note, /completata automaticamente/);
});

test('Cliente esistente con nome diverso: nessuna sovrascrittura, solo avviso', () => {
  const p = valuta(estrazioneMario(CF_MARIO), clienteEsistente({ nome: 'Marione' }));
  assert.ok(p.avvisi.some((a) => /Nome in Shopify/.test(a)));
  assert.ok(!p.cliente || p.cliente.firstName === undefined);
});

test('Cliente esistente con nuova spedizione: la aggiunge come predefinita', () => {
  const p = valuta(estrazioneMario(CF_MARIO, { spedizione: SPEDIZIONE_MOGLIE }), clienteEsistente());
  assert.equal(p.esito, 'AGGIORNA');
  const nuova = p.indirizzi.find((i) => i.ruolo === 'SPEDIZIONE');
  assert.equal(nuova.azione, 'CREA');
  assert.equal(nuova.predefinito, true);
});

test('Cliente esistente senza residenza e senza residenza estratta: nessuna modifica', () => {
  const soloSped = { id: 'gid://shopify/MailingAddress/9', firstName: 'Mario', lastName: 'Rossi', company: null,
    address1: 'Via Tuscolana 5', city: 'Roma', provinceCode: 'RM', zip: '00182', countryCodeV2: 'IT' };
  const e = estrazioneMario(CF_MARIO, { residenza: indirizzo({ confidenza: 0, fonte: 'NESSUNA', paese: '' }), spedizione: spedizioneVuota() });
  const p = valuta(e, clienteEsistente({ indirizzi: [soloSped] }));
  assert.equal(p.esito, 'DATI_MANCANTI');
  assert.deepEqual(p.mancanti.filter((m) => /residenza/.test(m)).length, 1);
  assert.ok(!p.mancanti.some((m) => /spedizione/.test(m))); // la spedizione c'è già in Shopify
});

test('Riepilogo leggibile per il Registro', () => {
  const piano = Decisione.valuta({
    estrazione: estrazioneMario(CF_MARIO, { spedizione: spedizioneVuota() }), email: 'x@example.com',
    clienteEsistente: null, soglia: 0.85, tipoConferma: 'PROVA', dataConferma: '2026-09-30'
  });
  assert.match(Decisione.riepilogo(piano), /Mancanti: indirizzo di spedizione: non indicato dal paziente/);
});
