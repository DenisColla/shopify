// Turni della casella condivisa support@migelino.ch: logica pura, senza chiamate esterne
// (provata da tests/turni-zapier.test.mjs). Le chiamate a Gmail stanno in ../workflow.ts.

export type Persona = { nome: string; email: string };

export const CASELLA = "support@migelino.ch";

// Ordine del giro.
export const SQUADRA: Persona[] = [
  { nome: "Denis", email: "denis@migelino.it" },
  { nome: "Marco", email: "marcoz@migelino.it" },
  { nome: "Silvia", email: "silvia@migelino.it" },
];

export const ETICHETTA = "Turno";
export const ETICHETTA_ERRORE = "Turno/⛔ Non inoltrata";
const MITTENTI_ESCLUSI = [/mailer-daemon/i, /postmaster/i]; // evita giri infiniti con le mail di errore

export function nomeEtichetta(p: Persona): string {
  return `${ETICHETTA}/${p.nome}`;
}

/** Etichette da tenere pronte nella casella condivisa (la radice prima delle sottoetichette). */
export function tutteLeEtichette(): string[] {
  return [ETICHETTA, ...SQUADRA.map(nomeEtichetta), ETICHETTA_ERRORE];
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

/** Collega a cui la conversazione è già assegnata (etichetta Turno/<nome> su un suo messaggio), oppure null. */
export function giaAssegnato(etichetteConversazione: string[], idEtichette: Record<string, string>): Persona | null {
  const presenti = new Set(etichetteConversazione);
  return SQUADRA.find((p) => presenti.has(idEtichette[nomeEtichetta(p)])) ?? null;
}

/**
 * Prossimo turno: il collega con meno conversazioni assegnate, a parità il primo nell'ordine della squadra.
 * Partendo da conteggi uguali è esattamente il giro Denis, Marco, Silvia, Denis...; e se due mail arrivano
 * insieme o una conversazione viene riassegnata a mano, il giro si riequilibra da solo.
 */
export function prossimo(conteggi: number[]): Persona {
  let migliore = 0;
  for (let i = 1; i < SQUADRA.length; i++) {
    if ((conteggi[i] ?? 0) < (conteggi[migliore] ?? 0)) migliore = i;
  }
  return SQUADRA[migliore];
}

/** Nome del mittente dell'inoltro: chi ha scritto, così il collega lo riconosce subito nella posta. */
export function nomeMittente(nomeCliente: string, emailCliente: string): string {
  const base = (nomeCliente || emailCliente || "Cliente").replace(/["<>]/g, "").trim();
  return `${base.slice(0, 60)} via Support`;
}

export function nota(p: Persona, cliente: string, seguito: boolean): string {
  const apertura = seguito
    ? `Nuovo messaggio nella conversazione già assegnata a te (turno: ${p.nome}).`
    : `Turno: ${p.nome}. Questa conversazione di support@migelino.ch è assegnata a te.`;
  return `${apertura}\nRispondendo a questa mail scrivi direttamente a ${cliente}.`;
}
