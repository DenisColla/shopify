# Contratto di vendita: guida all'uso

Dal Foglio del gestionale, menu **Contratti → Nuovo contratto di vendita**: si compila il modulo a sinistra, il
contratto a destra si aggiorna da solo e con **Genera PDF** il file finisce su Drive, numerato e registrato.
I dati si inseriscono a mano (nessun collegamento a Shopify).

## Prima volta (ogni operatore, 2 minuti)

1. **Contratti → Imposta il mio nome e la mia firma**: nome e cognome che compaiono sotto "Firma per Migelino AG" e
   il link di un file PNG o JPG su Drive con la propria firma su sfondo bianco (foto o scansione ritagliata).
   Senza firma lo spazio resta vuoto e si firma a mano dopo la stampa. Ogni operatore vede solo la propria firma.
2. Facoltativo, una volta sola per tutti: **Contratti → Imposta la cartella Drive dei contratti**. Se non si imposta
   nulla, i PDF vanno nella cartella `Contratti` creata accanto al Foglio, con una sottocartella per anno.

## Compilare il contratto

| Parte | Cosa inserire | Note |
|---|---|---|
| Intestazione | Numero e data del preventivo, data di sottoscrizione, luogo, sottotitolo | Sottotitolo vuoto = proposto dalla fornitura. Data di sottoscrizione vuota = riga da compilare a mano alla firma |
| 1. Cliente | Titolo, nome, cognome, codice fiscale, indirizzo, CAP, comune, provincia, telefono, email | Obbligatori: nome, cognome, indirizzo, CAP, comune, provincia. Il codice fiscale è controllato (carattere di controllo e coerenza con nome e cognome); CAP e provincia devono essere compatibili |
| 2. Fornitura | Una voce per prodotto o accessorio: descrizione, quantità, prezzo unitario, sconto in euro, omaggio, dettaglio | Il dettaglio (es. "Colore selezionato: Honey Beige") viene stampato sotto la voce. Con uno sconto compaiono la riga dello sconto e il prezzo dopo lo sconto; con **omaggio** compaiono il valore e lo sconto integrale. Le etichette delle righe sono modificabili |
| Nota sotto il totale | Testo libero | Vuota = proposta in automatico (omaggi e spedizione inclusa) |
| 3. Pagamento | Modalità e parametri | Bonifico anticipato, carta o link online, finanziamento con finanziaria (rate e maggiorazione %), rate Migelino senza interessi, altro (testo libero). Acconto facoltativo |
| Consegna | Destinatario e, se diverso dalla residenza, l'indirizzo di consegna | Vuoto = il cliente alla residenza |
| 4. Condizioni | Prova di 30 giorni, mesi di garanzia, estensione concordata, condizioni particolari | I testi delle sezioni 4 e 5 sono fissi e si adattano da soli a prova, omaggio e modalità di pagamento |

Calcoli automatici: subtotali, sconti, totale IVA inclusa, interessi del finanziamento, totale da rimborsare e piano
rate (rate uguali arrotondate al centesimo per eccesso, ultima rata di conguaglio). Per un totale di 3.582,80 € in
12 rate: 11 rate da 298,57 € e ultima da 298,53 €.

Controlli: gli **errori** (rossi) bloccano la generazione; gli **avvisi** (gialli) segnalano cose da controllare ma
non bloccano. Nomi, comune e indirizzo vengono sistemati nelle maiuscole e nel nome ufficiale del comune; il
telefono viene stampato in forma leggibile.

## Generare, stampare, inviare

- **Genera PDF**: assegna il numero progressivo (es. `2026/0012`), crea il PDF su Drive in `Contratti/<anno>` con il
  nome `Cognome_Contratto_Nome_AAAA-MM-GG.pdf`, aggiunge una riga nel foglio **Contratti** del Registro (data,
  numero, operatore, cliente, totale, pagamento, link al PDF, dati del contratto) e mostra i link.
- **Prepara bozza email al cliente** (casella in alto): insieme al PDF viene creata una **bozza** in Gmail
  dell'operatore, con il PDF allegato e un testo standard. Non viene inviata: si controlla e si manda da Gmail.
- **Stampa**: apre il contratto in una scheda del browser per stamparlo o salvarlo come PDF (alternativa al PDF di
  Drive, stesso contenuto).
- Dopo la generazione, ogni modifica ai dati prepara una **nuova versione**: al prossimo "Genera PDF" viene
  assegnato un nuovo numero e il PDF precedente resta su Drive.

## Riaprire un contratto

Nel foglio **Contratti** selezionare una cella della riga e usare **Contratti → Riapri il contratto della riga
selezionata**: la finestra si apre con i dati salvati (colonna "Dati"), pronti per correzioni e una nuova versione.

## Testi fissi e impostazioni

- Venditore, intestazione e piè di pagina sono in `CONFIG.CONTRATTO` (`src/00_config.js`). Venditore e piè di pagina
  si possono cambiare senza toccare il codice dalle Proprietà dello script (`CONTRATTO_VENDITORE`, `CONTRATTO_PIE`).
- I testi delle sezioni 4 e 5 sono in `src/20_contratto_nucleo.js` (funzione `testiCondizioni`), riprodotti dal
  contratto di riferimento. Eventuali modifiche di merito sono a carico di Migelino e del suo consulente.
- Numerazione: proprietà `CONTRATTO_ULTIMO_NUMERO` (es. `2026/0012`); si azzera da sola al cambio di anno.

## Pubblicazione come pagina web (facoltativa)

La stessa finestra può essere pubblicata come **app web** con un proprio indirizzo, senza aprire il Foglio:
editor Apps Script → **Distribuisci → Nuova distribuzione → App web**, esegui come "Utente che accede all'app",
accesso "Solo per gli utenti dell'organizzazione". La funzione `doGet` è già presente.

## Come funziona (per chi mantiene il codice)

```
src/19_contratto_risorse.js   logo Migelino (PNG in base64)
src/20_contratto_nucleo.js    contrattoNucleo(): dati → HTML, calcoli, testi. Codice puro: lo stesso gira nello
                              script (PDF) e nel browser (anteprima), dove viene inviato come sorgente
src/21_contratto_controlli.js controlli e normalizzazione (codice fiscale, comuni, telefono, maiuscole)
src/22_contratto_archivio.js  numero progressivo, PDF (Utilities.newBlob(html).getAs(PDF)), Drive, foglio Contratti,
                              bozza Gmail, firma dell'operatore (Proprietà dell'utente)
src/23_contratto_ui.js        menu, finestra (HtmlService) e funzioni chiamate dalla pagina
src/html/contratto.html       la pagina: il build la incorpora in dist/ come costante HTML_CONTRATTO
tests/contratto.test.mjs      test con dati inventati (calcoli, HTML, controlli, archivio, pagina)
```

Il PDF è prodotto dal convertitore di Apps Script, che gestisce un sottoinsieme di CSS: il modello usa solo tabelle,
immagini incorporate e interruzioni di pagina esplicite. Se in futuro la resa non bastasse, la generazione può
passare al browser (stampa) o a una libreria lato client senza cambiare il modello dei dati.
