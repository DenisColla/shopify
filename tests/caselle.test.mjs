// Più caselle (es. Denis, Silvia, Marco) con lo stesso script: memoria per casella,
// stato dei pazienti condiviso, nessun doppione su Shopify. Dati inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente, ProprietaFinte, PERSONE_FINTE } from './_ambiente.mjs';
import {
  AllegatoFinto, MessaggioFinto, ThreadFinto, gmailFinta, fogliFinti, serviziBase,
  PROPRIETA_BASE, rispostaClaude, shopifyFinto
} from './_servizi_finti.mjs';
import { campo, indirizzo, spedizioneVuota, estrazioneMario } from './_estrazioni.mjs';

const PAZIENTE = 'Mario Rossi <mario.rossi@example.com>';
const ORA = Date.now();
const minutiFa = (n) => new Date(ORA - n * 60000).toISOString();
const CONFERMA = { esito: 'CONFERMA', tipo: 'ACQUISTO', probabilita: 0.97, frase_chiave: 'Confermo', motivazione: 'conferma' };
const CF = creaAmbiente().ctx.CodiceFiscale.calcola(PERSONE_FINTE.mario);

/** Una casella: il suo Gmail, le sue proprietà utente; proprietà script, Foglio e Shopify in comune. */
function casella(email, { threads, comuni, classificazione, estrazione }) {
  const gmail = gmailFinta(threads);
  const richieste = [];
  const amb = creaAmbiente({
    proprieta: comuni.proprieta,
    proprietaUtente: new ProprietaFinte({ ULTIMO_CONTROLLO: String(ORA - 3600000) }),
    globali: { ...serviziBase(email), GmailApp: gmail.GmailApp, SpreadsheetApp: comuni.fogli.SpreadsheetApp },
    fetch: (url, parametri) => {
      if (url.startsWith('https://api.anthropic.com')) {
        const riconoscimento = /Il tuo compito: leggere la conversazione/.test(JSON.parse(parametri.payload).system[0].text);
        richieste.push(riconoscimento ? 'riconoscimento' : 'estrazione');
        return rispostaClaude(riconoscimento ? classificazione : estrazione);
      }
      return comuni.shopify.risposta(url, parametri);
    }
  });
  return { amb, richieste };
}

function comuni(opzioniShopify = {}) {
  return {
    proprieta: new ProprietaFinte({ ...PROPRIETA_BASE, MODALITA: 'LIVE' }),
    fogli: fogliFinti(),
    shopify: shopifyFinto(opzioniShopify)
  };
}

const righeRegistro = (c) => c.fogli.fogli.get('Registro').righe.slice(1);

test('Documenti a Denis, indirizzo di spedizione a Silvia: l\'anagrafica si completa unendo i dati', () => {
  const c = comuni();
  // 1) Denis: conferma con documento, ma senza indirizzo di spedizione
  const tDenis = new ThreadFinto('d1', [
    new MessaggioFinto({ id: 'd-a', da: 'Denis <denis@migelino.ch>', a: 'mario.rossi@example.com', data: minutiFa(300), corpo: 'Per procedere ci invii i documenti.' }),
    new MessaggioFinto({ id: 'd-b', da: PAZIENTE, a: 'denis@migelino.ch', data: minutiFa(30), corpo: 'Confermo, allego la carta d\'identità.',
      allegati: [new AllegatoFinto('ci.jpg', 'image/jpeg')] })
  ]);
  const denis = casella('denis@migelino.ch', { threads: [tDenis], comuni: c, classificazione: CONFERMA,
    estrazione: estrazioneMario(CF, { spedizione: spedizioneVuota() }) });
  denis.amb.ctx.esegui();
  assert.ok(tDenis.etichette.has('Anagrafica/⚠️ Dati mancanti'));
  assert.equal(c.shopify.operazioni.filter((o) => o.nome === 'CreaCliente').length, 0);

  // 2) Silvia: il paziente le scrive solo l'indirizzo (nessun documento nella sua casella)
  const tSilvia = new ThreadFinto('s1', [
    new MessaggioFinto({ id: 's-a', da: PAZIENTE, a: 'collega1@migelino.ch', data: minutiFa(5),
      corpo: 'Buongiorno, l\'indirizzo di spedizione è Via Tuscolana 5, 00182 Roma.\n\nIl giorno 30/09/2026 10:00 Denis <denis@migelino.ch> ha scritto:\n> ...' })
  ]);
  const soloSpedizione = {
    ...estrazioneMario('', {
      nome: campo('', 0, 'NESSUNA'), cognome: campo('', 0, 'NESSUNA'), sesso: campo('', 0, 'NESSUNA'), data_nascita: campo('', 0, 'NESSUNA'),
      luogo_nascita: campo('', 0, 'NESSUNA'), codice_fiscale: campo('', 0, 'NESSUNA'), telefono: campo('', 0, 'NESSUNA'),
      residenza: indirizzo({ confidenza: 0, fonte: 'NESSUNA', paese: '' }),
      paziente_identificato: 'INCERTO',
      spedizione: spedizioneVuota({ stessa_della_residenza: 'NO',
        indirizzo: indirizzo({ via: 'Via Tuscolana', civico: '5', cap: '00182', comune: 'Roma', provincia: 'RM', fonte: 'DICHIARAZIONE_EMAIL', confidenza: 0.95 }) })
    })
  };
  const silvia = casella('collega1@migelino.ch', { threads: [tSilvia], comuni: c, classificazione: CONFERMA, estrazione: soloSpedizione });
  silvia.amb.ctx.esegui();

  assert.deepEqual(silvia.richieste, ['estrazione']); // completamento: niente nuovo riconoscimento
  const ops = c.shopify.operazioni.map((o) => o.nome);
  assert.deepEqual(ops.slice(-4), ['CercaClienti', 'CreaCliente', 'CreaIndirizzo', 'CreaIndirizzo']);
  const creazione = c.shopify.operazioni.find((o) => o.nome === 'CreaCliente');
  assert.equal(creazione.variables.input.lastName, 'Rossi'); // dai documenti letti nella casella di Denis
  const indirizzi = c.shopify.operazioni.filter((o) => o.nome === 'CreaIndirizzo').map((o) => o.variables.address.address1);
  assert.deepEqual(indirizzi, ['Via Tuscolana 5', 'Via Appia Nuova 100']);
  assert.ok(tSilvia.etichette.has('Anagrafica/✅ Creata'));

  // 3) Al giro successivo la casella di Denis riallinea la propria etichetta
  denis.amb.ctx.esegui();
  assert.ok(tDenis.etichette.has('Anagrafica/✅ Creata'));
  assert.ok(!tDenis.etichette.has('Anagrafica/⚠️ Dati mancanti'));

  const righe = righeRegistro(c);
  assert.equal(righe[0][2], 'denis@migelino.ch');
  assert.equal(righe[1][2], 'collega1@migelino.ch');
  assert.equal(righe[1][3], 'Anagrafica creata');
});

test('Stessa conferma in due caselle (paziente in copia): un solo cliente creato', () => {
  let creato = false;
  const nodoCreato = {
    id: 'gid://shopify/Customer/777', firstName: 'Mario', lastName: 'Rossi', note: '', tags: ['anagrafica-auto'], numberOfOrders: '0',
    defaultEmailAddress: { emailAddress: 'mario.rossi@example.com' }, defaultPhoneNumber: { phoneNumber: '+393331234567' },
    defaultAddress: { id: 'gid://shopify/MailingAddress/1' },
    addressesV2: { nodes: [{ id: 'gid://shopify/MailingAddress/1', firstName: 'Mario', lastName: 'Rossi', company: CF, address1: 'Via Appia Nuova 100',
      address2: null, city: 'Roma', provinceCode: 'RM', zip: '00183', countryCodeV2: 'IT', phone: '+393331234567' }] }
  };
  const c = comuni({ clienti: (ops) => {
    creato = creato || ops.some((o) => o.nome === 'CreaIndirizzo');
    return creato ? [nodoCreato] : [];
  } });
  const thread = (id, a) => new ThreadFinto(id, [
    new MessaggioFinto({ id: id + '-a', da: 'Denis <denis@migelino.ch>', a: 'mario.rossi@example.com', data: minutiFa(300), corpo: 'Proposta' }),
    new MessaggioFinto({ id: id + '-b', da: PAZIENTE, a, data: minutiFa(10), corpo: 'Confermo l\'ordine, spedite a casa.' })
  ]);
  const tDenis = thread('d1', 'denis@migelino.ch, collega2@migelino.ch');
  const tMarco = thread('m1', 'denis@migelino.ch, collega2@migelino.ch');
  const e = estrazioneMario(CF);
  casella('denis@migelino.ch', { threads: [tDenis], comuni: c, classificazione: CONFERMA, estrazione: e }).amb.ctx.esegui();
  casella('collega2@migelino.ch', { threads: [tMarco], comuni: c, classificazione: CONFERMA, estrazione: e }).amb.ctx.esegui();
  assert.equal(c.shopify.operazioni.filter((o) => o.nome === 'CreaCliente').length, 1);
  assert.ok(tDenis.etichette.has('Anagrafica/✅ Creata'));
  assert.ok(tMarco.etichette.has('Anagrafica/✅ Completata'));
});

test('Cliente creato nel frattempo (email già usata): rilegge e completa invece di duplicare', () => {
  let dopoErrore = false;
  const esistente = {
    id: 'gid://shopify/Customer/55', firstName: 'Mario', lastName: 'Rossi', note: '', tags: [], numberOfOrders: '0',
    defaultEmailAddress: { emailAddress: 'mario.rossi@example.com' }, defaultPhoneNumber: null, defaultAddress: null, addressesV2: { nodes: [] }
  };
  const c = comuni({
    errori: { CreaCliente: [{ field: ['email'], message: 'Email has already been taken' }] },
    clienti: (ops) => {
      dopoErrore = dopoErrore || ops.some((o) => o.nome === 'CreaCliente');
      return dopoErrore ? [esistente] : [];
    }
  });
  const t = new ThreadFinto('t1', [
    new MessaggioFinto({ id: 'a', da: 'Denis <denis@migelino.ch>', a: 'mario.rossi@example.com', data: minutiFa(300), corpo: 'Proposta' }),
    new MessaggioFinto({ id: 'b', da: PAZIENTE, data: minutiFa(10), corpo: 'Confermo l\'ordine, spedite a casa.' })
  ]);
  casella('denis@migelino.ch', { threads: [t], comuni: c, classificazione: CONFERMA, estrazione: estrazioneMario(CF) }).amb.ctx.esegui();
  const ops = c.shopify.operazioni.map((o) => o.nome);
  assert.deepEqual(ops, ['CercaClienti', 'CreaCliente', 'CercaClienti', 'AggiornaCliente', 'CreaIndirizzo', 'AggiungiTag']);
  assert.ok(t.etichette.has('Anagrafica/✅ Completata'));
});

test('Paziente che scrive a Silvia rispondendo a una mail di Denis: supera il filtro anche senza mail inviate da Silvia', () => {
  const c = comuni();
  const t = new ThreadFinto('s9', [
    new MessaggioFinto({ id: 's9-a', da: PAZIENTE, a: 'collega1@migelino.ch', data: minutiFa(5),
      corpo: 'Confermo l\'ordine.\n\nIl giorno lun 28 set 2026 alle ore 11:17 Denis <denis@migelino.ch> ha scritto:\n> proposta' })
  ]);
  const silvia = casella('collega1@migelino.ch', { threads: [t], comuni: c,
    classificazione: { esito: 'NON_CONFERMA', tipo: 'NESSUNO', probabilita: 0.2, frase_chiave: '', motivazione: '' }, estrazione: null });
  silvia.amb.ctx.esegui();
  assert.deepEqual(silvia.richieste, ['riconoscimento']);
});

test('Memoria per casella: ultimo controllo e messaggi elaborati separati, stato pazienti condiviso', () => {
  const c = comuni();
  const t = new ThreadFinto('x', [
    new MessaggioFinto({ id: 'x-a', da: 'Denis <denis@migelino.ch>', a: 'mario.rossi@example.com', data: minutiFa(300), corpo: 'Proposta' }),
    new MessaggioFinto({ id: 'x-b', da: PAZIENTE, data: minutiFa(10), corpo: 'Confermo, ecco i dati.' })
  ]);
  const denis = casella('denis@migelino.ch', { threads: [t], comuni: c, classificazione: CONFERMA,
    estrazione: estrazioneMario(CF, { spedizione: spedizioneVuota() }) });
  denis.amb.ctx.esegui();
  assert.ok(denis.amb.proprietaUtente.getProperty('m_x-b'));
  assert.equal(c.proprieta.getProperty('m_x-b'), null);
  assert.ok(Number(denis.amb.proprietaUtente.getProperty('ULTIMO_CONTROLLO')) >= ORA);
  const statoPaziente = JSON.parse(c.proprieta.getProperty('p_mario.rossi@example.com'));
  assert.equal(statoPaziente.esito, 'DATI_MANCANTI');
  assert.equal(statoPaziente.casella, 'denis@migelino.ch');
  assert.ok(statoPaziente.estrazione.residenza.via); // dati parziali conservati per il completamento
  const caselle = JSON.parse(JSON.stringify(denis.amb.ctx.Stato.elencoCaselle()));
  assert.equal(caselle[0].email, 'denis@migelino.ch');
  assert.ok(caselle[0].ultimoGiro >= ORA);
});

test('Migrazione: l\'ultimo controllo della versione a casella singola viene ripreso', () => {
  const amb = creaAmbiente({ proprieta: { ULTIMO_CONTROLLO: '1234567890000' } });
  assert.equal(amb.ctx.Stato.ultimoControllo(), 1234567890000);
  assert.equal(amb.proprieta.getProperty('ULTIMO_CONTROLLO'), null);
});

// ------------------------------------------------------------------ unione dei dati parziali
test('Unione: per ogni campo vince la lettura più sicura; la spedizione nuova sostituisce quella mancante', () => {
  const { ctx } = creaAmbiente();
  const vecchia = estrazioneMario(CF, { spedizione: spedizioneVuota(), telefono: campo('333 1234567', 0.7, 'FIRMA_EMAIL') });
  const nuova = estrazioneMario('', {
    codice_fiscale: campo('', 0, 'NESSUNA'), telefono: campo('333 1234567', 0.95, 'FIRMA_EMAIL'),
    residenza: indirizzo({ confidenza: 0, fonte: 'NESSUNA', paese: '' }), paziente_identificato: 'INCERTO',
    spedizione: spedizioneVuota({ stessa_della_residenza: 'SI' })
  });
  const u = JSON.parse(JSON.stringify(ctx.Estrattore.unisci(vecchia, nuova)));
  assert.equal(u.codice_fiscale.valore, CF);
  assert.equal(u.telefono.confidenza, 0.95);
  assert.equal(u.residenza.via, 'VIA APPIA NUOVA');
  assert.equal(u.spedizione.stessa_della_residenza, 'SI');
  assert.equal(u.paziente_identificato, 'SI');
});

test('Unione: nomi diversi (es. un familiare) = nessuna unione', () => {
  const { ctx } = creaAmbiente();
  const vecchia = estrazioneMario(CF);
  const nuova = estrazioneMario('', { nome: campo('ANNA'), cognome: campo('BIANCHI'), residenza: indirizzo({ confidenza: 0, fonte: 'NESSUNA', paese: '' }) });
  const u = JSON.parse(JSON.stringify(ctx.Estrattore.unisci(vecchia, nuova)));
  assert.equal(u.nome.valore, 'ANNA');
  assert.equal(u.residenza.via, '');
});

test('Compattazione: la memoria condivisa resta sotto i 9 KB', () => {
  const { ctx } = creaAmbiente();
  const e = estrazioneMario(CF, { note: 'x'.repeat(5000) });
  e.residenza.evidenza = 'y'.repeat(3000);
  e.documenti = Array.from({ length: 20 }, (_, i) => ({ file: 'documento-' + i + '.jpg', tipo: 'ALTRO', leggibile: true, intestatario: 'Mario' }));
  assert.ok(JSON.stringify(ctx.Estrattore.compatta(e)).length < 8500);
});
