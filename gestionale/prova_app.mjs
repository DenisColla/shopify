// Prova in Chromium della scheda Contratto dentro il gestionale: compila, controlla l'anteprima, scarica il PDF.
//   node gestionale/prova_app.mjs <pagina_con_contratto.html> <cartella_uscita>
// Serve Playwright con Chromium (npm i -D playwright && npx playwright install chromium). Dati inventati.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
if (process.argv.length < 4) { console.error('uso: prova_app.mjs <pagina_con_contratto.html> <cartella_uscita>'); process.exit(2); }
const html = readFileSync(process.argv[2], 'utf8');
mkdirSync(process.argv[3], { recursive: true });
const base = path.join(process.argv[3], path.sep);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
const page = await ctx.newPage();
const errori = [];
page.on('pageerror', (e) => errori.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errori.push('console: ' + m.text().slice(0, 200)); });
await page.route('https://gestionale.finto.local/**', (route) => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html }));
// niente rete esterna (font, OpenStreetMap, API del worker): risposte vuote
await page.route(/^https?:\/\/(?!gestionale\.finto\.local)/, (route) => route.fulfill({ status: 204, body: '' }));
await page.goto('https://gestionale.finto.local/', { waitUntil: 'load' });
await page.waitForSelector('#toolnav button[data-tool="contratto"]', { timeout: 10000 });
console.log('strumenti:', await page.$$eval('#toolnav button', (b) => b.map((x) => x.dataset.tool).join(' ')));
await page.click('#toolnav button[data-tool="contratto"]');
await page.waitForSelector('#f_cliente');
console.log('titolo scheda:', await page.locator('#form header.pagina h1').textContent());

const f = async (id, val) => { await page.fill('#' + id, val); };
await f('f_cliente', 'Mario Rossi');
await f('f_tel', '333 123 4567');
await f('f_email', 'mario.rossi@example.com');
await f('f_cf', 'RSSMRA50C15H501G');
await page.locator('#f_cf').blur();   // il codice fiscale decodificato ridisegna il modulo
await page.waitForTimeout(400);
await page.fill('#f_res', 'Via Appia Nuova 100');
await f('f_res2', 'Scala B');
await f('f_comune', 'Roma');
await f('f_cap', '00183');
await f('f_prov', 'RM');
await f('f_prevNum', '2026/0001');
await page.fill('#f_prevData', '2026-09-28');
await f('f_art_0_descrizione', 'Oticon Intent 1 - coppia (2 apparecchi)');
await page.fill('#f_art_0_qta', '2');
await f('f_art_0_prezzo', '1.790,00');
await f('f_art_0_sconto', '200');
await f('f_art_0_dettaglio', 'Colore selezionato: Honey Beige');
await f('f_art_0_etSconto', 'Sconto sulla coppia');
await f('f_art_0_etDopo', 'Prezzo della coppia dopo lo sconto');
await page.click('[data-addcon]');
await page.waitForSelector('#f_art_1_descrizione');
await f('f_art_1_descrizione', 'Oticon SmartCharger - variante per Intent');
await f('f_art_1_prezzo', '229');
await page.check('[data-k="art.1.omaggio"]');
await f('f_art_1_etSconto', 'Omaggio SmartCharger - sconto integrale');
await page.selectOption('#f_pagMod', 'FINANZIAMENTO');
await page.waitForSelector('#f_magg');
await page.fill('#f_rate', '12');
await f('f_magg', '6');
await f('f_consDest', 'Luigi Rossi');
await f('f_luogoFirma', 'Napoli');
await page.waitForTimeout(400);

const sheet = await page.locator('#sheet').innerText();
console.log('anteprima contiene totale 3.380,00:', sheet.includes('3.380,00 €'), '| piano rate:', sheet.includes('11 rate da 298,57 € e ultima rata da 298,53 €'), '| destinatario:', sheet.includes('Nome destinatario: Luigi Rossi'));
console.log('totale modulo:', await page.locator('#con_tot').textContent());
console.log('campi mancanti evidenziati nel foglio:', await page.locator('#sheet .mk.no').count());
await page.screenshot({ path: base + 'app_contratto.png', fullPage: false });
await page.locator('#sheet').screenshot({ path: base + 'app_anteprima.png' });

// Scarica PDF: eventuale finestra di avvisi -> "Scarica lo stesso"
const attesa = page.waitForEvent('download', { timeout: 20000 });
await page.click('#a_pdf');
await page.waitForTimeout(600);
const mok = page.locator('#modal #m_ok');
if (await mok.count()) { console.log('avvisi:', (await page.locator('#modal .modal-body').innerText()).replace(/\n/g, ' | ').slice(0, 300)); await mok.click(); }
const dl = await attesa;
console.log('download:', dl.suggestedFilename());
await dl.saveAs(base + 'app_contratto.pdf');
await page.waitForTimeout(800);
console.log('protocollo dopo lo scarico:', await page.locator('#f_protocollo').inputValue());
console.log('messaggio:', await page.locator('#a_msg').textContent());
// storico
await page.click('#toolnav button[data-tool="storico"]');
await page.waitForTimeout(500);
console.log('storico contiene il contratto:', (await page.locator('#form').innerText()).includes('Contratto di vendita'));
console.log('errori pagina:', errori);
await browser.close();
