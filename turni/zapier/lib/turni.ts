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
 * - il messaggio stesso ha già Turno/X (esecuzione ripetuta): X, come conversazione nuova;
 * - un altro messaggio ha Turno/X: X, come seguito;
 * - altrimenti: conversazione nuova da assegnare con il giro (null).
 */
export function assegnazioneEsistente(
  messaggi: Array<{ id: string; labelIds?: string[] | null }>,
  messageId: string,
  ids: Record<string, string>,
): { persona: Persona; seguito: boolean } | null {
  const qui = giaAssegnato(messaggi.filter((m) => m.id === messageId).flatMap((m) => m.labelIds ?? []), ids);
  if (qui) return { persona: qui, seguito: false };
  const prima = giaAssegnato(messaggi.filter((m) => m.id !== messageId).flatMap((m) => m.labelIds ?? []), ids);
  return prima ? { persona: prima, seguito: true } : null;
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
  if (senzaAllegati) righe.push("Gli allegati non si sono potuti inoltrare (troppo grandi): aprili nella conversazione in support@migelino.ch.");
  righe.push(`Rif. turno ${messageId}`);
  return righe.join("\n");
}
