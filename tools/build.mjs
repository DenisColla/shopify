// Unisce i sorgenti di src/ in un unico file da incollare nell'editor di Apps Script.
//   node tools/build.mjs          -> scrive dist/Anagrafica.gs e dist/appsscript.json
//   node tools/build.mjs --check  -> verifica che dist/ sia aggiornato (usato dalla CI)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const radice = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(radice, 'src');
const dist = path.join(radice, 'dist');
const pacchetto = JSON.parse(readFileSync(path.join(radice, 'package.json'), 'utf8'));

const file = readdirSync(src).filter((f) => f.endsWith('.js')).sort();
const parti = file.map((f) => `// ===== ${f} =====\n` + readFileSync(path.join(src, f), 'utf8').trim() + '\n');
const intestazione = [
  '/**',
  ' * MIGELINO - Anagrafica automatica da Gmail a Shopify',
  ` * Versione ${pacchetto.version}. FILE GENERATO da tools/build.mjs: non modificarlo qui,`,
  ' * modifica i file in src/ e rigenera. Istruzioni: docs/INSTALLAZIONE.md',
  ' */',
  ''
].join('\n');
const bundle = intestazione + parti.join('\n');

new vm.Script(bundle, { filename: 'Anagrafica.gs' }); // errore se la sintassi non è valida

const manifest = readFileSync(path.join(radice, 'appsscript.json'), 'utf8');
if (process.argv.includes('--check')) {
  const attuale = existsSync(path.join(dist, 'Anagrafica.gs')) ? readFileSync(path.join(dist, 'Anagrafica.gs'), 'utf8') : '';
  const manifestAttuale = existsSync(path.join(dist, 'appsscript.json')) ? readFileSync(path.join(dist, 'appsscript.json'), 'utf8') : '';
  if (attuale !== bundle || manifestAttuale !== manifest) {
    console.error('dist/ non è aggiornato: esegui "npm run build" e fai commit.');
    process.exit(1);
  }
  console.log('dist/ aggiornato.');
} else {
  mkdirSync(dist, { recursive: true });
  writeFileSync(path.join(dist, 'Anagrafica.gs'), bundle, 'utf8');
  writeFileSync(path.join(dist, 'appsscript.json'), manifest, 'utf8');
  console.log(`Scritto dist/Anagrafica.gs (${file.length} file, ${bundle.length} caratteri).`);
}
