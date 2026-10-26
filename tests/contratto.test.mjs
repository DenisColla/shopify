// Contratto di vendita: nucleo (calcoli, testi, HTML), controlli, archivio e pagina. Dati INVENTATI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { creaAmbiente, PERSONE_FINTE } from './_ambiente.mjs';
import { fogliFinti, SERVIZI_BASE, driveFinto, htmlServiceFinto, bozzeGmailFinte } from './_servizi_finti.mjs';

function ambiente(opzioni = {}) {
  const fogli = fogliFinti();
  const drive = driveFinto({ immagini: opzioni.immagini });
  const gmail = bozzeGmailFinte();
  const html = htmlServiceFinto();
  const amb = creaAmbiente({
    proprieta: opzioni.proprieta || {},
    proprietaUtente: opzioni.proprietaUtente || {},
    globali: { ...SERVIZI_BASE, ...html, SpreadsheetApp: fogli.SpreadsheetApp, DriveApp: drive.DriveApp, GmailApp: gmail.GmailApp, ...(opzioni.globali || {}) }
  });
  // Utilities del contesto: aggiunge newBlob (PDF finto) a quelle di base
  Object.assign(amb.ctx.Utilities, drive.Utilities);
  return { ...amb, fogli, drive, gmail };
}

function nucleo(ctx) {
  return ctx.contrattoNucleo(ctx.contrattoRisorse());
}

/** Gli oggetti creati nel contesto isolato hanno prototipi diversi: si confrontano per valore. */
const valore = (x) => JSON.parse(JSON.stringify(x));

/** Contratto di esempio con la stessa struttura del PDF di riferimento (persona inventata). */
function datiEsempio(ctx) {
  const m = PERSONE_FINTE.mario;
  return {
    preventivo: { numero: '2026/0001', data: '2026-09-28' },
    cliente: { titolo: 'Sig.', nome: m.nome, cognome: m.cognome, codiceFiscale: ctx.CodiceFiscale.calcola(m),
      indirizzo: 'via appia nuova 100', indirizzo2: 'Scala B', cap: '00183', comune: 'roma', provincia: 'rm', telefono: '3331234567', email: 'mario.rossi@example.com' },
    righe: [
      { descrizione: 'Oticon Intent 1 - coppia (2 apparecchi)', dettaglio: 'Colore selezionato: Honey Beige', quantita: 2, prezzo: '1.790,00', sconto: '200', etichettaSconto: 'Sconto sulla coppia', etichettaDopoSconto: 'Prezzo della coppia dopo lo sconto' },
      { descrizione: 'Oticon SmartCharger - variante per Intent', quantita: 1, prezzo: 229, omaggio: true, etichettaSconto: 'Omaggio SmartCharger - sconto integrale' }
    ],
    pagamento: { modalita: 'FINANZIAMENTO', finanziaria: 'HeyLight', rate: 12, maggiorazione: 6 },
    consegna: { diversa: false, destinatario: 'Luigi Rossi' },
    condizioni: { prova: true, garanziaMesi: 24 }
  };
}

// ------------------------------------------------------------------ nucleo
test('Formati italiani: numeri da testo e importi in euro', () => {
  const n = nucleo(creaAmbiente().ctx);
  assert.equal(n.num('3.580,00'), 3580);
  assert.equal(n.num('1.790'), 1790);
  assert.equal(n.num('1,5'), 1.5);
  assert.equal(n.num('229 €'), 229);
  assert.equal(n.num(''), 0);
  assert.equal(n.num('abc'), 0);
  assert.equal(n.euro(3580), '3.580,00 €');
  assert.equal(n.euro(-200), '- 200,00 €');
  assert.equal(n.euro(0.5), '0,50 €');
  assert.equal(n.euro(1234567.891), '1.234.567,89 €');
  assert.equal(n.dataIt('2026-09-28'), '28/09/2026');
  assert.equal(n.dataIt('28/09/2026'), '28/09/2026');
});

test('Piano rate: rate uguali arrotondate per eccesso e ultima di conguaglio, come nel PDF di riferimento', () => {
  const n = nucleo(creaAmbiente().ctx);
  const piano = n.pianoRate(3582.8, 12);
  assert.deepEqual(valore(piano), { n: 12, rata: 298.57, ultima: 298.53, uguali: false });
  assert.deepEqual(valore(n.pianoRate(1200, 12)), { n: 12, rata: 100, ultima: 100, uguali: true });
  assert.deepEqual(valore(n.pianoRate(100, 3)), { n: 3, rata: 33.34, ultima: 33.32, uguali: false });
  assert.equal(n.pianoRate(500, 1).rata, 500);
});

test('Calcolo della fornitura: sconto, omaggio e totale coincidono con il PDF di riferimento', () => {
  const ctx = creaAmbiente().ctx;
  const n = nucleo(ctx);
  const c = n.calcola(datiEsempio(ctx));
  assert.equal(c.totale, 3380);
  assert.deepEqual(valore(c.righe.map((r) => [r.testo, r.importo])), [
    ['Oticon Intent 1 - coppia (2 apparecchi)', 3580],
    ['Colore selezionato: Honey Beige', null],
    ['Sconto sulla coppia', -200],
    ['Prezzo della coppia dopo lo sconto', 3380],
    ['Oticon SmartCharger - variante per Intent', 229],
    ['Omaggio SmartCharger - sconto integrale', -229]
  ]);
  assert.deepEqual(valore(c.omaggi), [{ descrizione: 'Oticon SmartCharger - variante per Intent', valore: 229 }]);
  const p = c.pagamento;
  assert.equal(p.interessi, 202.8);
  assert.equal(p.daRimborsare, 3582.8);
  assert.deepEqual(valore(p.righe), [
    ['Modalità di pagamento concordata', 'HeyLight - 12 rate mensili.'],
    ['Importo della fornitura', '3.380,00 €'],
    ['Interessi complessivi concordati (6% dell\'importo)', '202,80 €'],
    ['Totale da rimborsare', '3.582,80 €'],
    ['Piano di pagamento', '11 rate da 298,57 € e ultima rata da 298,53 €.']
  ]);
  assert.match(p.nota, /non come TAN o TAEG/);
  assert.equal(n.sottotitoloProposto(datiEsempio(ctx)), 'Oticon Intent 1 - coppia (2 apparecchi) | Oticon SmartCharger - variante per Intent incluso gratuitamente');
  assert.match(n.notaFornituraProposta(datiEsempio(ctx)), /In omaggio: Oticon SmartCharger.*valore 229,00 €, importo addebitato 0,00 €.*Non sono previsti ulteriori addebiti di spedizione/);
});

test('Modalità di pagamento: bonifico, carta, rate Migelino, altro e acconto', () => {
  const ctx = creaAmbiente().ctx;
  const n = nucleo(ctx);
  const base = datiEsempio(ctx);
  const con = (pagamento) => n.calcola({ ...base, pagamento }).pagamento;

  const bonifico = con({ modalita: 'BONIFICO' });
  assert.equal(bonifico.righe[0][1], 'bonifico bancario anticipato.');
  assert.match(bonifico.nota, /dopo l'accredito/);

  const carta = con({ modalita: 'CARTA', acconto: 380 });
  assert.deepEqual(valore(carta.righe.slice(1)), [['Importo della fornitura', '3.380,00 €'], ['Acconto alla conferma', '380,00 €'], ['Saldo prima della spedizione', '3.000,00 €']]);

  const rate = con({ modalita: 'RATE', rate: 5 });
  assert.match(rate.righe[0][1], /5 rate mensili senza interessi/);
  assert.equal(rate.righe[rate.righe.length - 1][1], '5 rate da 676,00 €.');
  assert.match(rate.nota, /ultima rata/);

  const zero = con({ modalita: 'FINANZIAMENTO', rate: 10, maggiorazione: 0 });
  assert.equal(zero.interessi, 0);
  assert.deepEqual(valore(zero.righe[2]), ['Interessi', 'nessuno (finanziamento a tasso zero).']);
  assert.doesNotMatch(zero.nota, /TAN o TAEG/);

  const altro = con({ modalita: 'ALTRO', testo: 'Contanti alla consegna' });
  assert.equal(altro.righe[0][1], 'Contanti alla consegna');

  const finAcconto = con({ modalita: 'FINANZIAMENTO', rate: 12, maggiorazione: 6, acconto: 1000 });
  assert.equal(finAcconto.residuo, 2380);
  assert.equal(finAcconto.interessi, 142.8);
  assert.deepEqual(valore(finAcconto.righe[3]), ['Importo finanziato', '2.380,00 €']);
});

test('HTML del contratto: due pagine, dati del cliente, testi variabili e nessuna iniezione', () => {
  const ctx = creaAmbiente().ctx;
  const n = nucleo(ctx);
  const dati = datiEsempio(ctx);
  dati.cliente.indirizzo = 'Via <script>alert(1)</script> 5';
  dati.condizioni.estensione = 'Migelino Plus: 4 anni';
  dati.condizioni.note = 'Prima riga\nSeconda riga';
  dati.numero = '2026/0007';
  const html = n.html(dati, { firma: { nome: 'Operatore Finto', immagine: 'data:image/png;base64,QUJD' } });
  assert.equal((html.match(/class="pagina/g) || []).length, 2);
  assert.match(html, /Pagina 1 di 2/);
  assert.match(html, /Pagina 2 di 2/);
  assert.match(html, /Contratto n\. <b>2026\/0007<\/b>/);
  assert.match(html, /preventivo n\. <b>2026\/0001<\/b> del 28\/09\/2026/);
  assert.match(html, /Sig\. Mario Rossi/);
  assert.match(html, /Via &lt;script&gt;alert\(1\)&lt;\/script&gt; 5/);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /TOTALE CONTRATTO - IVA INCLUSA<\/td><td class="importo">3\.380,00 €/);
  assert.match(html, /Nome destinatario: Luigi Rossi/);
  assert.match(html, /compreso l'omaggio/);
  assert.match(html, /Estensione concordata: Migelino Plus: 4 anni\./);
  assert.match(html, /Condizioni particolari\.<\/b> Prima riga<br>Seconda riga/);
  assert.match(html, /dall'approvazione del finanziamento/);
  assert.match(html, /<img src="data:image\/png;base64,QUJD" alt="Firma">/);
  assert.match(html, /Operatore Finto/);
  assert.match(html, /Data di sottoscrizione: ____/);
  assert.match(html, /Codice fiscale:<\/b> <b>RSSMRA50C15H501G/);
  assert.doesNotMatch(html, /assegnato alla generazione/);

  const anteprima = n.html({ ...dati, numero: '' }, { anteprima: true });
  assert.match(anteprima, /assegnato alla generazione del PDF/);
  assert.match(anteprima, /box-shadow/);
  assert.doesNotMatch(html, /box-shadow/);

  const senzaProva = n.html({ ...dati, condizioni: { prova: false, garanziaMesi: 36 }, pagamento: { modalita: 'BONIFICO' } });
  assert.match(senzaProva, /Non è prevista una prova convenzionale/);
  assert.match(senzaProva, /36 mesi dalla consegna, di cui 24 di garanzia legale/);
  assert.match(senzaProva, /dall'accredito/);
});

test('Normalizzazione: dati parziali, numeri come testo e valori non validi non rompono nulla', () => {
  const n = nucleo(creaAmbiente().ctx);
  const d = n.normalizza({ cliente: { nome: '  Anna ', provincia: 'milano', cap: '201 00', codiceFiscale: 'bnc-hnn' },
    righe: [{ descrizione: 'X', quantita: '0', prezzo: '-5', sconto: 'abc' }, null], pagamento: { modalita: 'inesistente', rate: 'x', maggiorazione: '' },
    condizioni: { garanziaMesi: 'nessuna' } });
  assert.equal(d.cliente.nome, 'Anna');
  assert.equal(d.cliente.provincia, 'MI');
  assert.equal(d.cliente.cap, '20100');
  assert.equal(d.cliente.codiceFiscale, 'BNCHNN');
  assert.deepEqual(valore(d.righe[0]), { descrizione: 'X', dettaglio: '', quantita: 1, prezzo: 0, sconto: 0, etichettaSconto: '', etichettaDopoSconto: '', omaggio: false });
  assert.equal(d.pagamento.modalita, 'BONIFICO');
  assert.equal(d.pagamento.rate, 12);
  assert.equal(d.pagamento.maggiorazione, 6);
  assert.equal(d.condizioni.garanziaMesi, 24);
  assert.equal(n.calcola({}).totale, 0);
  assert.match(n.html({}), /CONTRATTO DI VENDITA/);
});

// --------------------------------------------------------------- controlli
test('Controlli: errori bloccanti su dati mancanti o incoerenti', () => {
  const ctx = creaAmbiente().ctx;
  const r = ctx.ContrattoControlli.valida({ cliente: { codiceFiscale: 'RSSMRA50C15H501X', cap: '20100', provincia: 'RM', comune: 'Roma' }, righe: [] });
  assert.ok(r.errori.includes('Nome del cliente mancante'));
  assert.ok(r.errori.includes('Cognome del cliente mancante'));
  assert.ok(r.errori.some((e) => /Codice fiscale .* non valido/.test(e)));
  assert.ok(r.errori.includes('indirizzo mancante'));
  assert.ok(r.errori.some((e) => /CAP 20100 non compatibile con la provincia RM/.test(e)));
  assert.ok(r.errori.includes('Inserisci almeno una voce di fornitura'));

  const zero = ctx.ContrattoControlli.valida({ cliente: { nome: 'A', cognome: 'B', indirizzo: 'Via Roma 1', cap: '00100', comune: 'Roma', provincia: 'RM' },
    righe: [{ descrizione: 'Solo omaggio', prezzo: 100, omaggio: true }], pagamento: { modalita: 'ALTRO' } });
  assert.ok(zero.errori.includes('Il totale del contratto è pari a zero'));
  assert.ok(zero.errori.includes('Descrivi la modalità di pagamento (campo "Altro")'));

  const rate = ctx.ContrattoControlli.valida({ cliente: { nome: 'A', cognome: 'B', indirizzo: 'Via Roma 1', cap: '00100', comune: 'Roma', provincia: 'RM' },
    righe: [{ descrizione: 'X', prezzo: 1000 }], pagamento: { modalita: 'RATE', rate: 1, acconto: 1000 } });
  assert.ok(rate.errori.includes('Numero di rate non valido (minimo 2)'));
  assert.ok(rate.errori.some((e) => /acconto è pari o superiore/.test(e)));
});

test('Controlli: normalizza nomi, comune, telefono e segnala avvisi senza bloccare', () => {
  const ctx = creaAmbiente().ctx;
  const dati = datiEsempio(ctx);
  dati.cliente.nome = 'MARIO';
  dati.cliente.cognome = 'de angelis';
  dati.cliente.codiceFiscale = ctx.CodiceFiscale.calcola(PERSONE_FINTE.mario); // cognome Rossi: non coerente con De Angelis
  dati.cliente.telefono = '+39 333 1234567';
  dati.cliente.email = 'non-valida';
  dati.preventivo.data = '28/09/2026';
  dati.consegna = { diversa: true, indirizzo: 'VIA DEI GLICINI 14/B', cap: '20121', comune: 'MILANO', provincia: 'mi', destinatario: 'luigi ROSSI' };
  const r = ctx.ContrattoControlli.valida(dati);
  assert.deepEqual(valore(r.errori), []);
  assert.equal(r.dati.cliente.nome, 'Mario');
  assert.equal(r.dati.cliente.cognome, 'De Angelis');
  assert.equal(r.dati.cliente.indirizzo, 'Via Appia Nuova 100');
  assert.equal(r.dati.cliente.comune, 'Roma');
  assert.equal(r.dati.cliente.provincia, 'RM');
  assert.equal(r.dati.cliente.telefono, '333 123 4567');
  assert.equal(r.dati.preventivo.data, '2026-09-28');
  assert.equal(r.dati.consegna.indirizzo, 'Via dei Glicini 14/B');
  assert.equal(r.dati.consegna.comune, 'Milano');
  assert.equal(r.dati.consegna.destinatario, 'Luigi Rossi');
  assert.equal(r.totale, 3380);
  assert.ok(r.avvisi.some((a) => /codice fiscale non corrisponde/.test(a)));
  assert.ok(r.avvisi.some((a) => /E-mail "non-valida"/.test(a)));
  assert.ok(!r.avvisi.some((a) => /Telefono/.test(a)));

  const pulito = ctx.ContrattoControlli.valida(datiEsempio(ctx));
  assert.deepEqual(valore(pulito.errori), []);
  assert.deepEqual(valore(pulito.avvisi), []);
  assert.equal(ctx.ContrattoControlli.dataIso('31/02/2026'), null);
  assert.equal(ctx.ContrattoControlli.dataIso('1/2/2026'), '2026-02-01');
  assert.equal(ctx.ContrattoControlli.telefonoLeggibile('+390612345678'), '+39 0612345678');
});

// ---------------------------------------------------------------- archivio
test('Numero progressivo per anno, sotto blocco, con azzeramento al cambio di anno', () => {
  const { ctx, proprieta } = ambiente({ proprieta: { CONTRATTO_ULTIMO_NUMERO: '2025/0041' } });
  assert.equal(ctx.ContrattoArchivio.prossimoNumero(new Date('2026-01-05T10:00:00Z')), '2026/0001');
  assert.equal(ctx.ContrattoArchivio.prossimoNumero(new Date('2026-03-05T10:00:00Z')), '2026/0002');
  assert.equal(proprieta.getProperty('CONTRATTO_ULTIMO_NUMERO'), '2026/0002');
  const lento = ambiente({ proprieta: { CONTRATTO_ULTIMO_NUMERO: '2026/9999' } }).ctx;
  assert.equal(lento.ContrattoArchivio.prossimoNumero(new Date('2026-06-01T10:00:00Z')), '2026/10000');
});

test('Firma dell\'operatore: nome e immagine da Drive nelle proprietà utente; link di Drive accettati', () => {
  const { ctx } = ambiente({ immagini: { 'firma-denis': { tipo: 'image/png', byte: Buffer.from('PNGFINTO') } } });
  assert.equal(ctx.ContrattoArchivio.idDrive('https://drive.google.com/file/d/firma-denis-1234/view?usp=sharing'), 'firma-denis-1234');
  assert.equal(ctx.ContrattoArchivio.idDrive('https://drive.google.com/drive/folders/cartella-xyz-123'), 'cartella-xyz-123');
  assert.equal(ctx.ContrattoArchivio.idDrive('https://drive.google.com/open?id=abc123456789'), 'abc123456789');
  const f = ctx.ContrattoArchivio.impostaFirma('Denis Finto', 'firma-denis');
  assert.equal(f.nome, 'Denis Finto');
  assert.equal(f.immagine, 'data:image/png;base64,' + Buffer.from('PNGFINTO').toString('base64'));
  const rotta = ctx.ContrattoArchivio.impostaFirma(null, 'non-esiste');
  assert.equal(rotta.immagine, '');
  assert.match(rotta.errore, /Firma non leggibile da Drive/);
  const tolta = ctx.ContrattoArchivio.impostaFirma('-', '-');
  assert.deepEqual(valore([tolta.nome, tolta.immagine, tolta.errore]), ['', '', '']);
});

test('Genera: PDF su Drive in Contratti/anno con nome convenzionale, riga nel foglio, bozza Gmail, numero assegnato', () => {
  const amb = ambiente({ immagini: { 'firma-1': { tipo: 'image/png', byte: Buffer.from('PNG') } }, proprietaUtente: { FIRMATARIO_NOME: 'Operatore Finto', FIRMA_FILE_ID: 'firma-1' } });
  const { ctx, fogli, drive, gmail, proprieta } = amb;
  const esito = ctx.ContrattoArchivio.genera(datiEsempio(ctx), { bozzaEmail: true });
  assert.equal(esito.numero, new Date().getFullYear() + '/0001');
  assert.equal(esito.totale, 3380);
  assert.deepEqual(valore(esito.avvisi), []);
  assert.match(esito.pdfNome, /^Rossi_Contratto_Mario_\d{4}-\d{2}-\d{2}\.pdf$/);
  assert.match(esito.pdfUrl, /^https:\/\/drive\.google\.com\/file\/d\//);
  const file = [...drive.file.values()].find((f) => f.nome === esito.pdfNome);
  assert.ok(file, 'file creato su Drive');
  assert.equal(file.cartella.getName(), String(new Date().getFullYear()));
  assert.ok(proprieta.getProperty('CONTRATTI_CARTELLA_ID'), 'cartella Contratti memorizzata');
  const cartellaContratti = drive.cartelle.get(proprieta.getProperty('CONTRATTI_CARTELLA_ID'));
  assert.equal(cartellaContratti.getName(), 'Contratti');
  // il PDF è stato prodotto dall'HTML completo con la firma
  const htmlInviato = file.byte.toString();
  assert.match(htmlInviato, /Contratto n\. <b>\d{4}\/0001<\/b>/);
  assert.match(htmlInviato, /data:image\/png;base64,UE5H/);
  assert.match(htmlInviato, /Operatore Finto/);
  // riga nel foglio Contratti
  const righe = fogli.fogli.get('Contratti').righe;
  assert.deepEqual(valore(righe[0]), valore(ctx.ContrattoArchivio.INTESTAZIONI));
  const r = righe[1];
  assert.equal(r[1], esito.numero);
  assert.equal(r[2], 'operatore@example.com');
  assert.equal(r[3], 'Sig. Mario Rossi');
  assert.equal(r[6], 3380);
  assert.match(r[7], /Finanziamento/);
  assert.equal(r[8], esito.pdfUrl);
  assert.equal(r[11], 'Generato');
  assert.equal(JSON.parse(r[12]).numero, esito.numero);
  // bozza Gmail con allegato, non inviata
  assert.equal(gmail.bozze.length, 1);
  assert.equal(gmail.bozze[0].a, 'mario.rossi@example.com');
  assert.match(gmail.bozze[0].oggetto, /Contratto di vendita n\. \d{4}\/0001/);
  assert.match(gmail.bozze[0].corpo, /Gentile Sig\. Rossi/);
  assert.equal(gmail.bozze[0].opzioni.attachments[0].getName(), esito.pdfNome);
  assert.match(esito.bozzaUrl, /#drafts\/msg-bozza-1$/);
  // seconda generazione: numero successivo, stessa cartella
  const secondo = ctx.ContrattoArchivio.genera(datiEsempio(ctx), {});
  assert.equal(secondo.numero, new Date().getFullYear() + '/0002');
  assert.equal(gmail.bozze.length, 1);
});

test('Genera: con errori bloccanti non scrive nulla; senza firma ed email avvisa ma genera', () => {
  const amb = ambiente();
  const { ctx, fogli, drive, gmail } = amb;
  assert.throws(() => ctx.ContrattoArchivio.genera({ cliente: { nome: 'Solo' }, righe: [] }, {}), (e) => /Contratto non generato/.test(e.message) && e.errori.length > 0);
  assert.equal(drive.file.size, 0);
  assert.equal(fogli.fogli.has('Contratti'), false);

  const dati = datiEsempio(ctx);
  dati.cliente.email = '';
  const esito = ctx.ContrattoArchivio.genera(dati, { bozzaEmail: true });
  assert.ok(esito.avvisi.some((a) => /Nessuna firma impostata/.test(a)));
  assert.ok(esito.avvisi.some((a) => /manca l'email del cliente/.test(a)));
  assert.ok(esito.avvisi.some((a) => /E-mail mancante/.test(a)));
  assert.equal(esito.bozzaUrl, '');
  assert.equal(gmail.bozze.length, 0);
  assert.equal(drive.file.size, 1);
});

test('Riapri: legge i dati dalla riga selezionata del foglio Contratti', () => {
  const amb = ambiente();
  const { ctx, fogli } = amb;
  ctx.ContrattoArchivio.genera(datiEsempio(ctx), {});
  fogli.attivo.nome = 'Registro';
  fogli.attivo.riga = 2;
  assert.equal(ctx.ContrattoArchivio.riapriDaRigaAttiva(), null);
  fogli.attivo.nome = 'Contratti';
  fogli.attivo.riga = 1;
  assert.equal(ctx.ContrattoArchivio.riapriDaRigaAttiva(), null);
  fogli.attivo.riga = 2;
  const dati = ctx.ContrattoArchivio.riapriDaRigaAttiva();
  assert.equal(dati.cliente.cognome, 'Rossi');
  assert.equal(dati.righe.length, 2);
});

// ------------------------------------------------------------------ pagina
test('Pagina della finestra: incorpora nucleo, risorse, dati e operatore; JSON sicuro dentro <script>', () => {
  const amb = ambiente({ proprietaUtente: { FIRMATARIO_NOME: 'Operatore Finto', FIRMA_FILE_ID: 'firma-1' } });
  const { ctx } = amb;
  assert.equal(typeof ctx.HTML_CONTRATTO, 'string');
  const pagina = ctx.ContrattoUi.pagina({ cliente: { nome: '</script><script>alert(1)</script>' } });
  const html = pagina.getContent();
  assert.match(html, /function contrattoNucleo\(risorse\)/);
  assert.match(html, /var RISORSE = \{"logo":"data:image\/png;base64,/);
  assert.match(html, /"nome":"<\\\/script><script>alert\(1\)<\\\/script>"/);
  assert.match(html, /var OPERATORE = \{"email":"operatore@example.com","nome":"Operatore Finto","haFirma":true\}/);
  assert.match(html, /v1\.1\.0/);
  assert.equal(pagina.titolo, 'Contratto di vendita');
  assert.equal(ctx.contrattoFirma().errore.length > 0, true); // file firma inesistente nel Drive finto
  assert.deepEqual(ctx.contrattoValida({}).errori.length > 0, true);
  assert.equal(typeof ctx.doGet, 'function');
});

test('Il nucleo inviato al browser non dipende da nulla di esterno', () => {
  const ctx = creaAmbiente().ctx;
  const sorgente = ctx.contrattoNucleo.toString();
  const isolato = new Function('risorse', 'return (' + sorgente + ')(risorse);')({ logo: 'x', venditore: 'V' });
  assert.equal(isolato.calcola({ righe: [{ descrizione: 'A', prezzo: 10 }] }).totale, 10);
  assert.match(isolato.html({}), /<b>Venditore:<\/b> V/);
});

test('Il build incorpora la pagina HTML nel file unico', () => {
  const bundle = readFileSync(new URL('../dist/Anagrafica.gs', import.meta.url), 'utf8');
  assert.match(bundle, /var HTML_CONTRATTO = "/);
  assert.match(bundle, /function contrattoNucleo\(risorse\)/);
});
