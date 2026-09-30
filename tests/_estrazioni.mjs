// Costruttori di estrazioni finte (come le restituirebbe Claude) per i test.
import { PERSONE_FINTE } from './_ambiente.mjs';

export function campo(valore, confidenza = 0.97, fonte = 'DOCUMENTO_IDENTITA', evidenza = '') {
  return { valore, confidenza, fonte, evidenza };
}

export function indirizzo(valori = {}) {
  return {
    via: '', civico: '', dettagli: '', cap: '', comune: '', provincia: '', paese: 'IT',
    confidenza: 0.95, fonte: 'DOCUMENTO_IDENTITA', evidenza: '', ...valori
  };
}

export function spedizioneVuota(valori = {}) {
  return {
    stessa_della_residenza: 'NON_INDICATO',
    indirizzo: indirizzo({ confidenza: 0, fonte: 'NESSUNA', paese: '' }),
    destinatario_nome: '', destinatario_cognome: '', presso: '', telefono_destinatario: '', evidenza: '',
    ...valori
  };
}

/** Estrazione completa di Mario Rossi (inventato); "cf" va passato dal test (calcolato dal codice). */
export function estrazioneMario(cf, sovrascritture = {}) {
  const p = PERSONE_FINTE.mario;
  return {
    paziente_identificato: 'SI',
    piu_persone: false,
    nome: campo(p.nome.toUpperCase()),
    cognome: campo(p.cognome.toUpperCase()),
    sesso: campo('M'),
    data_nascita: campo(p.dataNascita),
    luogo_nascita: campo('ROMA'),
    codice_fiscale: campo(cf, 0.95, 'TESSERA_SANITARIA'),
    telefono: campo('333 1234567', 0.95, 'FIRMA_EMAIL'),
    residenza: indirizzo({ via: 'VIA APPIA NUOVA', civico: '100', cap: '00183', comune: 'ROMA', provincia: 'RM' }),
    spedizione: spedizioneVuota({ stessa_della_residenza: 'SI', evidenza: 'spedite pure a casa mia' }),
    documenti: [{ file: 'documento.jpg', tipo: 'CARTA_IDENTITA_CARTACEA', leggibile: true, intestatario: 'Mario Rossi' }],
    note: '',
    ...sovrascritture
  };
}

export const SPEDIZIONE_MOGLIE = spedizioneVuota({
  stessa_della_residenza: 'NO',
  indirizzo: indirizzo({ via: 'Via Tuscolana', civico: '5', cap: '00182', comune: 'Roma', provincia: 'RM', fonte: 'DICHIARAZIONE_EMAIL', confidenza: 0.96 }),
  destinatario_nome: 'Lucia',
  destinatario_cognome: 'Verdi',
  telefono_destinatario: '347 7654321',
  evidenza: 'Indirizzo: Lucia Verdi Via Tuscolana 5 00182 Roma'
});
