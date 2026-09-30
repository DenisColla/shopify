# Taratura del riconoscimento della conferma

Il riconoscimento (`src/09_classificatore.js`) decide se l'ultimo messaggio del paziente è una **conferma di
acquisto o di prova**. Regole ed esempi qui sotto sono nel prompt: se si cambiano qui, vanno cambiati anche lì
(e il test `servizi.test.mjs` verifica che gli esempi siano 10).

## Regole

**È una conferma:**

- dichiarazione esplicita: "confermo l'ordine / l'acquisto", "procediamo", "vorrei procedere con l'ordine",
  "confermo la mia volontà di avvalermi di Migelino", "accetto le condizioni", "confermo ordine definitivo";
- invio del **preventivo firmato**;
- accettazione della **prova**: "accetto la prova", oppure "vorrei provare…" con l'invio dei documenti;
- invio dei **documenti richiesti per procedere** (documento d'identità, tessera sanitaria, indirizzo di spedizione)
  anche senza la parola "confermo": conferma implicita;
- conferma con condizioni ("confermo, ma spedite a settembre", "confermo, colore grigio");
- conferma definitiva dopo una prova.

**Non è una conferma:**

- **consenso GDPR** ("accetto", "acconsento", "accetto per il consenso" riferiti al trattamento dei dati): è il
  falso allarme più frequente, perché il consenso si chiede quasi sempre;
- domande su come procedere, prezzi, pagamenti, tempi ("come si procede?", "come ordino?");
- invio del solo esame audiometrico per una valutazione;
- conferma di un appuntamento o di una videochiamata;
- assistenza, regolazioni, ringraziamenti, conferme di ricezione/pagamento/consegna di ordini già fatti.

## Soglie

| Probabilità stimata | Esito | Azione |
|---|---|---|
| ≥ 85% ed esito "CONFERMA" | Conferma | Si procede con raccolta ed estrazione |
| 60% – 85% (o esito "DUBBIA") | Conferma dubbia | Etichetta `❓ Conferma dubbia`, nessuna scrittura |
| < 60% o esito "NON_CONFERMA" | Non conferma | Nessuna azione (solo riga nel Registro) |

La soglia di conferma si cambia con la proprietà `SOGLIA_CONFERMA`.

## Esempi validati (30/09/2026)

Proposti da Claude e **validati da Denis**. Dati personali rimossi.

| # | Messaggio del paziente (sintesi) | Esito validato |
|---|---|---|
| 1 | "Ecco il preventivo firmato e la carta d'identità. Il codice fiscale per la detrazione è […]. Colore argento. Indirizzo: [destinatario e indirizzo di spedizione]" | Conferma, acquisto |
| 2 | "Con la presente confermo la mia volontà di avvalermi di Migelino per la fornitura discussa…" | Conferma, acquisto |
| 3 | Oggetto "CONFERMA DI PREVENTIVO": "Vorrei procedere con l'ordine del PHONAK di cui ri-allego il preventivo. Ricordo il colore…" | Conferma, acquisto |
| 4 | Dopo una prova: "Confermo ordine definitivo colore grafite gray" | Conferma, acquisto |
| 5 | "A seguito colloquio odierno confermo l'acquisto degli apparecchi acustici [modello] al prezzo di [prezzo]" | Conferma, acquisto |
| 6 | "Accetto la prova e allego i documenti richiesti" | Conferma, prova |
| 7 | "Confermo l'acquisto ma… preferirei inviare l'apparecchio in uso alla prima settimana di settembre" | Conferma, acquisto (con condizione) |
| 8 | Dopo "Vorrei provare il prodotto…": "Allego… il mio documento di identità. L'indirizzo di spedizione è […] e corrisponde con il mio di residenza" | Conferma implicita, prova |
| 9 | "Accetto per il consenso. Come potremmo procedere con l'ordine? Come funziona per il pagamento?" | **Non** conferma (consenso GDPR + domanda) |
| 10 | "Le ho inviato i miei dati… Come ordino?" poi "Mi va bene il modello… Le invio il preventivo o me lo rimanda variato?" | **Dubbia** (intenzione forte, nessuna proposta accettata) |

Nei casi 1-8 l'ufficio ha poi creato davvero il cliente su Shopify; nel caso 9 il cliente è stato creato solo dopo la
conferma vera, arrivata giorni dopo (esempio 3).

## Come migliorare la taratura

1. Nel Registro, per ogni riga sbagliata, annotare il motivo (colonna libera a destra).
2. Aggiungere il caso, anonimizzato, agli esempi del prompt e a questa tabella.
3. Rilanciare il collaudo sullo storico e confrontare i numeri nel foglio "Riepilogo collaudo".
