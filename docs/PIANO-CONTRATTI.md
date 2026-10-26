# Piano: contratto di vendita compilabile

Stato: **approvato da Denis il 26/10/2026** con una modifica: **nessun collegamento a Shopify, dati inseriti a mano**.
Le altre scelte seguono le opzioni consigliate (sezione 9). Realizzato: vedi [CONTRATTI.md](CONTRATTI.md).
Nessun dato di pazienti in questo documento né nel codice: gli esempi sono inventati.

## 1. Obiettivo

L'ufficio apre il gestionale (il Foglio "Anagrafiche automatiche - Registro" con lo script), compila o precompila
i dati del contratto, vede il contratto aggiornarsi dal vivo e con un clic ottiene il **PDF** pronto da inviare,
già archiviato e registrato. Oggi il contratto viene preparato di volta in volta a mano: il risultato è buono ma
lento, e gli errori di trascrizione (indirizzo, telefono, destinatario) finiscono davanti al cliente.

Riferimento grafico e testuale: il PDF "Contratto di vendita" fornito da Denis (2 pagine A4: intestazione con
logo, 5 sezioni, totale in evidenza, firme, piè di pagina con numero di pagina).

## 2. Cosa fa, in breve

```
Menu "Contratti" > Nuovo contratto
 ① (facoltativo) Precompila da Shopify: numero bozza d'ordine (#D123), numero ordine (IT-O-1234) o email
    → cliente, codice fiscale, indirizzi, telefono, righe di fornitura, sconti, finanziamento, operatore
 ② Modulo a sinistra, anteprima del contratto a destra (si aggiorna a ogni modifica)
 ③ Controlli automatici: codice fiscale, CAP/provincia, telefono, importi, campi obbligatori
 ④ "Genera PDF": PDF su Drive (Contratti/<anno>/Cognome_Contratto_Nome_data.pdf), numero progressivo,
    riga nel foglio "Contratti" con i link, [bozza Gmail con allegato], [nota e tag sull'ordine Shopify]
```

Le parti tra [ ] dipendono dalle risposte della sezione 9.

## 3. Dove vive

Nello **stesso progetto Apps Script** del Foglio, accanto all'anagrafica automatica: stesse chiavi Shopify, stesso
Registro, stessa installazione (si incolla di nuovo `dist/Anagrafica.gs`). Nuovo menu **Contratti** nel Foglio.
Ogni collega lo usa con il proprio account: l'operatore (e la firma) viene riconosciuto dall'account.

In alternativa (o in aggiunta) lo stesso codice può essere pubblicato come **web app** con un proprio indirizzo,
apribile senza passare dal Foglio.

## 4. Il modello del contratto

Un unico modello HTML/CSS fedele al PDF, usato sia per l'anteprima nel browser sia per il PDF. Struttura:

| Sezione | Contenuto | Campi compilabili |
|---|---|---|
| Intestazione | Logo, titolo, sottotitolo, riferimento preventivo, data di sottoscrizione | Sottotitolo (proposto in automatico dalla fornitura), n. e data preventivo, data |
| 1. Parti e dati del cliente | Venditore (fisso, configurabile), cliente | Titolo (Sig./Sig.ra), nome, cognome, codice fiscale, via e civico, scala/interno, CAP, comune, provincia, telefono, email |
| 2. Fornitura e prezzo | Righe con importi, sconti, omaggi, totale IVA inclusa, nota sulla fornitura | Righe libere (descrizione, dettaglio es. colore, quantità, prezzo, sconto), sconto complessivo, omaggi (valore mostrato e addebito 0), nota |
| 3. Pagamento e consegna | Modalità, importi, piano rate, indirizzo e destinatario di consegna | Modalità (bonifico, carta/link, HeyLight, rate Migelino, ...), parametri (n. rate, maggiorazione %), consegna diversa dalla residenza, destinatario diverso |
| 4. Servizi e condizioni | Testi fissi con varianti automatiche | Interruttori: prova 30 giorni, omaggio, finanziamento, garanzia/estensione |
| 5. Accettazione e firme | Testo fisso, luogo e data, firma cliente, firma Migelino | Operatore (firma dall'account), luogo |
| Piè di pagina | Ragione sociale, sito, email, telefono, "Pagina X di Y" | fisso, configurabile |

Calcoli automatici (mai a mano): subtotali, sconti, totale, interessi del finanziamento (es. 6% dell'importo),
totale da rimborsare, piano rate con l'ultima rata di conguaglio (11 rate da 298,57 € e ultima da 298,53 €),
formato italiano degli importi (3.580,00 €) e delle date.

Controlli (riusano i moduli già esistenti): codice fiscale valido e coerente con nome e cognome
(`CodiceFiscale`), CAP coerente con la provincia e nome ufficiale del comune (`Comuni`), telefono in formato
internazionale (`Telefono`), maiuscole di nomi e indirizzi (`Testo`). Il pulsante "Genera PDF" resta disattivato
finché mancano i campi obbligatori; i controlli non bloccanti mostrano un avviso.

Il totale del contratto viene confrontato con il totale della bozza/ordine Shopify quando il contratto è stato
precompilato: se non coincidono, avviso prima di generare.

## 5. Precompilazione da Shopify

L'ufficio crea già la bozza d'ordine su Shopify con tutto: cliente, codice fiscale (campo Azienda dell'indirizzo),
indirizzi, righe prodotto, sconto, riga "oneri finanziari", tag della modalità di pagamento e dell'operatore.
Il contratto si precompila da lì, a partire dal numero della bozza (#D123), dell'ordine (IT-O-1234) o dall'email
del cliente (ultima bozza/ordine). Mappatura prevista:

- cliente e indirizzi → sezione 1 e consegna (indirizzo di spedizione = consegna, fatturazione = residenza);
- righe prodotto → righe di fornitura (colore dalla variante, omaggio = riga con sconto integrale);
- sconto complessivo → "Sconto" sulla riga principale;
- riga "oneri finanziari" + tag della finanziaria → modalità di pagamento rateale e parametri;
- tag con il nome dell'operatore → operatore e firma.

Richiede sull'app Shopify i permessi `read_orders` e `read_draft_orders` (nuova versione dell'app nel Dev
Dashboard). Tutto resta modificabile dopo la precompilazione.

## 6. Generazione del PDF e archivio

- **PDF dal sistema** (un clic): lo script converte il modello HTML in PDF (`Utilities.newBlob(...).getAs(PDF)`),
  lo salva su Drive nella cartella `Contratti/<anno>` con nome `Cognome_Contratto_Nome_AAAA-MM-GG.pdf` (stessa
  convenzione dei preventivi già su Drive) e restituisce il link. Il convertitore di Apps Script gestisce un
  sottoinsieme di CSS: il modello viene scritto in quel sottoinsieme (tabelle, immagini incorporate, interruzioni
  di pagina esplicite). Se alla prima prova sul vostro Apps Script la resa non fosse accettabile, il PDF viene
  generato nel browser (libreria `pdfmake`) e caricato su Drive dallo script: stesso risultato per l'ufficio.
- **Stampa dal browser** sempre disponibile come alternativa ("Salva come PDF").
- **Numero progressivo** del contratto (es. 2026/0001) assegnato alla generazione, sotto blocco condiviso tra le
  caselle, se richiesto.
- **Foglio "Contratti"** nel Registro: data, operatore, numero, cliente, email, bozza/ordine Shopify, totale,
  modalità di pagamento, link PDF, link Shopify, stato (generato / firmato), e i dati del contratto in JSON per
  poterlo **riaprire e correggere** (es. errore nell'indirizzo segnalato dal cliente) generando una nuova versione.
- Firma Migelino: immagine della firma **fuori dal repository** (che è pubblico): su Drive, con l'ID nelle
  impostazioni, una per operatore. Il logo, pubblico, è incorporato nel codice.

## 7. Struttura del codice

```
src/19_contratto_testi.js     testi fissi e varianti (sezioni 4 e 5, note), dati del venditore
src/20_contratto_calcoli.js   righe, sconti, totali, piano rate, formati italiani, validazioni   (puro JS, testato)
src/21_contratto_modello.js   dati → HTML del contratto (lo stesso per anteprima e PDF)         (puro JS, testato)
src/22_contratto_shopify.js   bozza/ordine Shopify → dati del contratto                        (testato con API finta)
src/23_contratto_archivio.js  PDF, Drive, numerazione, foglio Contratti, [bozza Gmail], [nota Shopify]
src/24_contratto_ui.js        menu, finestra, funzioni chiamate dalla pagina
src/html/contratto.html       la pagina (modulo + anteprima); il build la incorpora nel file unico dist/
```

Il build continua a produrre **un solo file** da incollare (`dist/Anagrafica.gs`): la pagina HTML e il modello
vengono incorporati come costanti. I moduli "puri" girano anche nel browser (anteprima dal vivo senza chiamate al
server) e in Node (test automatici con dati inventati). Il modello viene provato qui con Chromium prima della
consegna, producendo un PDF di esempio da approvare.

## 8. Fasi

| Fase | Cosa | Esito |
|---|---|---|
| 0 | Risposte alle domande della sezione 9 | Piano definitivo |
| 1 | Modello HTML/CSS fedele al PDF + calcoli + testi, con dati inventati; PDF di esempio | Denis approva l'aspetto |
| 2 | Finestra nel Foglio: modulo, anteprima dal vivo, controlli, Genera PDF → Drive + Registro + numero | Prima versione usabile |
| 3 | Precompilazione da Shopify (permessi ordini sull'app) | Contratto in 1 minuto dalla bozza d'ordine |
| 4 | Uscite facoltative: bozza Gmail con allegato, nota e tag sull'ordine Shopify | Da decidere |
| 5 | Documentazione (`docs/CONTRATTI.md`, aggiornamento installazione) e collaudo con l'ufficio | Avvio |
| 6 (dopo) | Firma elettronica del cliente via link (firma col dito, PDF finale con data e ora) | Da decidere |

## 9. Scelte fatte (26/10/2026)

| Scelta | Decisione |
|---|---|
| Sede della funzione | Menu **Contratti** nel Foglio del gestionale; `doGet` pronto per la pubblicazione come app web |
| Precompilazione | **Nessuna: tutto a mano** (decisione di Denis). Le sezioni 5 e la fase 3 di questo piano non sono state realizzate |
| Numero del preventivo | Campo libero, anche vuoto |
| Numerazione del contratto | Progressiva per anno, es. `2026/0001`, nelle Proprietà dello script |
| Modalità di pagamento | Bonifico anticipato, carta o link online, finanziamento con finanziaria (rate e maggiorazione %), rate Migelino senza interessi, altro |
| Firma Migelino | Immagine per operatore su Drive, impostata dal menu; senza immagine si firma a mano |
| Dopo "Genera PDF" | PDF su Drive in `Contratti/<anno>` e riga nel foglio **Contratti**; bozza Gmail con allegato a richiesta (mai inviata); niente scritture su Shopify |
| Garanzia | Periodo di garanzia esplicito nella sezione 4 (mesi dalla consegna) con eventuale estensione concordata; una voce in fornitura si aggiunge come riga |
| Firma del cliente | Su carta (stampa, firma, scansione). Firma elettronica via link: possibile fase successiva |
| Testi legali | Fissi nel codice con varianti automatiche (omaggio, finanziamento, prova) |
| Dati del venditore | Quelli del PDF di riferimento (Migelino AG, Blegistrasse 13, Baar); modificabili dalle Proprietà dello script |

## 10. Privacy e sicurezza

- Nessun dato di pazienti nel repository (pubblico): esempi e test con persone inventate; firme su Drive.
- I PDF restano su Drive dell'organizzazione, nella cartella scelta; il Registro contiene i dati del contratto
  (necessari per riaprirlo): il Foglio va condiviso solo con l'ufficio.
- Il sistema non invia email da solo: al massimo prepara una bozza.
- I testi legali vengono riprodotti dal PDF attuale; eventuali modifiche di merito restano a carico di Migelino e del
  suo consulente.
