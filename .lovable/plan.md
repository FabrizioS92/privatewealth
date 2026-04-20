
L'utente vuole che, oltre ad aggiornare i prezzi automaticamente all'import, l'app **confronti il nuovo CSV con quello precedente** e calcoli automaticamente la **percentuale di scostamento** (variazione %) tra i prezzi vecchi e i nuovi.

## Approccio

Non serve salvare fisicamente il file CSV: i prezzi precedenti sono già nel database (in `manual_prices` e nelle vecchie `transactions`). Basta confrontare prima/dopo.

### Flusso al momento dell'import:
1. **Snapshot prezzi attuali**: prima di importare, leggo da `manual_prices` i prezzi correnti per ogni ISIN dell'utente → mappa `{ISIN → prezzo_vecchio}`.
2. **Import transazioni** (come già avviene).
3. **Calcolo nuovi prezzi**: per ogni ISIN, prendo il prezzo dell'ultima transazione (più recente per `trade_date`) dal DB aggiornato.
4. **Confronto e upsert**: per ogni ISIN calcolo `delta % = (nuovo - vecchio) / vecchio * 100`. Faccio upsert in `manual_prices`.
5. **Mostro risultato**: in pagina Import appare una nuova card "Variazioni prezzi" con tabella ISIN/Nome, Vecchio, Nuovo, Δ% (verde se positivo, rosso se negativo, grigio se nuovo titolo).

### Dove mostrare lo scostamento
- **Pagina Import**: card "Variazioni prezzi" subito sotto il riepilogo import, mostra le top 10 variazioni in valore assoluto + totale titoli aggiornati / nuovi.
- **Pagina Portafoglio**: aggiungo una colonna/badge "Δ ultimo import" accanto a ogni holding, con percentuale colorata. Hover mostra "da €X a €Y il [data]".

### Persistenza dello storico (opzionale ma utile)
Per non perdere lo scostamento appena l'utente ricarica la pagina, salvo l'ultimo snapshot in una nuova tabella leggera `price_history`:
```
price_history (user_id, isin, price, currency, recorded_at)
```
Ad ogni import inserisco una riga per ISIN. Così posso:
- mostrare il delta vs ultimo import in qualsiasi momento
- in futuro disegnare un mini-grafico storico del prezzo

## Modifiche

### 1. Database (migrazione)
Nuova tabella `price_history`:
- `id uuid pk`, `user_id uuid`, `isin text`, `price numeric`, `currency text default 'EUR'`, `recorded_at timestamptz default now()`
- RLS: utente vede/inserisce solo le proprie righe
- Indice su `(user_id, isin, recorded_at desc)`

### 2. `src/routes/_app.import.tsx`
- Prima dell'import: `SELECT isin, price FROM manual_prices WHERE user_id = ...` → mappa `oldPrices`
- Dopo l'import delle transazioni: per ogni ISIN nel CSV calcolo l'ultimo prezzo (preso direttamente da `result.transactions`, scegliendo la `trade_date` massima per ISIN, fallback al `result.transactions` più recente)
- Upsert in `manual_prices` (onConflict `user_id,isin`)
- Insert una riga in `price_history` per ogni ISIN aggiornato
- Calcolo `changes = [{isin, name, oldPrice, newPrice, deltaPct, isNew}]` e lo salvo in stato
- Render nuova card **"Variazioni prezzi"** con tabella sortable per |Δ%|

### 3. `src/routes/_app.portfolio.tsx`
- Caricare `price_history` (le ultime 2 righe per ISIN) per mostrare un piccolo badge "▲ +2.4%" o "▼ -1.1%" accanto al prezzo
- Aggiungere riga informativa "Prezzi sincronizzati automaticamente all'ultimo import CSV"

### 4. Nessuna nuova dipendenza
Tutto già in tabella e tutto in JS lato client. Calcolo del delta è una semplice sottrazione.

## File toccati
- nuova migrazione SQL per `price_history` + RLS
- `src/routes/_app.import.tsx` (logica snapshot + UI variazioni)
- `src/routes/_app.portfolio.tsx` (badge delta + nota informativa)

## Edge case
- ISIN nuovo (mai visto): `oldPrice = null`, mostro badge grigio "Nuovo"
- Prezzo vecchio = 0: skip calcolo % per evitare divisione per zero, mostro solo i valori
- Stesso prezzo: badge neutro "—"
- Valuta diversa tra vecchio e nuovo: mostro warning, niente %
