// Carica i sorgenti Apps Script (src/*.js) in un contesto Node isolato, con
// finti servizi Google (PropertiesService, UrlFetchApp, GmailApp, ...).
// I test usano solo dati INVENTATI: nessun dato reale di pazienti nel repo.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const radice = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const cartellaSrc = path.join(radice, 'src');

export function fileSorgenti() {
  return readdirSync(cartellaSrc).filter((f) => f.endsWith('.js')).sort();
}

export class ProprietaFinte {
  constructor(iniziali = {}) { this.dati = { ...iniziali }; }
  getProperty(k) { return Object.prototype.hasOwnProperty.call(this.dati, k) ? this.dati[k] : null; }
  setProperty(k, v) { this.dati[k] = String(v); return this; }
  deleteProperty(k) { delete this.dati[k]; return this; }
  getProperties() { return { ...this.dati }; }
  getKeys() { return Object.keys(this.dati); }
}

class RispostaFinta {
  constructor(codice, corpo) { this.codice = codice; this.corpo = typeof corpo === 'string' ? corpo : JSON.stringify(corpo); }
  getResponseCode() { return this.codice; }
  getContentText() { return this.corpo; }
}

/**
 * Crea un ambiente con i sorgenti caricati.
 * opzioni.proprieta: Proprietà dello script (oggetto, oppure una ProprietaFinte da condividere tra ambienti)
 * opzioni.proprietaUtente: Proprietà dell'utente (una per casella)
 * opzioni.fetch: funzione (url, parametri) => {codice, corpo} per simulare le API
 */
export function creaAmbiente(opzioni = {}) {
  const proprieta = opzioni.proprieta instanceof ProprietaFinte ? opzioni.proprieta : new ProprietaFinte(opzioni.proprieta || {});
  const proprietaUtente = opzioni.proprietaUtente instanceof ProprietaFinte ? opzioni.proprietaUtente : new ProprietaFinte(opzioni.proprietaUtente || {});
  const chiamate = [];
  const log = [];
  const cache = new Map();

  const contesto = {
    console,
    PropertiesService: { getScriptProperties: () => proprieta, getUserProperties: () => proprietaUtente },
    UrlFetchApp: {
      fetch: (url, parametri = {}) => {
        chiamate.push({ url, parametri });
        if (!opzioni.fetch) throw new Error('fetch non previsto nel test: ' + url);
        const r = opzioni.fetch(url, parametri, chiamate.length);
        return new RispostaFinta(r.codice ?? 200, r.corpo ?? {});
      }
    },
    Utilities: {
      sleep: () => {},
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
      formatDate: (d, _tz, formato) => {
        const x = new Date(d);
        const due = (n) => String(n).padStart(2, '0');
        return formato
          .replace('yyyy', x.getUTCFullYear())
          .replace('MM', due(x.getUTCMonth() + 1))
          .replace('dd', due(x.getUTCDate()))
          .replace('HH', due(x.getUTCHours()))
          .replace('mm', due(x.getUTCMinutes()));
      },
      computeDigest: () => [],
      DigestAlgorithm: { MD5: 'MD5' }
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => (cache.has(k) ? cache.get(k) : null),
        put: (k, v) => { cache.set(k, v); },
        remove: (k) => { cache.delete(k); }
      })
    },
    Logger: { log: (...a) => log.push(a.join(' ')) },
    Session: { getScriptTimeZone: () => 'Europe/Rome' },
    ...(opzioni.globali || {})
  };
  vm.createContext(contesto);
  for (const f of fileSorgenti()) {
    const codice = readFileSync(path.join(cartellaSrc, f), 'utf8');
    vm.runInContext(codice, contesto, { filename: f });
  }
  return { ctx: contesto, proprieta, proprietaUtente, chiamate, log };
}

// Persone INVENTATE per i test. I CF vengono calcolati dal codice stesso.
export const PERSONE_FINTE = {
  mario: { nome: 'Mario', cognome: 'Rossi', dataNascita: '1950-03-15', sesso: 'M', codiceCatastale: 'H501', comune: 'Roma' },
  anna: { nome: 'Anna Maria', cognome: 'Bianchi', dataNascita: '1962-11-04', sesso: 'F', codiceCatastale: 'F205', comune: 'Milano' },
  luca: { nome: 'Gianluca', cognome: "D'Amico", dataNascita: '1948-07-30', sesso: 'M', codiceCatastale: 'L219', comune: 'Torino' }
};
