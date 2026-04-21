

## Grafico performance storica con range temporali

Aggiungo al **Dashboard** un grafico interattivo del valore del portafoglio nel tempo, con selettore di range: **3M · 6M · 1A · 2A · 3A · MAX**.

### Cosa cambia visivamente
- La card "Capitale nel tempo" diventa "**Performance portafoglio**"
- Sopra al grafico: 6 chip-pulsanti per il range (3M, 6M, 1Y, 2Y, 3Y, MAX) — quello attivo in mint
- Sotto al titolo: variazione del periodo selezionato (es. `+12,4% · +1.240 €`) con badge mint/coral
- Tooltip al passaggio: data + valore portafoglio + variazione % dal punto iniziale del range
- Animazione fluida quando si cambia range (stessa motion library già usata)

### Come calcolo la serie storica (logica)

Il valore del portafoglio in una data `D` =  
**Σ (quantità posseduta in D × prezzo conosciuto più vicino ≤ D)** per ogni ISIN.

Step:
1. **Genero punti settimanali** (ogni domenica) dalla data di inizio del range fino a oggi — riduce rumore e mantiene il grafico fluido. Per range ≤ 6M uso punti settimanali; per 1A+ uso punti settimanali aggregati mensilmente.
2. **Per ogni data del grafico**, per ogni ISIN:
   - Quantità = somma transazioni buy − sell con `trade_date ≤ data`
   - Prezzo = il più recente tra:
     - prezzo della transazione più recente con `trade_date ≤ data`
     - record di `price_history` con `recorded_at ≤ data`
     - se ISIN comprato dopo `data` → escluso
3. Sommo tutti i valori per ottenere il valore portafoglio a quella data
4. Il punto "oggi" usa il prezzo corrente da `manual_prices`

### Edge case
- **Utente nuovo / poche transazioni**: se il range richiesto va oltre la prima transazione, mostro la serie a partire dalla prima transazione + label "Dati dal {data}"
- **Range MAX**: dalla prima transazione a oggi
- **Punti senza variazione**: mantengo la curva piatta (last-price-carry-forward) — comportamento finanziariamente corretto
- **Pochi dati di prezzo storici**: la curva sarà a "gradini" (cambia solo agli import CSV) — è accettabile e riflette i dati reali disponibili. Aggiungo nota piccola sotto al grafico: "Storico basato sui prezzi rilevati negli import CSV"

### File toccati
- `src/lib/portfolio-history.ts` (**nuovo**) — funzione `computePortfolioHistory(transactions, priceHistory, currentPrices, range)` che ritorna `{ date, value }[]`
- `src/components/performance-chart.tsx` — accetta nuova prop opzionale `showDelta` per evidenziare il punto iniziale
- `src/components/range-selector.tsx` (**nuovo**) — componente chip-pulsanti riutilizzabile (3M/6M/1Y/2Y/3Y/MAX)
- `src/routes/_app.dashboard.tsx` — carica `price_history`, gestisce stato `range`, calcola serie filtrata, mostra delta del periodo
- `src/lib/i18n` (`translations.ts`) — nuove chiavi: `perf_range_3m`, `perf_range_6m`, `perf_range_1y`, `perf_range_2y`, `perf_range_3y`, `perf_range_max`, `perf_period_change`, `perf_history_note`

Nessuna nuova migrazione DB, nessuna nuova dipendenza — uso `recharts` e `framer-motion` già presenti.

### Nota di trasparenza
Il calcolo è il più accurato possibile con i dati disponibili: per giorni privi di prezzo, riporto in avanti l'ultimo prezzo conosciuto. Più CSV importi nel tempo, più la curva sarà ricca di punti reali.

