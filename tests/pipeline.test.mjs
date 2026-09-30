// Test del flusso completo con Gmail, Fogli, Claude e Shopify simulati. Dati inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente, PERSONE_FINTE } from './_ambiente.mjs';
import {
  AllegatoFinto, MessaggioFinto, ThreadFinto, gmailFinta, fogliFinti,
  SERVIZI_BASE, PROPRIETA_BASE, rispostaClaude, shopifyFinto
} from './_servizi_finti.mjs';
import { estrazioneMario, spedizioneVuota, SPEDIZIONE_MOGLIE } from './_estrazioni.mjs';

const PAZIENTE = 'Mario Rossi <mario.rossi@example.com>';
const ORA = Date.now();
const minutiFa = (n) => new Date(ORA - n * 60000).toISOString();

function conversazioneConferma(corpoConferma, allegati = [new AllegatoFinto('documento.jpg', 'image/jpeg')]) {
  return new ThreadFinto('t1', [
    new MessaggioFinto({ id: 'm1', da: 'Operatore <info@migelino.it>', a: 'mario.rossi@example.com', data: minutiFa(300),
      oggetto: 'La nostra proposta', corpo: 'Se desidera procedere ci invii preventivo firmato, documento e indirizzo di spedizione.',
      allegati: [new AllegatoFinto('preventivo.pdf', 'application/pdf')] }),
    new MessaggioFinto({ id: 'm2', da: PAZIENTE, data: minutiFa(5), oggetto: 'Re: La nostra proposta', corpo: corpoConferma, allegati })
  ]);
}

/**
 * Prepara l'ambiente. risposte.classificazione / risposte.estrazione = oggetti restituiti da Claude.
 */
function prepara({ threads, modalita = 'OMBRA', classificazione, estrazione, clienti = [], proprieta = {} }) {
  const gmail = gmailFinta(threads);
  const fogli = fogliFinti();
  const shopify = shopifyFinto({ clienti });
  const richiesteClaude = [];
  const amb = creaAmbiente({
    proprieta: { ...PROPRIETA_BASE, MODALITA: modalita, ULTIMO_CONTROLLO: String(ORA - 3600000), ...proprieta },
    globali: { ...SERVIZI_BASE, GmailApp: gmail.GmailApp, SpreadsheetApp: fogli.SpreadsheetApp },
    fetch: (url, parametri) => {
      if (url.startsWith('https://api.anthropic.com')) {
        const corpo = JSON.parse(parametri.payload);
        const riconoscimento = /Il tuo compito: leggere la conversazione/.test(corpo.system[0].text);
        richiesteClaude.push(riconoscimento ? 'riconoscimento' : 'estrazione');
        return rispostaClaude(riconoscimento ? classificazione : estrazione);
      }
      return shopify.risposta(url, parametri);
    }
  });
  const registro = () => (fogli.fogli.get('Registro') ? fogli.fogli.get('Registro').righe.slice(1) : []);
  return { amb, gmail, shopify, richiesteClaude, registro, threads };
}

const CONFERMA = { esito: 'CONFERMA', tipo: 'ACQUISTO', probabilita: 0.97, frase_chiave: 'Ecco il preventivo firmato', motivazione: 'preventivo firmato' };
const cfMario = (ctx) => ctx.CodiceFiscale.calcola(PERSONE_FINTE.mario);

test('Modalità OMBRA: riconosce, estrae e registra la proposta senza scrivere su Shopify né etichettare', () => {
  const base = creaAmbiente();
  const threads = [conversazioneConferma('Ecco il preventivo firmato e la carta d\'identità.')];
  const p2 = prepara({ threads, classificazione: CONFERMA, estrazione: estrazioneMario(cfMario(base.ctx)) });
  p2.amb.ctx.esegui();
  assert.deepEqual(p2.richiesteClaude, ['riconoscimento', 'estrazione']);
  assert.deepEqual(p2.shopify.operazioni.map((o) => o.nome), ['CercaClienti']);
  const righe = p2.registro();
  assert.equal(righe.length, 1);
  assert.equal(righe[0][1], 'OMBRA');
  assert.equal(righe[0][2], 'Anagrafica creata (simulata)');
  assert.equal(righe[0][5], 'Mario Rossi');
  assert.match(righe[0][11], /"esito":"CREA"/);
  assert.equal(p2.threads[0].etichette.size, 0);
});

test('Modalità LIVE: crea il cliente su Shopify ed etichetta la conversazione', () => {
  const threads = [conversazioneConferma('Ecco il preventivo firmato e la carta d\'identità.')];
  const base = creaAmbiente();
  const p = prepara({ threads, modalita: 'LIVE', classificazione: CONFERMA, estrazione: estrazioneMario(cfMario(base.ctx), { spedizione: SPEDIZIONE_MOGLIE }) });
  p.amb.ctx.esegui();
  assert.deepEqual(p.shopify.operazioni.map((o) => o.nome), ['CercaClienti', 'CreaCliente', 'CreaIndirizzo', 'CreaIndirizzo']);
  assert.ok(threads[0].etichette.has('Anagrafica/✅ Creata'));
  const righe = p.registro();
  assert.equal(righe[0][2], 'Anagrafica creata');
  assert.match(righe[0][8], /admin\.shopify\.com\/store\/negozio-finto\/customers\/777/);
  assert.equal(righe[0][11], ''); // in LIVE la proposta non viene salvata nel Foglio
});

test('Dati mancanti: nulla su Shopify; quando arriva l\'indirizzo si completa senza nuovo riconoscimento', () => {
  const base = creaAmbiente();
  const cf = cfMario(base.ctx);
  const threads = [conversazioneConferma('Accetto la prova e allego il documento.')];
  const p = prepara({ threads, modalita: 'LIVE', classificazione: { ...CONFERMA, tipo: 'PROVA' }, estrazione: estrazioneMario(cf, { spedizione: spedizioneVuota() }) });
  p.amb.ctx.esegui();
  assert.deepEqual(p.shopify.operazioni.map((o) => o.nome), ['CercaClienti']);
  assert.ok(threads[0].etichette.has('Anagrafica/⚠️ Dati mancanti'));
  assert.match(p.registro()[0][9], /Mancanti: indirizzo di spedizione/);

  // Il paziente manda l'indirizzo di spedizione: nuova mail nella stessa conversazione.
  threads[0].messaggi.push(new MessaggioFinto({ id: 'm3', da: PAZIENTE, data: new Date(ORA + 60000).toISOString(),
    corpo: 'Spedite pure all\'indirizzo di residenza.' }));
  threads[0].messaggi[2].thread = threads[0];
  p.amb.proprieta.setProperty('ULTIMO_CONTROLLO', String(ORA - 1000));
  // ora l'estrazione trova la spedizione
  const estrazioneCompleta = estrazioneMario(cf);
  const p2 = prepara({ threads, modalita: 'LIVE', classificazione: { esito: 'NON_CONFERMA', tipo: 'NESSUNO', probabilita: 0.1, frase_chiave: '', motivazione: '' },
    estrazione: estrazioneCompleta, proprieta: p.amb.proprieta.getProperties() });
  p2.amb.ctx.esegui();
  assert.deepEqual(p2.richiesteClaude, ['estrazione']); // niente nuovo riconoscimento
  assert.deepEqual(p2.shopify.operazioni.map((o) => o.nome), ['CercaClienti', 'CreaCliente', 'CreaIndirizzo']);
  assert.ok(threads[0].etichette.has('Anagrafica/✅ Creata'));
  assert.ok(!threads[0].etichette.has('Anagrafica/⚠️ Dati mancanti'));
});

test('Dati mancanti completati da una mail in un\'altra conversazione: aggiorna le etichette di entrambe', () => {
  const base = creaAmbiente();
  const cf = cfMario(base.ctx);
  const t1 = conversazioneConferma('Accetto la prova e allego il documento.');
  const p = prepara({ threads: [t1], modalita: 'LIVE', classificazione: { ...CONFERMA, tipo: 'PROVA' },
    estrazione: estrazioneMario(cf, { spedizione: spedizioneVuota() }) });
  p.amb.ctx.esegui();
  assert.ok(t1.etichette.has('Anagrafica/⚠️ Dati mancanti'));

  const t2 = new ThreadFinto('t2', [new MessaggioFinto({ id: 'n1', da: PAZIENTE, data: new Date(ORA + 60000).toISOString(),
    oggetto: 'Indirizzo', corpo: 'Spedite a casa mia, stesso indirizzo della residenza.' })]);
  p.amb.proprieta.setProperty('ULTIMO_CONTROLLO', String(ORA - 1000));
  const p2 = prepara({ threads: [t1, t2], modalita: 'LIVE', classificazione: CONFERMA, estrazione: estrazioneMario(cf),
    proprieta: p.amb.proprieta.getProperties() });
  p2.amb.ctx.esegui();
  assert.deepEqual(p2.richiesteClaude, ['estrazione']);
  assert.ok(t2.etichette.has('Anagrafica/✅ Creata'));
  assert.ok(t1.etichette.has('Anagrafica/✅ Creata'));
  assert.ok(!t1.etichette.has('Anagrafica/⚠️ Dati mancanti'));
});

test('Etichetta manuale su un messaggio recente: elaborato una volta sola', () => {
  const base = creaAmbiente();
  const threads = [conversazioneConferma('Ecco i documenti.')];
  threads[0].etichette.add('Anagrafica/▶ Crea');
  const p = prepara({ threads, modalita: 'LIVE', classificazione: CONFERMA, estrazione: estrazioneMario(cfMario(base.ctx)) });
  p.amb.ctx.esegui();
  assert.deepEqual(p.richiesteClaude, ['estrazione']);
  assert.equal(p.registro().length, 1);
});

test('Consenso GDPR: riconosciuto come NON conferma, nessuna estrazione', () => {
  const threads = [conversazioneConferma('Accetto per il consenso. Come potremmo procedere con l\'ordine?', [])];
  const p = prepara({ threads, modalita: 'LIVE',
    classificazione: { esito: 'NON_CONFERMA', tipo: 'NESSUNO', probabilita: 0.15, frase_chiave: 'Accetto per il consenso', motivazione: 'consenso GDPR' },
    estrazione: null });
  p.amb.ctx.esegui();
  assert.deepEqual(p.richiesteClaude, ['riconoscimento']);
  assert.equal(p.shopify.operazioni.length, 0);
  assert.equal(p.registro()[0][2], 'Non è una conferma');
  assert.equal(threads[0].etichette.size, 0);
});

test('Conferma dubbia: etichetta "Conferma dubbia", nessuna estrazione', () => {
  const threads = [conversazioneConferma('Mi va bene il modello. Come ordino?', [])];
  const p = prepara({ threads, modalita: 'LIVE',
    classificazione: { esito: 'DUBBIA', tipo: 'ACQUISTO', probabilita: 0.65, frase_chiave: 'Come ordino?', motivazione: 'intenzione' }, estrazione: null });
  p.amb.ctx.esegui();
  assert.deepEqual(p.richiesteClaude, ['riconoscimento']);
  assert.ok(threads[0].etichette.has('Anagrafica/❓ Conferma dubbia'));
});

test('Filtro: mittenti interni, automatici o senza conversazione precedente non costano chiamate a Claude', () => {
  const sconosciuto = new ThreadFinto('t9', [new MessaggioFinto({ id: 'x1', da: 'Nuovo <nuovo@example.com>', data: minutiFa(3), corpo: 'Confermo l\'ordine' })]);
  const automatico = new ThreadFinto('t8', [new MessaggioFinto({ id: 'x2', da: 'noreply@example.com', data: minutiFa(3), corpo: 'Conferma ordine' })]);
  const interno = new ThreadFinto('t7', [new MessaggioFinto({ id: 'x3', da: 'Ufficio <ufficio@migelino.it>', data: minutiFa(3), corpo: 'Confermo' })]);
  const p = prepara({ threads: [sconosciuto, automatico, interno], modalita: 'LIVE', classificazione: CONFERMA, estrazione: null });
  p.amb.ctx.esegui();
  assert.equal(p.richiesteClaude.length, 0);
  assert.equal(p.registro().length, 0);
});

test('Etichetta manuale "▶ Crea": salta il riconoscimento e poi viene tolta', () => {
  const base = creaAmbiente();
  const threads = [conversazioneConferma('Le ho detto tutto al telefono, ecco i documenti.')];
  threads[0].etichette.add('Anagrafica/▶ Crea');
  const p = prepara({ threads, modalita: 'LIVE', classificazione: CONFERMA, estrazione: estrazioneMario(cfMario(base.ctx)),
    proprieta: { ULTIMO_CONTROLLO: String(ORA) } });
  p.amb.ctx.esegui();
  assert.deepEqual(p.richiesteClaude, ['estrazione']);
  assert.ok(!threads[0].etichette.has('Anagrafica/▶ Crea'));
  assert.ok(threads[0].etichette.has('Anagrafica/✅ Creata'));
  assert.match(p.registro()[0][10], /Richiesta manuale/);
});

test('Messaggio già elaborato: non viene rielaborato', () => {
  const base = creaAmbiente();
  const threads = [conversazioneConferma('Ecco il preventivo firmato.')];
  const p = prepara({ threads, classificazione: CONFERMA, estrazione: estrazioneMario(cfMario(base.ctx)) });
  p.amb.ctx.esegui();
  p.amb.proprieta.setProperty('ULTIMO_CONTROLLO', String(ORA - 3600000));
  p.amb.ctx.esegui();
  assert.equal(p.richiesteClaude.filter((r) => r === 'riconoscimento').length, 1);
});

test('Errore API: registrato ed etichettato, l\'esecuzione non si blocca', () => {
  const threads = [conversazioneConferma('Ecco il preventivo firmato.')];
  const p = prepara({ threads, modalita: 'LIVE', classificazione: CONFERMA, estrazione: null });
  // l'estrazione restituisce null -> errore nell'analisi dei campi
  p.amb.ctx.esegui();
  const righe = p.registro();
  assert.equal(righe[0][2], 'Errore');
  assert.ok(righe[0][12].length > 0);
  assert.ok(threads[0].etichette.has('Anagrafica/⛔ Errore'));
});
