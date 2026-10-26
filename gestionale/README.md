# Scheda «Contratto» nel gestionale web (Generatore documenti)

Il gestionale di Migelino è una pagina HTML unica, pubblicata su Cloudflare
(`gestionale-migelino.whatsapp-bridge.workers.dev`): jsPDF per i PDF, modulo a sinistra e anteprima A4 a destra,
storico e protocollo in locale. Questa cartella contiene la **scheda "Contratto di vendita"** da innestare in quella
pagina, con lo stesso nucleo di calcoli e testi usato dal Foglio Google (`src/20_contratto_nucleo.js`).

```
contratto_sezione.js   modulo (fCon), anteprima (pCon), controlli (controlliContratto) e PDF (pdfCon) della scheda;
                       il segnaposto __NUCLEO__ viene sostituito con la funzione contrattoNucleo() del repo
applica_patch.py       prende la pagina pubblicata e produce la pagina con la scheda in più
prova_app.mjs          prova in Chromium (Playwright): compila la scheda, controlla l'anteprima, scarica il PDF
```

## Come si rigenera la pagina

```bash
curl -sS -o /tmp/gestionale.html https://gestionale-migelino.whatsapp-bridge.workers.dev/
python3 -I gestionale/applica_patch.py /tmp/gestionale.html /tmp/gestionale_contratto.html
node gestionale/prova_app.mjs /tmp/gestionale_contratto.html /tmp/prova   # facoltativo: PDF e screenshot in /tmp/prova
```

Lo script cerca nella pagina alcuni punti precisi (registro degli strumenti, mappe modulo/anteprima/PDF, home,
compilazione rapida) e si ferma con un errore se uno manca o è cambiato: in quel caso va aggiornata l'ancora in
`applica_patch.py`. La pagina con la scheda **non** sta nel repository: è il prodotto del comando qui sopra.

## Come si pubblica

Il worker serve la pagina così com'è: va sostituito il file HTML con quello prodotto (`gestionale_contratto.html`),
con lo stesso procedimento usato per le versioni precedenti (dashboard Cloudflare → Workers → `gestionale-migelino`,
oppure `wrangler deploy` dal progetto del worker). Nessuna modifica lato server: la scheda usa solo il browser, come
le altre.

## Cosa fa la scheda

- Menu **Contratto** fra i documenti (anche nella home, «Comincia da qui», e con il link `#contratto`).
- Modulo: intestazione e firma come gli altri documenti (azienda predefinita Migelino AG, firmatario dal profilo,
  data, **protocollo = numero del contratto**, assegnato allo scarico del PDF), cliente (richiamo dall'anagrafica,
  pulsante Shopify già presente, indirizzo con suggerimenti OpenStreetMap, codice fiscale verificato), voci della
  fornitura con quantità, prezzo, sconto, omaggio ed etichette, pagamento (bonifico, carta o link, finanziamento con
  rate e maggiorazione, rate Migelino senza interessi, altro), consegna, condizioni.
- Anteprima sul foglio con i riquadri verdi/rossi dei campi compilati o mancanti (cliccabili per andare al campo).
- **Scarica PDF**: controlli con avvisi (codice fiscale, CAP, email, totale, rate, consegna), poi PDF con jsPDF:
  intestazione e piè di pagina su ogni pagina, barre di sezione, tabella della fornitura, totale in evidenza,
  firma del cliente a sinistra e timbro con firma del profilo a destra. Registrato nello **Storico**, riapribile.
- La compilazione rapida da testo («Detta o incolla») riconosce cliente, codice fiscale, telefono, email e indirizzo.

## Tenere allineato il nucleo

Calcoli, piano rate e testi delle sezioni 4 e 5 vivono in `src/20_contratto_nucleo.js` e vengono copiati nella
pagina da `applica_patch.py`: dopo una modifica al nucleo basta rigenerare la pagina. I test del nucleo sono in
`tests/contratto.test.mjs`.
