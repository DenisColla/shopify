# Installazione (circa 15 minuti)

Servono tre cose: una **chiave API di Claude**, un'**app Shopify** con permessi sui clienti e un **Foglio Google**
che contiene lo script. Tutto si fa dal browser. L'installazione si fa **una volta sola** (sezioni A-D); poi ogni
collega attiva il controllo sulla propria casella con un clic (sezione E).

I valori da inserire che non sono in questo documento (identificativo del modello Claude e dominio `.myshopify.com`
del negozio) vengono comunicati a parte al momento dell'installazione.

## A. Chiave API di Claude (5 minuti)

1. Vai su **console.anthropic.com** e accedi (o crea un account per Migelino).
2. **Settings → Billing**: aggiungi un metodo di pagamento e un credito iniziale (es. 30 euro).
   Consigliato: imposta un **limite di spesa mensile** (es. 50 euro) come rete di sicurezza.
3. **Settings → API Keys → Create Key**, nome "Anagrafica automatica". Copia la chiave (inizia con `sk-ant-`):
   si vede una volta sola.

## B. App Shopify (10 minuti, da un account con permesso di sviluppare app, di solito il proprietario del negozio)

Shopify non permette più di creare le vecchie "app personalizzate" dal pannello di amministrazione: si usa il
**Dev Dashboard**.

1. Vai su **dev.shopify.com** (Dev Dashboard) con l'account dell'organizzazione che possiede il negozio.
2. **Create app** → nome "Anagrafica automatica".
3. **Versions → Create version**:
   - *App URL*: `https://shopify.dev/apps/default-app-home` (l'indirizzo predefinito di Shopify per le app senza
     schermate: questa lavora solo in background);
   - *Scopes*: `read_customers`, `write_customers`;
   - lascia il resto com'è → **Release**.
4. Se compare la voce **Protected customer data**: seleziona i campi *Name*, *Email*, *Phone*, *Address* con
   motivazione "Creazione dell'anagrafica clienti dalle conferme d'ordine". Se non compare, salta questo passo: per le
   app usate solo sui negozi della propria organizzazione l'accesso ai dati dei clienti è già disponibile, senza
   revisione.
5. **Install app** → scegli il negozio → **Install**.
6. **Settings**: copia **Client ID** e **Client secret**.

Alternativa: se esiste già un'app con un token di accesso Admin API (inizia con `shpat_`) e i permessi sui clienti,
si può usare quel token al posto di Client ID/Secret.

## C. Foglio Google e script (5 minuti)

1. In Google Drive crea un nuovo **Foglio Google** chiamato "Anagrafiche automatiche - Registro".
2. Menu **Estensioni → Apps Script**. Si apre l'editor con un file `Codice.gs`.
3. Cancella tutto il contenuto di `Codice.gs` e incolla il contenuto di
   [`dist/Anagrafica.gs`](../dist/Anagrafica.gs) (su GitHub: pulsante *Raw*, poi seleziona tutto e copia).
4. Consigliato: **Impostazioni progetto** (ingranaggio) → spunta *Mostra il file manifest "appsscript.json"* →
   torna all'editor, apri `appsscript.json` e sostituiscilo con [`dist/appsscript.json`](../dist/appsscript.json).
   Così i permessi richiesti sono esattamente quelli necessari e il fuso orario è quello italiano.
5. **Salva** (icona del dischetto). Torna al Foglio e **ricarica la pagina**: compare il menu **Anagrafiche**.
6. **Anagrafiche → 1. Configura chiavi e impostazioni**. Google chiede di autorizzare lo script:
   *Continua* → scegli l'account → se appare "Google non ha verificato questa app" clicca *Avanzate* →
   *Vai a … (non sicuro)* → *Consenti* (è normale per gli script propri). Poi inserisci:
   - la chiave API di Claude;
   - l'identificativo del modello Claude (comunicato a parte);
   - il dominio del negozio (`…myshopify.com`, comunicato a parte);
   - Client ID e Client secret di Shopify. L'ultima domanda (token fisso) va lasciata **vuota**: serve solo a chi non
     ha Client ID/Secret.

   In ogni domanda: vuoto = lascia il valore attuale, `-` = cancellalo.
7. **Anagrafiche → 2. Verifica connessioni e caselle**: devono risultare OK Claude, Shopify (con "clienti leggibili")
   e Gmail. Se una riga dà errore, sotto c'è l'indicazione di cosa controllare.
8. **Anagrafiche → 3. Attiva il controllo sulla mia casella**. Parte in modalità **OMBRA**: registra nel foglio
   "Registro" cosa farebbe, senza scrivere su Shopify.

## D. Collaudo e avvio

1. **Anagrafiche → Avvia collaudo sullo storico**, dall'account che inoltra le conferme all'ufficio ordini: chiede
   l'email dell'ufficio ordini, poi rilegge le conferme degli ultimi mesi (sola lettura) e le confronta con le
   anagrafiche create a mano. Dura 1-2 ore e prosegue da solo. Il risultato è nel foglio "Riepilogo collaudo"
   (precisione del riconoscimento e accuratezza di ogni campo per soglia).
2. **Prova in parallelo** per circa 5 giorni lavorativi: l'ufficio lavora come sempre, il sistema registra cosa
   avrebbe fatto. Si confrontano le righe del Registro con le anagrafiche reali.
3. Con risultati buoni: **Anagrafiche → Cambia modalità** → **LIVE** (vale per tutte le caselle).

Note:

- Le conferme arrivate durante la modalità OMBRA restano da gestire a mano: il sistema non le rielabora al passaggio in
  LIVE. Per una singola conversazione si può sempre usare l'etichetta `Anagrafica/▶ Crea`.
- Per aggiornare il codice: incollare di nuovo `dist/Anagrafica.gs` e salvare. Impostazioni e memoria restano.
- Per fermare una casella: da quell'account, **Anagrafiche → Disattiva il controllo sulla mia casella**.
- Condividi il Foglio solo con chi deve vederlo: chi può modificarlo può vedere anche le impostazioni dello script
  (comprese le chiavi).

## E. Attivare le caselle dei colleghi (2 minuti a testa)

Lo stesso Foglio, con lo stesso script, lavora su più caselle della stessa organizzazione Google Workspace: il controllo
gira con l'account di chi lo attiva e legge la sua casella. Chiavi, regole, modalità e Registro sono in comune; non va
reinstallato nulla.

1. Dal Foglio: **Condividi** → aggiungi i colleghi (i loro indirizzi `@migelino`) come **Editor**.
2. Ogni collega apre il Foglio con il **proprio account**, poi **Anagrafiche → 3. Attiva il controllo sulla mia
   casella** e autorizza lo script con il proprio account (stessa schermata di autorizzazione vista sopra).
   Non serve rifare "Configura".
3. Da qualsiasi account, **Anagrafiche → 2. Verifica connessioni e caselle** mostra tutte le caselle attive e l'ora
   dell'ultimo controllo di ciascuna.

Come si comporta con più caselle:

- Il Registro è unico: la colonna **Casella** dice da quale casella arriva ogni riga.
- Se lo stesso paziente scrive a più persone (es. in copia), il cliente viene creato **una volta sola**: le altre
  caselle lo trovano già esistente e segnano "✅ Completata".
- Se il paziente manda i documenti a una casella e l'indirizzo a un'altra, i dati vengono **uniti**: la conferma
  "Dati mancanti" di una casella si completa con la mail arrivata all'altra. Per farlo, i dati letti restano nella
  memoria condivisa dello script finché l'anagrafica non è completa (al massimo 45 giorni).
- Le etichette in Gmail sono di ciascuna casella; a ogni giro ogni casella aggiorna le proprie conversazioni
  "Dati mancanti" se il paziente è stato completato altrove.
- Le mail inoltrate tra colleghi (es. "Fwd:" da Denis a Silvia) vengono ignorate: il mittente è interno.
- Se Google blocca l'autorizzazione ("app bloccata dall'amministratore"), l'amministratore di Google Workspace deve
  consentire lo script: Console di amministrazione → Sicurezza → Controlli API → Controllo accesso app.

## Impostazioni avanzate (Proprietà dello script)

Editor Apps Script → Impostazioni progetto → Proprietà dello script:

| Proprietà | Predefinito | Significato |
|---|---|---|
| `MODALITA` | `OMBRA` | `OMBRA` oppure `LIVE` |
| `SOGLIA_CAMPO` | `0.85` | Confidenza minima perché un campo venga scritto |
| `SOGLIA_CONFERMA` | `0.85` | Probabilità minima per considerare un messaggio una conferma |
