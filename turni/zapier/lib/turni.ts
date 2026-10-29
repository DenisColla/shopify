// Turni della casella condivisa support@migelino.ch: logica pura, senza chiamate esterne
// (provata da tests/turni-zapier.test.mjs). Le chiamate a Gmail stanno in ../workflow.ts.

export type Persona = { nome: string; email: string };
export type Etichetta = { id: string; name: string };

export const CASELLA = "support@migelino.ch";

// Ordine del giro.
export const SQUADRA: Persona[] = [
  { nome: "Denis", email: "denis@migelino.it" },
  { nome: "Marco", email: "marcoz@migelino.it" },
  { nome: "Silvia", email: "silvia@migelino.it" },
];

export const ETICHETTA = "Turno";
export const ETICHETTA_ERRORE = "Turno/⛔ Non inoltrata";
// Chi riceve la prossima conversazione nuova: si legge (e si può cambiare a mano) dal nome dell'etichetta.
export const PREFISSO_PROSSIMO = "Turno/➜ prossimo: ";
// Blocco: una sola esecuzione alla volta assegna una conversazione nuova (Gmail rifiuta un'etichetta doppia).
export const BLOCCO = "Turno/🔒 assegnazione in corso";
const MITTENTI_ESCLUSI = [/mailer-daemon/i, /postmaster/i]; // evita giri infiniti con le mail di errore

export function nomeEtichetta(p: Persona): string {
  return `${ETICHETTA}/${p.nome}`;
}

export function etichettaProssimo(p: Persona): string {
  return PREFISSO_PROSSIMO + p.nome;
}

/** Etichette fisse da tenere pronte nella casella condivisa (la radice prima delle sottoetichette). */
export function tutteLeEtichette(): string[] {
  return [ETICHETTA, ...SQUADRA.map(nomeEtichetta), ETICHETTA_ERRORE];
}

/**
 * Nome → ID per le etichette fisse. Gmail confronta i nomi senza badare alle maiuscole:
 * "turno/denis" creata a mano vale come "Turno/Denis".
 */
export function mappaEtichette(etichette: Etichetta[]): { ids: Record<string, string>; mancanti: string[] } {
  const perNome = new Map(etichette.map((l) => [String(l.name).toLowerCase(), l.id]));
  const ids: Record<string, string> = {};
  const mancanti: string[] = [];
  for (const nome of tutteLeEtichette()) {
    const id = perNome.get(nome.toLowerCase());
    if (id) ids[nome] = id;
    else mancanti.push(nome);
  }
  return { ids, mancanti };
}

export function trovaEtichetta(etichette: Etichetta[], nome: string): Etichetta | null {
  return etichette.find((l) => String(l.name).toLowerCase() === nome.toLowerCase()) ?? null;
}

/** Etichetta "➜ prossimo" (anche rinominata a mano con maiuscole diverse), oppure null. */
export function etichettaDelProssimo(etichette: Etichetta[]): Etichetta | null {
  const p = PREFISSO_PROSSIMO.toLowerCase().trim();
  return etichette.find((l) => String(l.name).toLowerCase().startsWith(p)) ?? null;
}

/** Collega scritto nell'etichetta "➜ prossimo"; il primo della squadra se manca o non si riconosce. */
export function prossimoDa(etichetta: Etichetta | null): Persona {
  const scritto = etichetta ? String(etichetta.name).slice(PREFISSO_PROSSIMO.trim().length).replace(/^\s*/, "") : "";
  return SQUADRA.find((p) => p.nome.toLowerCase() === scritto.trim().toLowerCase()) ?? SQUADRA[0];
}

export function dopo(p: Persona): Persona {
  return SQUADRA[(SQUADRA.findIndex((s) => s.nome === p.nome) + 1) % SQUADRA.length];
}

/** Indirizzo in minuscolo da "Nome <a@b.it>", "a@b.it" o { email }. */
export function indirizzo(x: unknown): string {
  const v = x && typeof x === "object" ? (x as { email?: unknown }).email : x;
  const s = String(v ?? "").trim();
  const m = /<([^>]+)>/.exec(s);
  return (m ? m[1] : s).trim().toLowerCase();
}

/** Nome visualizzato da "Nome <a@b.it>" o { name }. */
export function nome(x: unknown): string {
  if (x && typeof x === "object") return String((x as { name?: unknown }).name ?? "").trim();
  const m = /^\s*"?([^"<]*?)"?\s*</.exec(String(x ?? ""));
  return m ? m[1].trim() : "";
}

/** Perché una mail non va inoltrata, oppure null. */
export function motivoEsclusione(mittente: string): string | null {
  if (!mittente) return "mittente-sconosciuto";
  if (mittente === CASELLA) return "inviata-dalla-casella";
  if (SQUADRA.some((p) => p.email === mittente)) return "mittente-della-squadra";
  if (MITTENTI_ESCLUSI.some((re) => re.test(mittente))) return "notifica-di-errore";
  return null;
}

/** Collega indicato da un'etichetta Turno/<nome> tra quelle date, oppure null. */
export function giaAssegnato(etichetteIds: string[], ids: Record<string, string>): Persona | null {
  const presenti = new Set(etichetteIds);
  return SQUADRA.find((p) => presenti.has(ids[nomeEtichetta(p)])) ?? null;
}

/**
 * Assegnazione dalla conversazione letta in Gmail:
 * - un altro messaggio ha Turno/X: X, come seguito;
 * - solo il messaggio stesso ha Turno/X (esecuzione ripetuta di una conversazione già assegnata): X;
 * - altrimenti: conversazione nuova da assegnare con il giro (null).
 */
export function assegnazioneEsistente(
  messaggi: Array<{ id: string; labelIds?: string[] | null }>,
  messageId: string,
  ids: Record<string, string>,
): { persona: Persona; seguito: boolean } | null {
  const prima = giaAssegnato(messaggi.filter((m) => m.id !== messageId).flatMap((m) => m.labelIds ?? []), ids);
  if (prima) return { persona: prima, seguito: true };
  const qui = giaAssegnato(messaggi.filter((m) => m.id === messageId).flatMap((m) => m.labelIds ?? []), ids);
  return qui ? { persona: qui, seguito: false } : null;
}

export type Scelta = {
  nome: string;
  seguito: boolean;
  applica: boolean;         // c'è da scrivere in Gmail
  aggiungi: string | null;  // ID dell'etichetta Turno/<nome> da mettere sul messaggio
  rinomina: boolean;        // far avanzare il giro
  idProssimo: string | null;
  nuovoNome: string;        // nome che l'etichetta "➜ prossimo" deve avere dopo questa assegnazione
  doppioni: string[];       // altre etichette "➜ prossimo" da togliere
};

/**
 * Decisione sotto blocco (solo lettura). Separata dalla scrittura: se la scrittura va ripetuta,
 * si ripete identica e il giro non avanza mai due volte né resta fermo.
 */
export function scegli(
  messaggi: Array<{ id: string; labelIds?: string[] | null }>,
  messageId: string,
  ids: Record<string, string>,
  elenco: Etichetta[],
): Scelta {
  const p0 = PREFISSO_PROSSIMO.toLowerCase().trim();
  const segnaposti = elenco.filter((l) => String(l.name).toLowerCase().startsWith(p0));
  const segnaposto = segnaposti[0] ?? null;
  const doppioni = segnaposti.slice(1).map((l) => l.id);
  const a = assegnazioneEsistente(messaggi, messageId, ids);
  const base = (p: Persona) => ({ nome: p.nome, idProssimo: segnaposto?.id ?? null, nuovoNome: etichettaProssimo(dopo(p)), doppioni });
  if (a?.seguito) return { ...base(a.persona), seguito: true, applica: false, aggiungi: null, rinomina: false };
  // Messaggio che porta già il proprio Turno/X: un'assegnazione completata (se applica-turno si interrompe
  // il runtime la ripete fino in fondo, se fallisce l'etichetta viene tolta). Il giro non va toccato.
  if (a) return { ...base(a.persona), seguito: false, applica: doppioni.length > 0, aggiungi: null, rinomina: false };
  const p = prossimoDa(segnaposto);
  return { ...base(p), seguito: false, applica: true, aggiungi: ids[nomeEtichetta(p)] ?? null, rinomina: true };
}

/** Errore dovuto alla dimensione della mail (non a limiti di frequenza o disservizi). */
export function erroreDiDimensione(errore: string | null | undefined): boolean {
  const e = String(errore ?? "");
  return /size|too large|too big|\b413\b|\b552\b|25 ?mb/i.test(e) && !/rate/i.test(e);
}

/** Secondi in più (0-4) per sfasare le attese di esecuzioni partite insieme; stabile per la stessa mail. */
export function sfasamento(messageId: string, giro: number): number {
  let h = 0;
  for (const c of messageId) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return (h + giro) % 5;
}

/** Il collega riceve già la mail direttamente (in A o Cc): inoltrarla sarebbe un doppione. */
export function giaDestinatario(p: Persona, destinatari: unknown[]): boolean {
  return destinatari.some((d) => indirizzo(d) === p.email);
}

/** Nome del mittente dell'inoltro: chi ha scritto, così il collega lo riconosce subito nella posta. */
export function nomeMittente(nomeCliente: string, emailCliente: string): string {
  const base = (nomeCliente || emailCliente || "Cliente").replace(/["<>]/g, "").trim();
  return `${base.slice(0, 60)} via Support`;
}

/** Nota sopra l'inoltro. L'ultima riga (ID del messaggio originale) serve a riconoscere un inoltro già partito. */
export function nota(p: Persona, cliente: string, seguito: boolean, senzaAllegati: boolean, messageId: string): string {
  const righe = [
    seguito
      ? `Nuovo messaggio nella conversazione già assegnata a te (turno: ${p.nome}).`
      : `Turno: ${p.nome}. Questa conversazione di support@migelino.ch è assegnata a te.`,
    `Rispondendo a questa mail scrivi direttamente a ${cliente}.`,
  ];
  if (senzaAllegati) righe.push("Allegati non inclusi (troppo grandi per l'inoltro): aprili nella conversazione in support@migelino.ch.");
  righe.push(`Rif. turno ${messageId}`);
  return righe.join("\n");
}
