# Piano: anagrafica automatica da Gmail a Shopify

Stato: **approvato da Denis il 30/09/2026**, con una regola aggiuntiva vincolante (sezione 4).

## 1. Punto di partenza

- Il sistema precedente girava come sessione Claude sul PC (Remote Control): si fermava a PC spento e al
  raggiungimento dei limiti d'uso. Inoltre il connettore Gmail di Claude vede solo i **nomi** degli allegati, non il
  contenuto: le carte d'identità non potevano essere lette. Il codice non era né su GitHub né su Drive.
- Migelino usa già Google Apps Script (salvataggio automatico delle audiometrie su Drive): stessa piattaforma.
- Esiste una **verità di riferimento** per misurare il sistema: le conversazioni in cui la mail del paziente viene
  inoltrata all'ufficio ordini con "possiamo creare l'ordine", e l'anagrafica poi creata a mano su Shopify
  (circa 70 casi in 4 mesi).
- Volumi: circa 30 conversazioni esterne al giorno, 4-5 conferme a settimana.

## 2. Architettura

| Componente | Ruolo |
|---|---|
| Google Apps Script (account Gmail di Migelino) | Legge Gmail e allegati, gira ogni 10 minuti nel cloud Google, orchestra tutto |
| Claude API | Riconoscimento della conferma e lettura di documenti e mail, con risposte in JSON a schema fisso |
| Shopify Admin API (app del Dev Dashboard) | Ricerca, creazione e completamento del cliente (permessi solo clienti) |
| Foglio Google "Registro" | Ogni decisione con link a mail e cliente, campi scritti/mancanti e motivi; collaudo |
| GitHub | Codice e test automatici, nessun dato di pazienti |

Scartate: routine Claude (non leggono gli allegati, minimo un'esecuzione all'ora, soggette ai limiti d'uso),
Zapier (poco controllo sulla qualità dei dati).

## 3. Riconoscimento della conferma

Regole ed esempi in [TARATURA.md](TARATURA.md). In sintesi: conferme esplicite, preventivo firmato, accettazione
della prova e invio dei documenti richiesti per procedere sono **conferme**; consenso GDPR, domande su come
procedere, appuntamenti e assistenza **non lo sono**.

- Probabilità ≥ 85% ed esito "conferma" → si procede.
- Tra 60% e 85% → etichetta "Conferma dubbia", nessuna scrittura (si può forzare con l'etichetta "▶ Crea").
- Sotto 60% → ignorata.

Taratura: le 10 mail proposte il 30/09/2026 sono state **validate da Denis** (8 conferme, 1 non conferma,
1 dubbia): sono gli esempi di riferimento del riconoscimento.

## 4. Regola vincolante sui dati minimi

> "Se vedi che c'è una carenza di dati importanti non creare. È importantissimo che ci sia sempre l'indirizzo di
> residenza e di spedizione. Se mancano questi, allora non creare nulla." — Denis, 30/09/2026

Implementazione (`src/11_decisione.js`):

- Obbligatori per creare: **nome, cognome, residenza, spedizione**, ciascuno letto con confidenza ≥ soglia e
  superando i controlli (indirizzo completo di via, civico, CAP, comune e provincia coerenti).
- **Residenza** valida solo se presa dal documento d'identità, da una dichiarazione esplicita del paziente o dal
  preventivo firmato. L'indirizzo nella firma della mail non basta (può essere l'ufficio).
- **Spedizione** valida solo se indicata dal paziente, oppure se il paziente dice esplicitamente che coincide con la
  residenza. Non viene mai presunta.
- Se manca anche uno solo di questi dati: **nessuna scrittura** su Shopify, etichetta "⚠️ Dati mancanti", motivo nel
  Registro. Quando il paziente manda il dato mancante il sistema riprova da solo, senza bisogno di una nuova conferma.
- Il codice fiscale **non** è obbligatorio: se manca o non supera i controlli resta vuoto e lo inserisce l'ufficio.

## 5. Soglia di incertezza

Partenza all'**85%** (più prudente del 70% proposto), perché la sicurezza dichiarata dai modelli tende a essere
ottimista. Il collaudo sullo storico misura accuratezza e copertura di ogni campo per le soglie 50-95%: si sceglie la
soglia più bassa che dà almeno il 98% di campi corretti. Si cambia dal Foglio senza toccare il codice
(proprietà `SOGLIA_CAMPO`).

## 6. Fasi

| Fase | Chi | Cosa | Stato |
|---|---|---|---|
| 1. Taratura | Denis + Claude | Validazione delle 10 mail, regole ed esempi | Fatto |
| 2. Sviluppo | Claude | Codice Apps Script modulare e test automatici | Fatto |
| 3. Installazione | Denis (circa 15 minuti) | Chiavi Claude e Shopify, Foglio, incolla del codice, `Configura` | Da fare |
| 4. Collaudo sullo storico | automatico | Circa 70 conferme e 90 casi di controllo, confronto con le anagrafiche fatte a mano | Da fare |
| 5. Prova in parallelo | automatico, 5 giorni lavorativi | Modalità OMBRA: registra senza scrivere, confronto con il lavoro dell'ufficio | Da fare |
| 6. Avvio | Denis dà l'ok | Modalità LIVE | Da fare |

## 7. Obiettivi di qualità prima dell'avvio

- Riconoscimento: almeno il 97% di decisioni corrette sullo storico.
- Campi scritti: almeno il 98% corretti; **zero codici fiscali sbagliati** (garantito dai controlli di coerenza).
- In caso di dubbio il sistema non scrive: un campo vuoto costa un minuto all'ufficio, un campo sbagliato finisce in fattura.

## 8. Costi stimati

Claude API: circa 10-20 euro al mese a regime, più circa 15-25 euro una volta sola per il collaudo sullo storico.
Google Apps Script e Shopify API: nessun costo aggiuntivo.

## 9. Estensione a più caselle (30/09/2026)

Richiesta di Denis: il sistema deve lavorare anche sulle caselle dei colleghi (Silvia, Marco), tutte nella stessa
organizzazione Google Workspace.

- **Un solo Foglio con lo script**, condiviso con i colleghi; ognuno attiva il controllo sulla propria casella dal
  menu. Il trigger gira con l'account di chi lo attiva, quindi legge la sua casella (niente deleghe di dominio né
  account di servizio).
- Memoria **per casella** (proprietà utente): ultimo controllo, messaggi già elaborati.
- Memoria **condivisa** (proprietà dello script): stato dei pazienti (con i dati parziali quando mancano residenza o
  spedizione), caselle attive e ora dell'ultimo giro.
- Scrittura su Shopify sotto un **blocco condiviso** tra le caselle; se il cliente risulta creato nel frattempo
  ("email già usata") si rilegge e si completa invece di duplicare.
- **Registro unico** con la colonna "Casella".
- Filtro: un paziente che risponde a una mail di un collega (citazione di un indirizzo Migelino nel testo) è
  considerato "in contatto" anche se da quella casella non gli si è mai scritto.
- Il collaudo sullo storico si avvia dall'account che inoltra le conferme all'ufficio ordini.

## 10. Possibili sviluppi (non inclusi)

- Bozza di risposta al paziente per chiedere il dato mancante (senza invio automatico).
- Creazione della bozza d'ordine su Shopify.
- Estensione ai documenti ricevuti su WhatsApp.
- Conversione automatica delle foto iPhone in formato HEIC (oggi segnalate come non leggibili).
