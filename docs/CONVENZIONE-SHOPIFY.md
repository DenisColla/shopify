# Convenzione dell'anagrafica cliente su Shopify

Ricavata dalle anagrafiche create a mano dall'ufficio (settembre 2026) e dagli ordini collegati.
Il sistema la replica. Gli esempi qui sotto usano **dati inventati**.

## Cliente

| Campo Shopify | Valore | Note |
|---|---|---|
| Nome / Cognome | Dal documento d'identità, maiuscole normali | `MARIA ROSA` → `Maria Rosa`, `DE ANGELIS` → `De Angelis`, `D'ORAZIO` → `D'Orazio` |
| Email | Mittente della mail di conferma | Chiave di ricerca del cliente esistente |
| Telefono | Formato internazionale `+39…` | Se il numero è già usato da un altro cliente (es. coniuge) viene omesso e segnalato |
| Nota | Solo per le anagrafiche automatiche | Es. "Anagrafica creata automaticamente dalla mail del 30/09/2026 (conferma acquisto). Da completare: codice fiscale." |
| Tag | `anagrafica-auto` | Per filtrare i clienti creati dal sistema |

## Indirizzi

Il **codice fiscale va nel campo "Azienda" (company)** dell'indirizzo di residenza, che negli ordini diventa
l'indirizzo di **fatturazione**. L'indirizzo **predefinito** del cliente è quello di **spedizione**.

### Caso 1: spedizione = residenza (il più frequente)

Un solo indirizzo, predefinito:

| Nome | Cognome | Azienda | Indirizzo | CAP | Città | Prov. | Telefono |
|---|---|---|---|---|---|---|---|
| Mario | Rossi | *codice fiscale* | Via Appia Nuova 100 | 00183 | Roma | RM | +393331234567 |

### Caso 2: spedizione diversa dalla residenza

Due indirizzi:

1. **Spedizione (predefinito)**
   - se la consegna è **presso un'azienda** o una struttura: in Azienda va `C/O Nome Azienda`;
   - se il destinatario è **un'altra persona** (es. la moglie): nome e cognome del destinatario, Azienda vuota,
     telefono del destinatario se indicato;
   - se il destinatario è il paziente stesso a un altro indirizzo: Azienda = CF.
2. **Residenza (secondo indirizzo)**: nome e cognome del paziente, **Azienda = CF**, telefono del paziente.

Quando l'ufficio crea l'ordine: spedizione = indirizzo predefinito, fatturazione = indirizzo di residenza con il CF.

### Pazienti stranieri

Indirizzo con codice paese corretto e senza provincia. Se non c'è un codice fiscale italiano il campo Azienda resta
vuoto: l'ufficio inserisce a mano l'identificativo (es. numero del passaporto).

### Formato degli indirizzi

- `address1` = via + numero civico (`Via dei Glicini 14/B`, `Via XXV Aprile 12`, `Località Poggio 3`);
  particelle minuscole (`Via delle Rose`, `Via di Porta Maggiore`), numeri romani maiuscoli.
- `address2` = scala, interno, piano (`Piano 2 int. 5`).
- `zip` = CAP a 5 cifre, `provinceCode` = sigla (`MI`, `RM`, …), paese `IT`.
- Il comune prende il nome ufficiale quando è riconosciuto (`San Giovanni in Persiceto`); le frazioni restano come scritte.

## Cosa il sistema non fa

- Non sovrascrive mai un dato già presente (le differenze vanno nel Registro come avviso).
- Non crea ordini o bozze d'ordine; non modifica tag esistenti (aggiunge solo `anagrafica-auto`).
- Non tocca il consenso marketing e non invia inviti all'account cliente.
