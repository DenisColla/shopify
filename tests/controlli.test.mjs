// Test dei moduli deterministici: codice fiscale, testo, indirizzi, telefono, comuni.
// Tutti i dati sono inventati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente, PERSONE_FINTE } from './_ambiente.mjs';

const { ctx } = creaAmbiente();
const { CodiceFiscale: CF, Testo, Indirizzi, Telefono, Comuni } = ctx;
const puro = (x) => JSON.parse(JSON.stringify(x));

// ---------------------------------------------------------------- codice fiscale
test('CF: calcolato e valido per persone inventate', () => {
  for (const p of Object.values(PERSONE_FINTE)) {
    const cf = CF.calcola(p);
    assert.equal(cf.length, 16);
    assert.ok(CF.valido(cf), cf);
    assert.equal(CF.verificaCoerenza(cf, p).coerente, true, cf);
  }
});

test('CF: codici di cognome e nome secondo le regole', () => {
  assert.equal(CF.codiceCognome('Rossi'), 'RSS');
  assert.equal(CF.codiceCognome("D'Amico"), 'DMC');
  assert.equal(CF.codiceCognome('Fo'), 'FOX');
  assert.equal(CF.codiceNome('Gianluca'), 'GLC');   // 4+ consonanti: 1a, 3a, 4a
  assert.equal(CF.codiceNome('Anna Maria'), 'NMR');
  assert.equal(CF.codiceNome('Mario'), 'MRA');
});

test('CF: le donne hanno il giorno +40', () => {
  assert.equal(CF.codiceData('1962-11-04', 'F'), '62S44');
  assert.equal(CF.codiceData('1950-03-15', 'M'), '50C15');
});

test('CF: carattere di controllo sbagliato = non valido', () => {
  const cf = CF.calcola(PERSONE_FINTE.mario);
  const sbagliato = cf.slice(0, 15) + (cf[15] === 'A' ? 'B' : 'A');
  assert.equal(CF.valido(sbagliato), false);
  assert.equal(CF.verificaCoerenza(sbagliato, PERSONE_FINTE.mario).coerente, false);
});

test('CF: spazi e minuscole vengono normalizzati', () => {
  const cf = CF.calcola(PERSONE_FINTE.anna);
  const scritto = cf.toLowerCase().replace(/(.{4})/g, '$1 ');
  assert.ok(CF.valido(scritto));
});

test('CF: omocodia riconosciuta e coerente', () => {
  const cf = CF.calcola(PERSONE_FINTE.mario);
  // sostituisce l'ultima cifra del codice comune con la lettera di omocodia e ricalcola il controllo
  const cifre = 'LMNPQRSTUV';
  const primi15 = cf.slice(0, 14) + cifre[Number(cf[14])];
  const omocodico = primi15 + CF.carattereControllo(primi15);
  assert.ok(CF.valido(omocodico));
  assert.equal(CF.senzaOmocodia(omocodico).slice(0, 15), cf.slice(0, 15));
  assert.equal(CF.verificaCoerenza(omocodico, PERSONE_FINTE.mario).coerente, true);
});

test('CF: incoerente se appartiene a un\'altra persona', () => {
  const cfMario = CF.calcola(PERSONE_FINTE.mario);
  const esito = CF.verificaCoerenza(cfMario, PERSONE_FINTE.anna);
  assert.equal(esito.valido, true);
  assert.equal(esito.coerente, false);
});

test('CF: senza data di nascita non è considerato verificato', () => {
  const p = PERSONE_FINTE.luca;
  const cf = CF.calcola(p);
  assert.equal(CF.verificaCoerenza(cf, { nome: p.nome, cognome: p.cognome }).coerente, false);
});

// ---------------------------------------------------------------- testo
test('Nomi: maiuscole corrette', () => {
  assert.equal(Testo.maiuscoleNome('DE ANGELIS'), 'De Angelis');
  assert.equal(Testo.maiuscoleNome("D'ORAZIO"), "D'Orazio");
  assert.equal(Testo.maiuscoleNome('maria rosa'), 'Maria Rosa');
  assert.equal(Testo.maiuscoleNome('ROSSI-BIANCHI'), 'Rossi-Bianchi');
  assert.equal(Testo.maiuscoleNome('McDonald'), 'McDonald'); // già misto: invariato
});

test('Indirizzi: maiuscole, particelle e numeri romani', () => {
  assert.equal(Testo.maiuscoleIndirizzo('VIA DELLE ROSE'), 'Via delle Rose');
  assert.equal(Testo.maiuscoleIndirizzo('via di porta maggiore'), 'Via di Porta Maggiore');
  assert.equal(Testo.maiuscoleIndirizzo('VIA XXV APRILE'), 'Via XXV Aprile');
  assert.equal(Testo.maiuscoleIndirizzo('via IV novembre'), 'Via IV Novembre');
  assert.equal(Testo.maiuscoleIndirizzo("VIA DELL'INDUSTRIA"), "Via dell'Industria");
  assert.equal(Testo.maiuscoleIndirizzo('v.le europa'), 'Viale Europa');
  assert.equal(Testo.maiuscoleIndirizzo('p.zza garibaldi'), 'Piazza Garibaldi');
  assert.equal(Testo.maiuscoleIndirizzo('C.so Italia'), 'Corso Italia');
});

test('Testo nuovo: toglie la parte citata (Gmail italiano su due righe)', () => {
  const corpo = [
    'Ecco il preventivo firmato e la carta d\'identità.',
    '',
    'Cordiali saluti.',
    '',
    'Il giorno lun 28 set 2026 alle ore 16:00 Operatore Migelino <info@example.com>',
    'ha scritto:',
    '',
    '> Buongiorno, per procedere ci invii i documenti.'
  ].join('\n');
  assert.equal(Testo.testoNuovo(corpo), "Ecco il preventivo firmato e la carta d'identità.\n\nCordiali saluti.");
});

test('Testo nuovo: non taglia una frase del paziente senza data', () => {
  const corpo = 'Il medico mi ha scritto che va bene.\nConfermo l\'ordine.';
  assert.equal(Testo.testoNuovo(corpo), corpo);
});

test('Testo nuovo: toglie inoltri, citazioni ">" e firme automatiche', () => {
  const corpo = 'Confermo ordine definitivo colore grigio\nYahoo Mail: cerca, organizza, prendi il controllo della tua casella di posta\n\n----- Messaggio inoltrato -----\nDa: qualcuno';
  assert.equal(Testo.testoNuovo(corpo), 'Confermo ordine definitivo colore grigio');
  assert.equal(Testo.testoNuovo('Ok grazie\n> citazione\nInviato da iPhone'), 'Ok grazie');
});

test('Mittente: email e nome dall\'intestazione', () => {
  assert.equal(Testo.estraiEmail('Mario Rossi <Mario.Rossi@Example.COM>'), 'mario.rossi@example.com');
  assert.equal(Testo.estraiEmail('mario@example.com'), 'mario@example.com');
  assert.equal(Testo.estraiNomeMittente('"Mario Rossi" <mario@example.com>'), 'Mario Rossi');
});

// ---------------------------------------------------------------- comuni
test('Comuni: ricerca per nome e sigla, anche con accenti e omonimi', () => {
  assert.equal(Comuni.trova('ROMA').sigla, 'RM');
  assert.equal(Comuni.trova('tortoli').nome, 'Tortolì');
  assert.equal(Comuni.trova('Samone', 'TO').sigla, 'TO'); // omonimo in TN
  assert.equal(Comuni.trova('Samone'), null);             // ambiguo senza sigla
  assert.equal(Comuni.perCatastale('F205').nome, 'Milano');
});

test('Comuni: CAP coerente con la provincia (prime tre cifre)', () => {
  assert.equal(Comuni.capCoerente('00196', 'RM'), true);
  assert.equal(Comuni.capCoerente('20049', 'MI'), true);   // CAP recente non in tabella ma prefisso valido
  assert.equal(Comuni.capCoerente('80143', 'MI'), false);
  assert.equal(Comuni.capCoerente('09010', 'CI'), true);   // province sarde storiche equivalenti
  assert.equal(Comuni.capCoerente('1234', 'RM'), false);
  assert.equal(Comuni.siglaDaCap('00184'), 'RM');
});

// ---------------------------------------------------------------- indirizzi
test('Indirizzo: normalizzazione e separazione del civico', () => {
  const n = Indirizzi.normalizza({ via: 'VIA DEI GLICINI 14/b', cap: '80121', comune: 'napoli', provincia: '' });
  assert.deepEqual(puro(n), {
    via: 'Via dei Glicini', civico: '14/B', dettagli: '', cap: '80121', comune: 'Napoli', provincia: 'NA',
    paese: 'IT', presso: '', destinatarioNome: '', destinatarioCognome: '', telefono: ''
  });
  assert.equal(Indirizzi.valida(n).ok, true);
});

test('Indirizzo: CAP con 4 cifre (zero iniziale perso) viene corretto', () => {
  const n = Indirizzi.normalizza({ via: 'Strada delle Querce', civico: '7', cap: '5100', comune: 'Terni', provincia: 'TR' });
  assert.equal(n.cap, '05100');
  assert.equal(Indirizzi.valida(n).ok, true);
});

test('Indirizzo: incompleto o incoerente = problemi bloccanti', () => {
  const senzaCivico = Indirizzi.normalizza({ via: 'Via Roma', cap: '10100', comune: 'Torino', provincia: 'TO' });
  assert.deepEqual(puro(Indirizzi.valida(senzaCivico).problemi), ['numero civico mancante']);
  const capSbagliato = Indirizzi.normalizza({ via: 'Via Roma', civico: '1', cap: '80143', comune: 'Torino', provincia: 'TO' });
  assert.equal(Indirizzi.valida(capSbagliato).ok, false);
  const vuoto = Indirizzi.normalizza({});
  assert.equal(Indirizzi.valida(vuoto).ok, false);
});

test('Indirizzo: frazione non in tabella = solo avviso', () => {
  const n = Indirizzi.normalizza({ via: 'Via delle Ninfe', civico: '3', cap: '00121', comune: 'Lido di Ostia', provincia: 'RM' });
  const v = Indirizzi.valida(n);
  assert.equal(v.ok, true);
  assert.equal(v.avvisi.length, 1);
});

test('Indirizzo: presso diventa "C/O ..."', () => {
  const n = Indirizzi.normalizza({ via: 'Via delle Rose', civico: '8', cap: '20121', comune: 'Milano', provincia: 'MI', presso: 'Ditta Esempio S.p.A.' });
  assert.equal(n.presso, 'C/O Ditta Esempio S.p.A.');
});

test('Indirizzo: confronto tollerante (abbreviazioni, maiuscole, particelle)', () => {
  const a = Indirizzi.normalizza({ via: 'V.le della Repubblica', civico: '10', cap: '00100', comune: 'Roma', provincia: 'RM' });
  const b = Indirizzi.normalizza({ via: 'viale Repubblica 10', cap: '00100', comune: 'ROMA', provincia: 'RM' });
  const c = Indirizzi.normalizza({ via: 'viale Repubblica 12', cap: '00100', comune: 'ROMA', provincia: 'RM' });
  assert.equal(Indirizzi.uguali(a, b), true);
  assert.equal(Indirizzi.uguali(a, c), false);
});

test('Indirizzo: conversione per Shopify', () => {
  const n = Indirizzi.normalizza({ via: 'Via dei Mille', civico: '3', dettagli: 'scala C', cap: '10121', comune: 'Torino', provincia: 'TO' });
  assert.deepEqual(puro(Indirizzi.perShopify(n, { nome: 'Anna', cognome: 'Bianchi', azienda: 'XXX', telefono: '+393331234567' })), {
    address1: 'Via dei Mille 3', address2: 'scala C', city: 'Torino', zip: '10121', countryCode: 'IT', provinceCode: 'TO',
    firstName: 'Anna', lastName: 'Bianchi', company: 'XXX', phone: '+393331234567'
  });
});

test('Indirizzo: estero senza provincia', () => {
  const n = Indirizzi.normalizza({ via: 'Bahnhofstrasse', civico: '1', cap: '8001', comune: 'Zürich', paese: 'Svizzera' });
  assert.equal(n.paese, 'CH');
  assert.equal(n.cap, '8001');
  assert.equal(Indirizzi.valida(n).ok, true);
  assert.equal(Indirizzi.perShopify(n, {}).provinceCode, undefined);
});

// ---------------------------------------------------------------- telefono
test('Telefono: normalizzazione E.164', () => {
  assert.equal(Telefono.normalizza('333 123 4567'), '+393331234567');
  assert.equal(Telefono.normalizza('+39 333-123-4567'), '+393331234567');
  assert.equal(Telefono.normalizza('0039 333 1234567'), '+393331234567');
  assert.equal(Telefono.normalizza('0444 321222'), '+390444321222');
  assert.equal(Telefono.normalizza('393331234567'), '+393331234567');
  assert.equal(Telefono.normalizza('+359 87 888 1305'), '+359878881305');
  assert.equal(Telefono.normalizza('12345'), '');
  assert.equal(Telefono.normalizza('non lo so'), '');
  assert.equal(Telefono.cellulare('+393331234567'), true);
});
