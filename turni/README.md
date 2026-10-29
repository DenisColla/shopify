# Turni della casella condivisa

> **Versione attiva: Zapier** (workflow durevole `Turni support@migelino.ch → Denis, Marco, Silvia`,
> sorgente in [zapier/](zapier/)). Lo script Apps Script qui sotto resta come alternativa: **non installarlo
> insieme a Zapier**, altrimenti ogni mail arriva due volte.

## Versione Zapier (attiva)

- **Trigger:** Gmail *New Email* sulla Posta in arrivo di support@migelino.ch (controllo periodico di Zapier).
- **Giro:** l'etichetta `Turno/➜ prossimo: <nome>` in support@ dice chi riceve la prossima conversazione nuova.
  Per cambiare il prossimo basta rinominarla (es. `Turno/➜ prossimo: Silvia`).
- **Conversazioni:** etichetta `Turno/Denis`, `Turno/Marco`, `Turno/Silvia`; le risposte del cliente vanno allo stesso
  collega. Per riassegnare: togliere l'etichetta e mettere quella del nuovo collega.
- **Mail arrivate insieme:** un blocco (etichetta nascosta `Turno/🔒 assegnazione in corso`, creata e tolta in pochi
  secondi) fa assegnare una conversazione alla volta: nessun collega salta il turno, nessuna conversazione divisa.
- **Inoltro nativo Gmail** con allegati e formattazione; mittente mostrato come "<cliente> via Support",
  "Rispondi" scrive al cliente. Se gli allegati non passano si inoltra senza, con un avviso; se non passa nulla:
  etichetta `Turno/⛔ Non inoltrata` in support@ ed esecuzione segnata come fallita in Zapier.
- **Mai inoltrate:** mail della casella stessa, dei tre colleghi, avvisi di mancata consegna; nessun doppione se il
  collega è già in copia o se un tentativo viene ripetuto.
- **Squadra e ordine:** `SQUADRA` in [zapier/lib/turni.ts](zapier/lib/turni.ts) (modifica dall'editor Zapier o qui e
  ripubblicazione). Per fermare tutto: disattivare il workflow in Zapier.
- Test: `tests/turni-zapier.test.mjs` (logica) e `tests/turni-zapier-workflow.test.mjs` (flusso completo su una Gmail
  simulata: mail simultanee, blocco abbandonato, errori, doppioni).

## Versione Apps Script (alternativa)

Ogni mail che arriva alla casella condivisa **support@migelino.ch** viene **inoltrata a turno** a un collega:
Denis → Marco → Silvia → Denis → …

- **Una conversazione = un collega.** Se il cliente risponde nella stessa conversazione, la risposta va allo stesso
  collega e il giro non avanza. Per il turno puro (ogni singola mail al successivo) mettere
  `STESSA_PERSONA_PER_CONVERSAZIONE: false`.
- **Rispondere è diretto:** "Rispondi" sulla mail inoltrata scrive al cliente (anche per i moduli Shopify, che hanno
  il cliente nel Reply-To). Con `RISPOSTA_AL_CLIENTE: false` si risponde invece alla casella condivisa.
- **Si vede chi ce l'ha:** nella casella condivisa ogni conversazione ha l'etichetta `Turno/Denis`, `Turno/Marco` o
  `Turno/Silvia`. Per **riassegnare** basta cambiare l'etichetta (togliere la vecchia): le risposte successive vanno
  al nuovo collega.
- **Mai inoltrate:** le mail inviate dalla casella stessa, quelle dei tre colleghi (risposte automatiche, copie) e i
  messaggi di errore di consegna: niente giri infiniti.
- Le mail già presenti al momento dell'installazione non vengono inoltrate.
- Gira ogni minuto, gratis, dentro Google: nessun servizio esterno, nessun PC acceso.

## Installazione (5 minuti)

Requisito: la casella condivisa è un account Google Workspace (con accesso a Gmail), non un gruppo Google.

1. Accedi a [script.google.com](https://script.google.com) **con l'account support@migelino.ch** →
   **Nuovo progetto** → chiamalo `Turni casella condivisa`.
2. Cancella il contenuto di `Codice.gs` e incolla tutto [Turni.gs](Turni.gs).
3. In cima al file, `SQUADRA` contiene già denis@, marcoz@ e silvia@migelino.it (l'ordine della lista è
   l'ordine del giro): controlla e salva.
4. In alto scegli la funzione **installaTurni** → **Esegui** → autorizza con l'account support@migelino.ch.
   Se Google mostra "app non verificata": *Avanzate → Vai a Turni casella condivisa*.
5. Prova: manda una mail alla casella condivisa da un indirizzo esterno. Entro un minuto arriva a Denis, con
   etichetta `Turno/Denis` nella casella condivisa. La successiva arriva a Marco.

Altre funzioni dal menu **Esegui**: `statoTurni` (prossimo collega e ultimo controllo, in *Registro di
esecuzione*), `disinstallaTurni` (ferma tutto; reinstallando si riparte dalle mail nuove e il giro continua).

## Da sapere

- **Anagrafica automatica:** le mail inoltrate arrivano ai colleghi da un indirizzo interno e quindi l'Anagrafica le
  ignora (vedi [INSTALLAZIONE.md](../docs/INSTALLAZIONE.md), sezione E). Se alla casella condivisa scrivono anche
  pazienti che confermano l'acquisto, attivare l'Anagrafica **anche sulla casella condivisa** (sezione E, punto 2,
  con l'account della casella condivisa): così legge la mail originale.
- **Limiti Google:** fino a 1.500 inoltri al giorno per account Workspace. Una mail che non si riesce a inoltrare
  (es. allegati oltre 25 MB) viene ritentata 3 volte, poi riceve l'etichetta `Turno/⛔ Non inoltrata` e va gestita a
  mano dalla casella condivisa.
- **Casella fuori da Google** (es. un provider esterno): impostare sul provider l'inoltro automatico verso un account
  Google Workspace e installare i turni su quell'account.
- Ferie di un collega: togliere la sua riga da `SQUADRA` (o spostarla in fondo) e salvare; il giro si adatta.
