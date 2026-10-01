// Test dei client verso Claude e Shopify (API simulate) e del riconoscimento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente, PERSONE_FINTE } from './_ambiente.mjs';
import { SERVIZI_BASE, PROPRIETA_BASE, rispostaClaude, shopifyFinto, fogliFinti } from './_servizi_finti.mjs';
import { estrazioneMario, SPEDIZIONE_MOGLIE } from './_estrazioni.mjs';

const puro = (x) => JSON.parse(JSON.stringify(x));

// ------------------------------------------------------------------ Claude
test('Claude: richiesta con schema JSON, sforzo, fallback e cache del prompt di sistema', () => {
  const amb = creaAmbiente({ proprieta: PROPRIETA_BASE, globali: SERVIZI_BASE, fetch: () => rispostaClaude({ ok: true }) });
  const r = amb.ctx.Claude.chiama({
    sistema: 'Sistema', contenuti: [amb.ctx.Claude.testo('ciao')],
    schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    sforzo: 'low', maxToken: 1000
  });
  assert.deepEqual(puro(r.dati), { ok: true });
  const { url, parametri } = amb.chiamate[0];
  assert.equal(url, 'https://api.anthropic.com/v1/messages');
  assert.equal(parametri.headers['x-api-key'], 'chiave-finta');
  assert.equal(parametri.headers['anthropic-version'], '2023-06-01');
  assert.equal(parametri.headers['anthropic-beta'], 'server-side-fallback-2026-07-01');
  const corpo = JSON.parse(parametri.payload);
  assert.equal(corpo.model, 'modello-finto');
  assert.equal(corpo.fallbacks, 'default');
  assert.equal(corpo.output_config.effort, 'low');
  assert.equal(corpo.output_config.format.type, 'json_schema');
  assert.deepEqual(corpo.system[0].cache_control, { type: 'ephemeral' });
  assert.equal(corpo.thinking, undefined);
});

test('Claude: riprova su sovraccarico (529) e poi riesce', () => {
  const amb = creaAmbiente({
    proprieta: PROPRIETA_BASE, globali: SERVIZI_BASE,
    fetch: (_u, _p, n) => (n === 1 ? { codice: 529, corpo: { error: { type: 'overloaded_error' } } } : rispostaClaude({ ok: true }))
  });
  const r = amb.ctx.Claude.chiama({ sistema: 's', contenuti: [], schema: {}, sforzo: 'low', maxToken: 100 });
  assert.equal(r.dati.ok, true);
  assert.equal(amb.chiamate.length, 2);
});

test('Claude: timeout di rete -> riprova con sforzo basso', () => {
  const amb = creaAmbiente({
    proprieta: PROPRIETA_BASE, globali: SERVIZI_BASE,
    fetch: (_u, _p, n) => { if (n === 1) throw new Error('Timeout'); return rispostaClaude({ ok: true }); }
  });
  const r = amb.ctx.Claude.chiama({ sistema: 's', contenuti: [], schema: {}, sforzo: 'medium', maxToken: 100 });
  assert.equal(r.dati.ok, true);
  assert.equal(JSON.parse(amb.chiamate[0].parametri.payload).output_config.effort, 'medium');
  assert.equal(JSON.parse(amb.chiamate[1].parametri.payload).output_config.effort, 'low');
});

test('Claude: se i fallback non sono supportati riprova senza', () => {
  const amb = creaAmbiente({
    proprieta: PROPRIETA_BASE, globali: SERVIZI_BASE,
    fetch: (_u, p) => (JSON.parse(p.payload).fallbacks ? { codice: 400, corpo: { error: { message: 'fallbacks: not supported' } } } : rispostaClaude({ ok: true }))
  });
  amb.ctx.Claude.chiama({ sistema: 's', contenuti: [], schema: {}, sforzo: 'low', maxToken: 100 });
  assert.equal(amb.chiamate.length, 2);
  assert.equal(amb.chiamate[1].parametri.headers['anthropic-beta'], undefined);
});

test('Claude: rifiuto e risposta troncata sono errori', () => {
  for (const stop of ['refusal', 'max_tokens']) {
    const amb = creaAmbiente({ proprieta: PROPRIETA_BASE, globali: SERVIZI_BASE, fetch: () => rispostaClaude({}, stop) });
    assert.throws(() => amb.ctx.Claude.chiama({ sistema: 's', contenuti: [], schema: {}, sforzo: 'low', maxToken: 100 }));
  }
});

test('Claude: senza chiave API errore chiaro', () => {
  const amb = creaAmbiente({ proprieta: {}, globali: SERVIZI_BASE, fetch: () => rispostaClaude({}) });
  assert.throws(() => amb.ctx.Claude.chiama({ sistema: 's', contenuti: [], schema: {}, sforzo: 'low', maxToken: 100 }), /Configura/);
});

// ------------------------------------------------------------------ Riconoscimento
test('Riconoscimento: servono esito CONFERMA e probabilità sopra soglia', () => {
  const { ctx } = creaAmbiente();
  const c = (esito, probabilita) => ctx.Classificatore.categoria({ esito, probabilita }, 0.85);
  assert.equal(c('CONFERMA', 0.97), 'CONFERMA');
  assert.equal(c('CONFERMA', 0.8), 'DUBBIA');
  assert.equal(c('DUBBIA', 0.95), 'DUBBIA');
  assert.equal(c('DUBBIA', 0.4), 'NON_CONFERMA');
  assert.equal(c('NON_CONFERMA', 0.7), 'NON_CONFERMA');
});

test('Riconoscimento: la trascrizione evidenzia l\'ultimo messaggio', () => {
  const { ctx } = creaAmbiente();
  const t = ctx.Classificatore.trascrizione({
    oggetto: 'Preventivo',
    messaggi: [
      { data: '28/09/2026 11:00', ruolo: 'MIGELINO', nome: 'Operatore', testo: 'Per procedere ci invii il documento', allegati: ['preventivo.pdf'] },
      { data: '28/09/2026 15:00', ruolo: 'PAZIENTE', nome: 'Mario Rossi', testo: 'Ecco il preventivo firmato', allegati: ['firmato.pdf'] }
    ]
  });
  assert.match(t, /\[2\] 28\/09\/2026 15:00 - PAZIENTE \(Mario Rossi\)  <<< ULTIMO MESSAGGIO/);
  assert.match(t, /Allegati: preventivo\.pdf/);
});

test('Riconoscimento: il prompt contiene le regole di taratura validate', () => {
  const { ctx } = creaAmbiente();
  const s = ctx.Classificatore.SISTEMA;
  assert.match(s, /consenso al trattamento dei dati \(GDPR\)/);
  assert.match(s, /Accetto la prova e allego i documenti richiesti/);
  assert.equal((s.match(/^\d+\. "/gm) || []).length + (s.match(/^\d+\. (Oggetto|Dopo)/gm) || []).length, 10);
});

// ------------------------------------------------------------------ Estrazione
test('Estrazione: allegati PDF e immagini come blocchi, poi le mail', () => {
  const { ctx } = creaAmbiente();
  const blocchi = puro(ctx.Estrattore.contenuti({
    mittente: { nome: 'Mario Rossi', email: 'mario@example.com' }, tipoConferma: 'ACQUISTO', dataConferma: '2026-09-30',
    allegati: [
      { nome: 'ci.pdf', mimeType: 'application/pdf', base64: 'QUJD', data: '30/09/2026', ruolo: 'PAZIENTE' },
      { nome: 'retro.jpg', mimeType: 'image/jpeg', base64: 'REVG', data: '30/09/2026', ruolo: 'PAZIENTE' }
    ],
    nonLeggibili: ['foto.heic'],
    messaggi: [{ data: '30/09/2026', ruolo: 'PAZIENTE', nome: 'Mario', testo: 'Confermo', oggetto: 'Re: offerta' }]
  }));
  assert.deepEqual(blocchi.map((b) => b.type), ['text', 'text', 'document', 'text', 'image', 'text']);
  assert.equal(blocchi[2].source.media_type, 'application/pdf');
  assert.equal(blocchi[4].source.media_type, 'image/jpeg');
  assert.match(blocchi[0].text, /foto\.heic/);
  assert.match(blocchi[5].text, /Confermo/);
});

test('Estrazione: lo schema rispetta i vincoli degli output strutturati', () => {
  const { ctx } = creaAmbiente();
  const controlla = (nodo) => {
    if (!nodo || typeof nodo !== 'object') return;
    if (nodo.type === 'object') {
      assert.equal(nodo.additionalProperties, false);
      assert.deepEqual([...nodo.required].sort(), Object.keys(nodo.properties).sort());
    }
    for (const k of ['minimum', 'maximum', 'minLength', 'maxLength']) assert.equal(nodo[k], undefined);
    Object.values(nodo).forEach(controlla);
  };
  controlla(puro(ctx.Estrattore.SCHEMA));
  controlla(puro(ctx.Classificatore.SCHEMA));
});

// ------------------------------------------------------------------ Shopify
function ambienteShopify(opzioni) {
  const finto = shopifyFinto(opzioni);
  const amb = creaAmbiente({ proprieta: PROPRIETA_BASE, globali: SERVIZI_BASE, fetch: (u, p) => finto.risposta(u, p) });
  return { ...amb, finto };
}

function pianoNuovo(ctx, sovrascritture = {}) {
  const cf = ctx.CodiceFiscale.calcola(PERSONE_FINTE.mario);
  return ctx.Decisione.valuta({
    estrazione: estrazioneMario(cf, sovrascritture), email: 'mario.rossi@example.com', clienteEsistente: null,
    soglia: 0.85, tipoConferma: 'ACQUISTO', dataConferma: '2026-09-30'
  });
}

test('Shopify: crea cliente e indirizzi (predefinito = spedizione) con token client credentials', () => {
  const { ctx, finto, chiamate } = ambienteShopify();
  const r = ctx.Shopify.eseguiPiano(pianoNuovo(ctx, { spedizione: SPEDIZIONE_MOGLIE }));
  assert.equal(chiamate[0].url, 'https://negozio-finto.myshopify.com/admin/oauth/access_token');
  assert.equal(chiamate[0].parametri.payload.grant_type, 'client_credentials');
  assert.deepEqual(finto.operazioni.map((o) => o.nome), ['CreaCliente', 'CreaIndirizzo', 'CreaIndirizzo']);
  assert.equal(finto.operazioni[1].variables.setAsDefault, true);
  assert.equal(finto.operazioni[2].variables.setAsDefault, false);
  assert.ok(finto.operazioni.every((o) => o.token === 'token-finto'));
  assert.equal(r.url, 'https://admin.shopify.com/store/negozio-finto/customers/777');
  assert.match(chiamate[1].url, /\/admin\/api\/2026-07\/graphql\.json$/);
});

test('Shopify: se un indirizzo viene rifiutato il cliente appena creato viene eliminato', () => {
  const { ctx, finto } = ambienteShopify({ errori: { CreaIndirizzo: [{ field: ['address', 'zip'], message: 'Zip is invalid' }] } });
  assert.throws(() => ctx.Shopify.eseguiPiano(pianoNuovo(ctx)), /non salvato/);
  assert.deepEqual(finto.operazioni.map((o) => o.nome), ['CreaCliente', 'CreaIndirizzo', 'EliminaCliente']);
});

test('Shopify: telefono già usato da un altro cliente -> crea senza telefono e avvisa', () => {
  const { ctx, finto } = ambienteShopify({ errori: { CreaCliente: [{ field: ['phone'], message: 'Phone has already been taken' }] } });
  const r = ctx.Shopify.eseguiPiano(pianoNuovo(ctx));
  const creazioni = finto.operazioni.filter((o) => o.nome === 'CreaCliente');
  assert.equal(creazioni.length, 2);
  assert.equal(creazioni[1].variables.input.phone, undefined);
  assert.match(r.avvisi[0], /già usato/);
});

test('Shopify: provincia rifiutata -> prova la sigla equivalente (Sardegna)', () => {
  const { ctx, finto } = ambienteShopify({ errori: { CreaIndirizzo: [{ field: ['address', 'provinceCode'], message: 'Province is invalid' }] } });
  const piano = pianoNuovo(ctx);
  piano.indirizzi[0].address.provinceCode = 'SU';
  ctx.Shopify.eseguiPiano(piano);
  const indirizzi = finto.operazioni.filter((o) => o.nome === 'CreaIndirizzo');
  assert.deepEqual(indirizzi.map((o) => o.variables.address.provinceCode), ['SU', 'CI']);
});

test('Shopify: ricerca cliente per email esatta e conversione degli indirizzi', () => {
  const nodo = {
    id: 'gid://shopify/Customer/5', firstName: 'Mario', lastName: 'Rossi', note: '', tags: [], numberOfOrders: '1',
    defaultEmailAddress: { emailAddress: 'Mario.Rossi@example.com' }, defaultPhoneNumber: { phoneNumber: '+393331234567' },
    defaultAddress: { id: 'gid://shopify/MailingAddress/1' },
    addressesV2: { nodes: [{ id: 'gid://shopify/MailingAddress/1', firstName: 'Mario', lastName: 'Rossi', company: 'XXX', address1: 'Via Appia Nuova 100',
      address2: null, city: 'Roma', provinceCode: 'RM', zip: '00183', countryCodeV2: 'IT', phone: null }] }
  };
  const altro = { ...nodo, id: 'gid://shopify/Customer/6', defaultEmailAddress: { emailAddress: 'altro@example.com' } };
  const { ctx, finto } = ambienteShopify({ clienti: [altro, nodo] });
  const c = puro(ctx.Shopify.cercaCliente('mario.rossi@example.com'));
  assert.equal(finto.operazioni[0].variables.q, 'email:"mario.rossi@example.com"');
  assert.equal(c.id, 'gid://shopify/Customer/5');
  assert.equal(c.indirizzi[0].interno.via, 'Via Appia Nuova');
  assert.equal(c.indirizzi[0].interno.civico, '100');
  assert.equal(c.ordini, 1);
});

test('Shopify: aggiornamento di un cliente esistente con tag aggiunto (senza sovrascrivere i tag)', () => {
  const { ctx, finto } = ambienteShopify();
  ctx.Shopify.eseguiPiano({
    esito: 'AGGIORNA', clienteId: 'gid://shopify/Customer/5', tag: 'anagrafica-auto',
    cliente: { id: 'gid://shopify/Customer/5', note: 'nota' },
    indirizzi: [{ azione: 'AGGIORNA', addressId: 'gid://shopify/MailingAddress/1', ruolo: 'RESIDENZA', predefinito: false, address: { company: 'XXX' } }]
  });
  assert.deepEqual(finto.operazioni.map((o) => o.nome), ['AggiornaCliente', 'AggiornaIndirizzo', 'AggiungiTag']);
  assert.deepEqual(puro(finto.operazioni[2].variables.tags), ['anagrafica-auto']);
});

// ------------------------------------------------------------------ Shopify: accesso e verifica
const { SHOPIFY_CLIENT_ID: _id, SHOPIFY_CLIENT_SECRET: _segreto, ...PROPRIETA_SENZA_CREDENZIALI } = PROPRIETA_BASE;

function ambienteShopifyCon(proprieta, opzioni) {
  const finto = shopifyFinto(opzioni);
  const amb = creaAmbiente({ proprieta, globali: SERVIZI_BASE, fetch: (u, p) => finto.risposta(u, p) });
  return { ...amb, finto };
}

const dettagli = (e) => [].concat(e.dettagli || []).join(' | ');

test('Shopify: con Client ID/Secret il token fisso viene ignorato (es. Client secret incollato per errore)', () => {
  const { ctx, finto, chiamate } = ambienteShopifyCon({ ...PROPRIETA_BASE, SHOPIFY_ACCESS_TOKEN: 'shpss_messo-per-errore' });
  ctx.Shopify.cercaCliente('mario.rossi@example.com');
  assert.match(chiamate[0].url, /\/admin\/oauth\/access_token$/);
  assert.equal(finto.operazioni[0].token, 'token-finto');
});

test('Shopify: senza Client ID/Secret usa il token fisso, e se non è valido lo dice', () => {
  const ok = ambienteShopifyCon({ ...PROPRIETA_SENZA_CREDENZIALI, SHOPIFY_ACCESS_TOKEN: 'shpat_fisso' }, { tokenValidi: ['shpat_fisso'] });
  ok.ctx.Shopify.cercaCliente('mario.rossi@example.com');
  assert.equal(ok.chiamate.length, 1);
  assert.equal(ok.finto.operazioni[0].token, 'shpat_fisso');

  const ko = ambienteShopifyCon({ ...PROPRIETA_SENZA_CREDENZIALI, SHOPIFY_ACCESS_TOKEN: 'sbagliato' });
  assert.throws(() => ko.ctx.Shopify.cercaCliente('mario.rossi@example.com'),
    (e) => e.message === 'Shopify HTTP 401' && /token fisso non è valido/.test(dettagli(e)));
  assert.equal(ko.finto.operazioni.length, 1); // nessun nuovo tentativo con lo stesso token
});

test('Shopify: senza credenziali né token -> errore che spiega cosa configurare', () => {
  const { ctx } = ambienteShopifyCon(PROPRIETA_SENZA_CREDENZIALI);
  assert.throws(() => ctx.Shopify.cercaCliente('mario.rossi@example.com'), /Shopify non configurato/);
});

test('Shopify: token rifiutato (scaduto o revocato) -> ne chiede uno nuovo e riprova una volta', () => {
  const { ctx, finto, chiamate } = ambienteShopify({ rifiutaTokenUnaVolta: true });
  ctx.Shopify.cercaCliente('mario.rossi@example.com');
  assert.equal(chiamate.filter((c) => c.url.endsWith('/admin/oauth/access_token')).length, 2);
  assert.deepEqual(finto.operazioni.map((o) => o.token), ['token-finto', 'token-finto-1']);
});

test('Shopify: richiesta del token rifiutata o risposta inattesa -> spiega la causa', () => {
  const organizzazione = ambienteShopify({ rispostaToken: { codice: 400, corpo: { error: 'shop_not_permitted' } } });
  assert.throws(() => organizzazione.ctx.Shopify.cercaCliente('mario.rossi@example.com'),
    (e) => /token non ottenuto \(HTTP 400\)/.test(e.message) && /stessa organizzazione/.test(dettagli(e)));
  const credenziali = ambienteShopify({ rispostaToken: { codice: 401, corpo: { error: 'invalid_client' } } });
  assert.throws(() => credenziali.ctx.Shopify.cercaCliente('mario.rossi@example.com'), (e) => /Client secret/.test(dettagli(e)));
  const pagina = ambienteShopify({ rispostaToken: { codice: 200, corpo: '<html>login</html>' } });
  assert.throws(() => pagina.ctx.Shopify.cercaCliente('mario.rossi@example.com'), /token non ottenuto \(HTTP 200\)/);
});

test('Shopify: dominio scritto senza .myshopify.com o con https:// e percorso viene normalizzato', () => {
  for (const scritto of ['negozio-finto', 'https://Negozio-Finto.myshopify.com/admin']) {
    const { ctx, chiamate } = ambienteShopifyCon({ ...PROPRIETA_BASE, SHOPIFY_SHOP: scritto });
    ctx.Shopify.cercaCliente('mario.rossi@example.com');
    assert.equal(chiamate[0].url, 'https://negozio-finto.myshopify.com/admin/oauth/access_token');
  }
});

test('Shopify: la verifica controlla permessi e lettura dei dati protetti dei clienti', () => {
  const { ctx, finto } = ambienteShopify();
  const v = puro(ctx.Shopify.verifica());
  assert.equal(v.name, 'Negozio finto');
  assert.equal(v.modo, 'CREDENZIALI');
  assert.deepEqual(finto.operazioni.map((o) => o.nome), ['Negozio', 'ProvaClienti']);
  // write_customers comprende la lettura
  assert.equal(puro(ambienteShopify({ permessi: ['write_customers'] }).ctx.Shopify.verifica()).modo, 'CREDENZIALI');
  assert.throws(() => ambienteShopify({ permessi: ['read_customers'] }).ctx.Shopify.verifica(), /mancano i permessi write_customers/);
  assert.throws(() => ambienteShopify({ datiProtettiNegati: true }).ctx.Shopify.verifica(),
    (e) => /non può leggere i dati dei clienti/.test(e.message) && /not approved/.test(dettagli(e)));
});

// ------------------------------------------------------------------ Configurazione
test('Configura: vuoto mantiene il valore, "-" lo cancella', () => {
  const risposte = ['', 'modello-nuovo', '', '', '', '-'];
  const ui = {
    ButtonSet: { OK_CANCEL: 'OK_CANCEL' }, Button: { OK: 'OK' }, alert: () => {},
    prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => risposte.shift() ?? '' })
  };
  const amb = creaAmbiente({
    proprieta: { ...PROPRIETA_BASE, SHOPIFY_ACCESS_TOKEN: 'shpss_messo-per-errore' },
    globali: { ...SERVIZI_BASE, SpreadsheetApp: { ...fogliFinti().SpreadsheetApp, getUi: () => ui } }
  });
  amb.ctx.configura();
  assert.equal(amb.proprieta.getProperty('CLAUDE_MODEL'), 'modello-nuovo');
  assert.equal(amb.proprieta.getProperty('ANTHROPIC_API_KEY'), 'chiave-finta');
  assert.equal(amb.proprieta.getProperty('SHOPIFY_CLIENT_SECRET'), 'segreto-finto');
  assert.equal(amb.proprieta.getProperty('SHOPIFY_ACCESS_TOKEN'), null);
  assert.equal(amb.proprieta.getProperty('MODALITA'), 'OMBRA');
});
