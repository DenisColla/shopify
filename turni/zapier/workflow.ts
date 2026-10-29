// Turni della casella condivisa support@migelino.ch (Zapier, workflow durevole).
// Ogni nuova conversazione arrivata nella Posta in arrivo di support@ viene inoltrata a turno a
// Denis, Marco, Silvia; le mail successive della stessa conversazione vanno allo stesso collega.
// Lo stato del giro sta nelle etichette Gmail di support@ (Turno/<nome>): nessun archivio esterno.
import { defineDurable } from "@zapier/zapier-durable";
import { createZapierSdk } from "@zapier/zapier-sdk";
import { z } from "zod";
import * as t from "./lib/turni.ts";

const sdk = createZapierSdk();

const GMAIL_APP = "GoogleMailV2CLIAPI";
const GMAIL = "gmail_support"; // connessione support@migelino.ch
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// Payload del trigger Gmail "New Email" (Posta in arrivo di support@).
const Contatto = z.object({ name: z.string().nullable().optional(), email: z.string().nullable().optional() }).loose();
const InputSchema = z
  .object({
    id: z.string().nullable().optional(),
    message_id: z.string().nullable().optional(),
    thread_id: z.string().nullable().optional(),
    subject: z.string().nullable().optional(),
    from: Contatto.nullable().optional(),
    reply_to: Contatto.nullable().optional(),
    labels: z.array(z.string()).nullable().optional(),
  })
  .loose();

function normalizeInput(rawInput: unknown): unknown {
  if (typeof rawInput === "string") return JSON.parse(rawInput);
  return rawInput ?? {};
}

async function gmail(path: string, method = "GET", body?: unknown): Promise<any> {
  const res = await sdk.fetch(`${API}${path}`, {
    connection: GMAIL,
    method,
    ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const testo = await res.text();
  if (!res.ok) {
    const errore: any = new Error(`Gmail ${res.status}: ${testo.slice(0, 300)}`);
    errore.status = res.status;
    throw errore;
  }
  return testo ? JSON.parse(testo) : null;
}

async function idEtichette(): Promise<Record<string, string>> {
  const elenco = await gmail("/labels");
  const ids: Record<string, string> = {};
  for (const l of elenco?.labels ?? []) ids[l.name] = l.id;
  return ids;
}

const workflow = defineDurable<unknown, unknown>("turni-support-migelino-ch", async (ctx, rawInput) => {
  const e = InputSchema.parse(normalizeInput(rawInput));
  const messageId = e.id ?? e.message_id ?? "";
  if (!messageId) return { skipped: true, reason: "email-senza-id" };
  const mittente = t.indirizzo(e.from);
  const esclusa = t.motivoEsclusione(mittente);
  if (esclusa) return { skipped: true, reason: esclusa, da: mittente };
  const etichetteMail = e.labels ?? [];
  if (etichetteMail.includes("SENT") || etichetteMail.includes("DRAFT")) return { skipped: true, reason: "non-in-arrivo" };

  // Etichette Turno/... pronte (create solo la prima volta) e loro ID.
  const etichette = await ctx.step("prepara-etichette-turno", async () => {
    let ids = await idEtichette();
    for (const nome of t.tutteLeEtichette()) {
      if (ids[nome]) continue;
      try {
        const creata = await gmail("/labels", "POST", { name: nome, labelListVisibility: "labelShow", messageListVisibility: "show" });
        ids[nome] = creata.id;
      } catch (err: any) {
        if (err?.status !== 409) throw err; // creata nel frattempo da un'altra esecuzione
        ids = await idEtichette();
      }
    }
    return ids;
  });

  // Conversazione già assegnata? Allora resta allo stesso collega.
  const threadId = e.thread_id ?? "";
  const etichetteConversazione: string[] = threadId
    ? await ctx.step("leggi-conversazione", async () => {
        const conversazione = await gmail(`/threads/${threadId}?format=minimal`);
        return [...new Set<string>((conversazione?.messages ?? []).flatMap((m: any) => m.labelIds ?? []))];
      })
    : etichetteMail;
  let persona = t.giaAssegnato(etichetteConversazione, etichette);
  const seguito = persona !== null;
  if (!persona) {
    const conteggi = await ctx.step("conta-conversazioni-per-collega", async () =>
      Promise.all(t.SQUADRA.map(async (p) => Number((await gmail(`/labels/${etichette[t.nomeEtichetta(p)]}`))?.threadsTotal ?? 0))),
    );
    persona = t.prossimo(conteggi);
  }
  const collega = persona;

  // Etichetta prima dell'inoltro: un'altra mail arrivata subito dopo vede già il turno assegnato.
  if (!seguito) {
    await ctx.step("assegna-turno", async () =>
      gmail(`/messages/${messageId}/modify`, "POST", { addLabelIds: [etichette[t.nomeEtichetta(collega)]] }),
    );
  }

  const cliente = t.indirizzo(e.reply_to) || mittente;
  try {
    await ctx.step({
      name: "inoltra-al-collega",
      maxAttempts: 2,
      retryDelaySeconds: 60,
      run: async () =>
        sdk.runAction({
          appKey: GMAIL_APP,
          actionType: "write",
          actionKey: "forward_email",
          connection: GMAIL,
          inputs: {
            message_id: messageId,
            to: [collega.email],
            reply_to: cliente,
            from_name: t.nomeMittente(t.nome(e.from), mittente),
            body_type: "plain",
            additional_message: t.nota(collega, cliente, seguito),
            include_attachments: true,
          },
        }),
    });
  } catch (err) {
    // In vista nella casella condivisa, da gestire a mano; l'esecuzione resta segnata come fallita.
    await ctx.step("segna-non-inoltrata", async () =>
      gmail(`/messages/${messageId}/modify`, "POST", { addLabelIds: [etichette[t.ETICHETTA_ERRORE]] }),
    );
    throw err;
  }

  if (seguito) {
    await ctx.step("etichetta-seguito", async () =>
      gmail(`/messages/${messageId}/modify`, "POST", { addLabelIds: [etichette[t.nomeEtichetta(collega)]] }),
    );
  }

  return { inoltrata_a: collega.nome, email: collega.email, seguito, cliente, oggetto: e.subject ?? "" };
});

export default workflow;
