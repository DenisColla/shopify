// Turni della casella condivisa support@migelino.ch (Zapier, workflow durevole).
// Ogni nuova conversazione arrivata nella Posta in arrivo di support@ viene inoltrata a turno a
// Denis, Marco, Silvia; le mail successive della stessa conversazione vanno allo stesso collega.
// Lo stato sta tutto nelle etichette Gmail di support@: Turno/<nome> su ogni conversazione assegnata,
// "Turno/➜ prossimo: <nome>" per il giro, "Turno/🔒 …" come blocco tra esecuzioni parallele.
import { defineDurable } from "@zapier/zapier-durable";
import { createZapierSdk } from "@zapier/zapier-sdk";
import { z } from "zod";
import * as t from "./lib/turni.ts";

const sdk = createZapierSdk();

const GMAIL_APP = "GoogleMailV2CLIAPI";
const GMAIL = "gmail_support"; // connessione support@migelino.ch
const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const ATTESA_BLOCCO_S = 10;
const TENTATIVI_BLOCCO = 30;    // circa 5 minuti in tutto
const BLOCCO_ABBANDONATO = 18;  // dopo circa 3 minuti il blocco si considera lasciato da un'esecuzione interrotta

// Payload del trigger Gmail "New Email" (Posta in arrivo di support@).
const Contatto = z.object({ name: z.string().nullable().optional(), email: z.string().nullable().optional() }).loose();
const Destinatari = z.object({ emails: z.array(z.string()).nullable().optional() }).loose();
const InputSchema = z
  .object({
    id: z.string().nullable().optional(),
    message_id: z.string().nullable().optional(),
    thread_id: z.string().nullable().optional(),
    subject: z.string().nullable().optional(),
    from: Contatto.nullable().optional(),
    reply_to: Contatto.nullable().optional(),
    to: Destinatari.nullable().optional(),
    cc: Destinatari.nullable().optional(),
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

async function elencoEtichette(): Promise<t.Etichetta[]> {
  return ((await gmail("/labels"))?.labels ?? []).map((l: any) => ({ id: String(l.id), name: String(l.name) }));
}

async function leggiMessaggi(threadId: string, messageId: string): Promise<Array<{ id: string; labelIds: string[] }>> {
  if (!threadId) return [{ id: messageId, labelIds: (await gmail(`/messages/${messageId}?format=minimal`))?.labelIds ?? [] }];
  return ((await gmail(`/threads/${threadId}?format=minimal`))?.messages ?? []).map((m: any) => ({ id: m.id, labelIds: m.labelIds ?? [] }));
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
  const threadId = e.thread_id ?? "";

  // Etichette fisse pronte (create solo la prima volta) e loro ID.
  const etichette = await ctx.step("prepara-etichette-turno", async () => {
    let elenco = await elencoEtichette();
    for (const nome of t.mappaEtichette(elenco).mancanti) {
      try {
        await gmail("/labels", "POST", { name: nome, labelListVisibility: "labelShow", messageListVisibility: "show" });
      } catch (err: any) {
        if (err?.status !== 409) throw err; // creata nel frattempo da un'altra esecuzione
      }
    }
    elenco = await elencoEtichette();
    const { ids, mancanti } = t.mappaEtichette(elenco);
    if (mancanti.length) throw new Error(`Etichette non disponibili in support@: ${mancanti.join(", ")}`);
    return ids;
  });

  // Conversazione già assegnata: niente giro e niente blocco.
  let assegnazione = await ctx.step("leggi-conversazione", async () => {
    const a = t.assegnazioneEsistente(await leggiMessaggi(threadId, messageId), messageId, etichette);
    return a ? { nome: a.persona.nome, seguito: a.seguito } : null;
  });

  if (!assegnazione) {
    // Conversazione nuova: una sola esecuzione alla volta legge e fa avanzare il giro.
    let blocco: string | null = null;
    for (let i = 0; i < TENTATIVI_BLOCCO && !blocco; i++) {
      blocco = await ctx.step(`prendi-blocco-${i}`, async () => {
        try {
          return String((await gmail("/labels", "POST", { name: t.BLOCCO, labelListVisibility: "labelHide", messageListVisibility: "hide" })).id);
        } catch (err: any) {
          if (err?.status === 409) return null; // un'altra esecuzione sta assegnando
          throw err;
        }
      });
      if (blocco) break;
      if (i === BLOCCO_ABBANDONATO) {
        await ctx.step("forza-blocco-abbandonato", async () => {
          const vecchio = t.trovaEtichetta(await elencoEtichette(), t.BLOCCO);
          if (vecchio) await gmail(`/labels/${vecchio.id}`, "DELETE").catch(() => null);
          return vecchio?.id ?? null;
        });
      }
      await ctx.wait(`attendi-blocco-${i}`, ATTESA_BLOCCO_S);
    }
    if (!blocco) throw new Error("Blocco dei turni non ottenuto: riprova più tardi");
    const idBlocco = blocco;

    try {
      assegnazione = await ctx.step("assegna-turno", async () => {
        // Riletta sotto blocco: un'esecuzione parallela sulla stessa conversazione può averla appena assegnata.
        const a = t.assegnazioneEsistente(await leggiMessaggi(threadId, messageId), messageId, etichette);
        if (a) return { nome: a.persona.nome, seguito: a.seguito };
        const elenco = await elencoEtichette();
        const segnaposto = t.etichettaDelProssimo(elenco);
        const persona = t.prossimoDa(segnaposto);
        await gmail(`/messages/${messageId}/modify`, "POST", { addLabelIds: [etichette[t.nomeEtichetta(persona)]] });
        const nuovoNome = t.etichettaProssimo(t.dopo(persona));
        if (segnaposto) await gmail(`/labels/${segnaposto.id}`, "PATCH", { name: nuovoNome });
        else await gmail("/labels", "POST", { name: nuovoNome, labelListVisibility: "labelShow", messageListVisibility: "hide" });
        return { nome: persona.nome, seguito: false };
      });
    } finally {
      await ctx.step("rilascia-blocco", async () => {
        await gmail(`/labels/${idBlocco}`, "DELETE").catch((err: any) => {
          if (err?.status !== 404) throw err; // già tolto come abbandonato
        });
        return true;
      });
    }
  }

  const collega = t.SQUADRA.find((p) => p.nome === assegnazione!.nome) ?? t.SQUADRA[0];
  const seguito = assegnazione.seguito;
  const cliente = t.indirizzo(e.reply_to) || mittente;
  const nomeCliente = cliente === mittente ? t.nome(e.from) : t.nome(e.reply_to);
  const destinatari = [...(e.to?.emails ?? []), ...(e.cc?.emails ?? [])];

  const giaDestinatario = t.giaDestinatario(collega, destinatari);
  let senzaAllegati = false;
  if (!giaDestinatario) {
    const inoltra = (nomeStep: string, conAllegati: boolean) =>
      ctx.step({
        name: nomeStep,
        maxAttempts: 2,
        retryDelaySeconds: 60,
        run: async () => {
          // Già partito (tentativo precedente interrotto dopo l'invio)? La nota contiene l'ID del messaggio.
          const gia = await gmail(`/messages?q=${encodeURIComponent(`in:sent "${messageId}"`)}&maxResults=1`);
          if (gia?.messages?.length) return { id: gia.messages[0].id, giaInviato: true };
          const r = await sdk.runAction({
            appKey: GMAIL_APP,
            actionType: "write",
            actionKey: "forward_email",
            connection: GMAIL,
            inputs: {
              message_id: messageId,
              to: [collega.email],
              reply_to: cliente,
              from_name: t.nomeMittente(nomeCliente, cliente),
              body_type: "plain",
              additional_message: t.nota(collega, cliente, seguito, !conAllegati, messageId),
              include_attachments: conAllegati,
            },
          });
          return r.data?.[0] ?? null;
        },
      });
    try {
      await inoltra("inoltra-al-collega", true);
    } catch {
      try {
        await inoltra("inoltra-senza-allegati", false);
        senzaAllegati = true;
      } catch (err) {
        // In vista nella casella condivisa, da gestire a mano: la conversazione torna senza assegnazione.
        await ctx.step("segna-non-inoltrata", async () =>
          gmail(`/messages/${messageId}/modify`, "POST", {
            addLabelIds: [etichette[t.ETICHETTA_ERRORE]],
            ...(seguito ? {} : { removeLabelIds: [etichette[t.nomeEtichetta(collega)]] }),
          }),
        );
        throw err;
      }
    }
  }

  // Turno anche sul singolo messaggio (per i seguiti) e via l'eventuale ⛔ di un tentativo precedente.
  await ctx.step("completa-etichette", async () =>
    gmail(`/messages/${messageId}/modify`, "POST", {
      addLabelIds: [etichette[t.nomeEtichetta(collega)]],
      removeLabelIds: [etichette[t.ETICHETTA_ERRORE]],
    }),
  );

  return {
    inoltrata_a: collega.nome,
    seguito,
    gia_destinatario: giaDestinatario,
    senza_allegati: senzaAllegati,
    cliente,
    oggetto: e.subject ?? "",
  };
});

export default workflow;
