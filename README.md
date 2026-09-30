# Anagrafica automatica Gmail → Shopify (Migelino Italia)

Quando un paziente **conferma per email** l'acquisto o la prova degli apparecchi acustici, il sistema
crea da solo la sua **anagrafica cliente su Shopify**, leggendo le mail e i documenti allegati
(carta d'identità, tessera sanitaria, preventivo firmato). Così, quando l'ufficio crea l'ordine,
il cliente è già pronto e compilato come lo compilerebbe l'ufficio.

Gira in **Google Apps Script** nell'account Gmail di Migelino, ogni 10 minuti, senza server e senza
bisogno che un PC sia acceso.

## Come funziona

```
Gmail (ogni 10 minuti)
 ① Filtro a regole (gratis): scarta mail interne, automatiche, newsletter, sconosciuti
 ② Riconoscimento: Claude legge la conversazione → è una conferma di acquisto o di prova?
 ③ Raccolta: tutte le mail del paziente (120 giorni) e i suoi allegati (PDF e foto)
 ④ Estrazione: Claude legge documenti e mail → ogni campo con valore, fonte e confidenza
 ⑤ Controlli automatici: codice fiscale (controllo + coerenza col documento), CAP/provincia, telefono
 ⑥ Decisione con le regole di Migelino (vedi sotto)
 ⑦ Shopify: crea il cliente o completa quello esistente (mai sovrascrive)
 ⑧ Etichetta sulla conversazione Gmail + riga nel Registro (Foglio Google)
```

## Regole (decise con Migelino)

1. **Senza indirizzo di residenza E indirizzo di spedizione non si crea nulla.** Servono anche nome e cognome.
   La conversazione riceve l'etichetta *⚠️ Dati mancanti*; appena il paziente manda il dato che manca,
   l'anagrafica si completa da sola.
2. Un campo si scrive solo se la lettura supera la **soglia di confidenza (85%)** e i controlli automatici.
   Altrimenti resta vuoto e viene segnalato.
3. Il **codice fiscale** va solo nel campo **Azienda** dell'indirizzo. Se manca, o non supera i controlli,
   resta vuoto: lo inserisce l'ufficio. Non viene mai calcolato.
4. **Convenzione dell'ufficio:** indirizzo predefinito = spedizione; se la residenza è diversa diventa un secondo
   indirizzo con il CF in Azienda (è quello usato per la fatturazione). Dettagli in
   [docs/CONVENZIONE-SHOPIFY.md](docs/CONVENZIONE-SHOPIFY.md).
5. Su un cliente già esistente si **completano solo i campi vuoti**: nulla viene sovrascritto, le differenze vengono segnalate.
6. Il sistema **non crea ordini, non invia email, non tocca il consenso marketing**.

## Etichette in Gmail

| Etichetta | Significato | Cosa fare |
|---|---|---|
| `Anagrafica/✅ Creata` | Cliente creato su Shopify | Niente: si può creare l'ordine |
| `Anagrafica/✅ Completata` | Cliente esistente completato (o già completo) | Niente |
| `Anagrafica/⚠️ Dati mancanti` | Conferma riconosciuta ma manca residenza e/o spedizione: nulla creato | Chiedere il dato al paziente: poi si completa da solo |
| `Anagrafica/❓ Conferma dubbia` | Non è chiaro se sia una conferma | Se lo è, mettere l'etichetta `▶ Crea` |
| `Anagrafica/▶ Crea` | **Messa a mano**: forza la creazione | Si toglie da sola dopo l'elaborazione |
| `Anagrafica/⛔ Errore` | Errore tecnico (dettagli nel Registro) | Per riprovare mettere `▶ Crea` |

## Modalità

- **OMBRA** (predefinita): lavora e registra nel Foglio cosa farebbe, **senza scrivere su Shopify** né etichettare.
  Serve per il collaudo in parallelo al lavoro dell'ufficio.
- **LIVE**: crea e completa le anagrafiche ed etichetta le conversazioni.

## Documentazione

- [docs/PIANO.md](docs/PIANO.md): piano approvato, architettura e fasi
- [docs/INSTALLAZIONE.md](docs/INSTALLAZIONE.md): installazione passo passo (circa 15 minuti)
- [docs/TARATURA.md](docs/TARATURA.md): regole di riconoscimento della conferma ed esempi validati
- [docs/CONVENZIONE-SHOPIFY.md](docs/CONVENZIONE-SHOPIFY.md): come si compila l'anagrafica su Shopify

## Struttura del repository

```
src/          sorgenti Apps Script (un modulo per file)
dist/         file unico da incollare in Apps Script (generato: npm run build)
tests/        test automatici con dati inventati (npm test)
tools/        build e generazione della tabella comuni
docs/         documentazione
```

Sviluppo: `npm test` esegue i test, `npm run build` rigenera `dist/`. La CI su GitHub controlla entrambe le cose.

## Privacy e sicurezza

- In questo repository **non ci sono e non devono mai esserci dati di pazienti**: né nomi, né codici fiscali, né
  documenti, né mail. I test usano persone inventate. Si consiglia comunque di rendere il repository privato.
- Le **chiavi** (Claude, Shopify) stanno solo nelle Proprietà dello script, mai nel codice.
- I documenti vengono letti al momento e inviati all'API di Claude solo per l'estrazione; non vengono salvati.
  Anthropic non usa i dati inviati tramite API per addestrare i modelli. Nell'informativa privacy di Migelino va
  indicato il fornitore di servizi di intelligenza artificiale.
- Il Registro in modalità LIVE contiene solo esiti e nomi dei campi; in modalità OMBRA contiene anche la proposta
  (con i dati), per confrontarla con il lavoro dell'ufficio: a collaudo finito si può svuotare.
- Tabella dei comuni: [comuni-json](https://github.com/matteocontrini/comuni-json) di Matteo Contrini (dati ISTAT e ANCI).
