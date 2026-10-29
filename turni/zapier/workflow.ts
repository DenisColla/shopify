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
const TENTATIVI_BLOCCO = 40;        // circa 7-9 minuti in tutto
const GIRI_BLOCCO_ABBANDONATO = 18; // lo stesso blocco visto per ~3 minuti: chi lo teneva si è interrotto
const TENTATIVI_INOLTRO = 3;

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
    attachment_count: z.unknown(),
  })
  .loose();

function normalizeInput(rawInput: unknown): unknown {
  if (typeof rawInput === "string") return JSON.parse(rawInput);
  return rawInput ?? {};
}

function testoErrore(err: any): string {
  const c = err?.cause ?? err;
  return String(c?.message ?? c ?? "errore").slice(0, 400);
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

/**
 * Un tentativo di prendere il blocco. Il blocco preso viene messo anche sul proprio messaggio (nascosto):
 * così un tentativo ripetuto riconosce il blocco come suo invece di aspettarlo.
 * Non lancia mai: { preso } se il blocco è nostro, { visto } con l'ID del blocco di un'altra esecuzione.
 */
async function prendiBlocco(messageId: string): Promise<{ preso: string | null; visto: string | null }> {
  try {
    const l = await gmail("/labels", "POST", { name: t.BLOCCO, labelListVisibility: "labelHide", messageListVisibility: "hide" });
    await gmail(`/messages/${messageId}/modify`, "POST", { addLabelIds: [l.id] }).catch(() => null);
    return { preso: String(l.id), visto: null };
  } catch (err: any) {
    if (err?.status !== 409) return { preso: null, visto: null };
    try {
      const l = t.trovaEtichetta(await elencoEtichette(), t.BLOCCO);
      if (!l) return { preso: null, visto: null };
      const mie: string[] = (await gmail(`/messages/${messageId}?format=minimal`))?.labelIds ?? [];
      return mie.includes(l.id) ? { preso: l.id, visto: null } : { preso: null, visto: l.id };
    } catch {
      return { preso: null, visto: null };
    }
  }
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
  const etichette = await ctx.step({ name: "prepara-etichette-turno", maxAttempts: 10, retryDelaySeconds: 5, run: async () => {
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
  } });

  // Messa sul messaggio quando nulla è partito: resta in vista nella casella condivisa, da gestire a mano.
  const segnaNonInoltrata = (togli: string | null) =>
    ctx
      .step({
        name: "segna-non-inoltrata",
        maxAttempts: 3,
        run: async () =>
          gmail(`/messages/${messageId}/modify`, "POST", {
            addLabelIds: [etichette[t.ETICHETTA_ERRORE]],
            ...(togli ? { removeLabelIds: [togli] } : {}),
          }).then(() => true),
      })
      .catch(() => false);

  // Seguito di una conversazione già assegnata: niente giro e niente blocco. Tutto il resto (anche un messaggio
  // che porta già il proprio Turno/<nome>) viene riletto sotto blocco da scegli-turno.
  let assegnazione: { nome: string; seguito: boolean } | null = await ctx
    .step({
      name: "leggi-conversazione",
      maxAttempts: 10,
      retryDelaySeconds: 5,
      run: async () => {
        const a = t.assegnazioneEsistente(await leggiMessaggi(threadId, messageId), messageId, etichette);
        return a?.seguito ? { nome: a.persona.nome, seguito: true } : null;
      },
    })
    .catch(async (err) => {
      await segnaNonInoltrata(null);
      throw err;
    });

  if (!assegnazione) {
    // Conversazione nuova: una sola esecuzione alla volta legge e fa avanzare il giro.
    let blocco: string | null = null;
    let visto: string | null = null;
    let vistoDal = 0;
    for (let i = 0; i < TENTATIVI_BLOCCO && !blocco; i++) {
      const r = await ctx.step({ name: `prendi-blocco-${i}`, maxAttempts: 1, run: async () => prendiBlocco(messageId) });
      if (r.preso) {
        blocco = r.preso;
        break;
      }
      if (r.visto !== visto) {
        visto = r.visto;
        vistoDal = i;
      } else if (visto && i - vistoDal >= GIRI_BLOCCO_ABBANDONATO) {
        // Sempre lo stesso blocco (ogni presa crea un ID nuovo): lo si toglie per ID, mai per nome.
        // Se non riesce, si riprova al giro dopo.
        const id = visto;
        const tolto = await ctx.step({
          name: `forza-blocco-${i}`,
          maxAttempts: 1,
          run: async () => gmail(`/labels/${id}`, "DELETE").then(() => true, (err: any) => err?.status === 404),
        });
        if (tolto) visto = null;
      }
      await ctx.wait(`attendi-blocco-${i}`, ATTESA_BLOCCO_S + t.sfasamento(messageId, i));
    }
    if (!blocco) {
      await segnaNonInoltrata(null);
      throw new Error("Blocco dei turni non ottenuto: la mail è segnata ⛔ in support@");
    }
    const idBlocco = blocco;

    let erroreAssegnazione: unknown = null;
    let scelta: t.Scelta | null = null;
    try {
      // Decisione (solo lettura, riletta sotto blocco) e scrittura separate.
      scelta = await ctx.step({
        name: "scegli-turno",
        maxAttempts: 8,
        retryDelaySeconds: 5,
        run: async () => t.scegli(await leggiMessaggi(threadId, messageId), messageId, etichette, await elencoEtichette()),
      });
      const s = scelta;
      if (s.applica) {
        await ctx.step("applica-turno", async () => {
          if (s.aggiungi) await gmail(`/messages/${messageId}/modify`, "POST", { addLabelIds: [s.aggiungi] });
          for (const id of s.doppioni) {
            await gmail(`/labels/${id}`, "DELETE").catch((err: any) => {
              if (err?.status !== 404) throw err;
            });
          }
          if (s.rinomina && s.idProssimo) {
            await gmail(`/labels/${s.idProssimo}`, "PATCH", { name: s.nuovoNome });
          } else if (s.rinomina) {
            await gmail("/labels", "POST", { name: s.nuovoNome, labelListVisibility: "labelShow", messageListVisibility: "hide" }).catch(
              (err: any) => {
                if (err?.status !== 409) throw err; // già creata da un tentativo precedente
              },
            );
          }
          return true;
        });
      }
      assegnazione = { nome: s.nome, seguito: s.seguito };
    } catch (err) {
      erroreAssegnazione = err;
    }

    // Il rilascio non fa mai fallire l'esecuzione: un blocco rimasto viene tolto dalle altre dopo ~3 minuti.
    await ctx
      .step({
        name: "rilascia-blocco",
        maxAttempts: 3,
        run: async () =>
          gmail(`/labels/${idBlocco}`, "DELETE").then(
            () => true,
            (err: any) => {
              if (err?.status === 404) return true; // già tolto
              throw err;
            },
          ),
      })
      .catch(() => false);

    if (erroreAssegnazione || !assegnazione) {
      // Assegnazione non completata: via l'eventuale Turno/<nome> già messo, così la mail non sembra assegnata.
      const messa = scelta?.aggiungi ?? null;
      await segnaNonInoltrata(messa);
      throw erroreAssegnazione ?? new Error("Assegnazione non riuscita");
    }
  }

  const collega = t.SQUADRA.find((p) => p.nome === assegnazione!.nome) ?? t.SQUADRA[0];
  const seguito = assegnazione.seguito;
  const cliente = t.indirizzo(e.reply_to) || mittente;
  const nomeCliente = cliente === mittente ? t.nome(e.from) : t.nome(e.reply_to);
  const destinatari = [...(e.to?.emails ?? []), ...(e.cc?.emails ?? [])];
  const haAllegati = Number(e.attachment_count ?? 0) > 0;

  // Un inoltro: prima si controlla che non sia già partito (la nota contiene l'ID del messaggio), poi si avvia
  // una sola volta e se ne attende l'esito a parte, così un nuovo tentativo non manda mai una seconda copia.
  const inoltra = async (tipo: string, conAllegati: boolean): Promise<{ inviato: boolean; errore: string | null; incerto?: boolean }> => {
    let ultimoErrore: string | null = null;
    let forseInviato = false; // un avvio la cui risposta si è persa potrebbe aver mandato la mail
    for (let n = 1; n <= TENTATIVI_INOLTRO; n++) {
      // La ricerca sta nello stesso passo dell'avvio: se il passo viene rieseguito, si ricerca prima di riavviare.
      const avvio = await ctx.step({
        name: `avvia-inoltro-${tipo}-${n}`,
        maxAttempts: 1,
        run: async () => {
          try {
            const gia = await gmail(`/messages?q=${encodeURIComponent(`in:sent "${messageId}"`)}&maxResults=1`);
            if (gia?.messages?.length) return { run: null, gia: true, errore: null, ambiguo: false };
          } catch (err) {
            return { run: null, gia: false, errore: testoErrore(err), ambiguo: false };
          }
          try {
            const r = await sdk.createActionRun({
              app: GMAIL_APP,
              actionType: "write",
              action: "forward_email",
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
            return { run: String(r.data.id), gia: false, errore: null, ambiguo: false };
          } catch (err: any) {
            // Un rifiuto (4xx) è certo; un errore di rete o del server potrebbe aver avviato comunque l'inoltro.
            const stato = Number(err?.status ?? err?.statusCode ?? err?.response?.status ?? 0);
            return { run: null, gia: false, errore: testoErrore(err), ambiguo: !(stato >= 400 && stato < 500) };
          }
        },
      });
      if (avvio.gia) return { inviato: true, errore: null };
      if (avvio.run) {
        const run = avvio.run;
        const esito = await ctx
          .step({
            name: `esito-inoltro-${tipo}-${n}`,
            maxAttempts: 10,
            retryDelaySeconds: 15,
            run: async () => {
              const r = await sdk.getActionRun({ run });
              const stato = r.data.status;
              const errori = (r.data.errors ?? []).map((x: any) => x?.detail || x?.title || x?.code || "errore").join("; ");
              if (stato === "success" && !errori) return { ok: true, errore: null };
              if (stato === "success" || stato === "error") return { ok: false, errore: errori || `inoltro in stato ${stato} senza dettagli` };
              throw new Error(`Inoltro non ancora concluso (stato ${String(stato)})`); // waiting, unknown, altri: si riprova
            },
          })
          .catch((err) => ({ ok: null as boolean | null, errore: testoErrore(err) }));
        if (esito.ok) return { inviato: true, errore: null };
        if (esito.ok === null) return { inviato: false, errore: esito.errore, incerto: true }; // potrebbe ancora partire
        if (t.erroreDiDimensione(esito.errore)) return { inviato: false, errore: esito.errore };
        ultimoErrore = esito.errore;
      } else {
        ultimoErrore = avvio.errore;
        if (avvio.ambiguo) forseInviato = true;
      }
      if (n < TENTATIVI_INOLTRO) await ctx.wait(`riprova-inoltro-${tipo}-${n}`, 60 * n);
    }
    return { inviato: false, errore: ultimoErrore, incerto: forseInviato };
  };

  const giaDestinatario = t.giaDestinatario(collega, destinatari);
  let senzaAllegati = false;
  if (!giaDestinatario) {
    let esito = await inoltra("con-allegati", true);
    if (!esito.inviato && !esito.incerto && haAllegati && t.erroreDiDimensione(esito.errore)) {
      esito = await inoltra("senza-allegati", false);
      senzaAllegati = esito.inviato;
    }
    if (!esito.inviato) {
      // ⛔ in vista nella casella condivisa. L'assegnazione si toglie solo se è certo che non è partito nulla:
      // con esito incerto la copia può ancora arrivare al collega, e i seguiti devono andare a lui.
      await segnaNonInoltrata(seguito || esito.incerto ? null : etichette[t.nomeEtichetta(collega)]);
      throw new Error(`Inoltro a ${collega.nome} non riuscito${esito.incerto ? " (esito incerto, verificare)" : ""}: ${esito.errore ?? ""}`);
    }
  }

  // Turno anche sul singolo messaggio (per i seguiti) e via l'eventuale ⛔ di un tentativo precedente.
  // La copia è già partita: un errore qui non deve far fallire l'esecuzione.
  await ctx
    .step({
      name: "completa-etichette",
      maxAttempts: 8,
      retryDelaySeconds: 5,
      run: async () =>
        gmail(`/messages/${messageId}/modify`, "POST", {
          addLabelIds: [etichette[t.nomeEtichetta(collega)]],
          removeLabelIds: [etichette[t.ETICHETTA_ERRORE]],
        }).then(() => true),
    })
    .catch(() => false);

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
