// Genera src/03_comuni_dati.js dalla tabella pubblica dei comuni italiani.
//
// Fonte: comuni-json di Matteo Contrini (https://github.com/matteocontrini/comuni-json),
// basato su dati ISTAT e CAP ANCI, aggiornato al 01/01/2020.
// I CAP della fonte possono essere datati: il codice li usa solo come controllo
// di coerenza CAP/provincia, mai come verità assoluta.
//
// Uso:  node tools/genera_comuni.mjs [percorso-comuni.json]
// Senza argomenti scarica il file dalla fonte.

import { readFile, writeFile } from 'node:fs/promises';

const FONTE = 'https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json';

async function caricaFonte(percorso) {
  if (percorso) return JSON.parse(await readFile(percorso, 'utf8'));
  const risposta = await fetch(FONTE);
  if (!risposta.ok) throw new Error(`Download fallito: HTTP ${risposta.status}`);
  return risposta.json();
}

// Comprime una lista di CAP in intervalli: ["10121","10122","10123"] -> "10121-10123"
function comprimiCap(listaCap) {
  const numeri = [...new Set(listaCap.map(Number))].sort((a, b) => a - b);
  const intervalli = [];
  let inizio = null;
  let precedente = null;
  for (const n of numeri) {
    if (inizio === null) { inizio = precedente = n; continue; }
    if (n === precedente + 1) { precedente = n; continue; }
    intervalli.push([inizio, precedente]);
    inizio = precedente = n;
  }
  if (inizio !== null) intervalli.push([inizio, precedente]);
  const cinque = (n) => String(n).padStart(5, '0');
  return intervalli.map(([a, b]) => (a === b ? cinque(a) : `${cinque(a)}-${cinque(b)}`)).join(',');
}

const comuni = await caricaFonte(process.argv[2]);
const righe = comuni
  .map((c) => [c.nome, c.sigla, c.codiceCatastale, comprimiCap(c.cap)].join('|'))
  .sort((a, b) => a.localeCompare(b, 'it'));

const contenuto = `// FILE GENERATO da tools/genera_comuni.mjs - non modificare a mano.
// Comuni italiani: nome|sigla provincia|codice catastale|CAP (intervalli).
// Fonte: comuni-json di Matteo Contrini (dati ISTAT e ANCI, aggiornati al 01/01/2020).
// ${righe.length} comuni.
var COMUNI_DATI = ${JSON.stringify(righe.join('\n'))};
`;

await writeFile(new URL('../src/03_comuni_dati.js', import.meta.url), contenuto, 'utf8');
console.log(`Scritti ${righe.length} comuni in src/03_comuni_dati.js (${contenuto.length} caratteri).`);
