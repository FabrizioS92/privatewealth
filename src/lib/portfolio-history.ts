import type { ParsedTransaction } from "@/lib/degiro-parser";

export type RangeKey = "3M" | "6M" | "1Y" | "2Y" | "3Y" | "MAX";

export interface PriceHistoryRow {
  isin: string;
  price: number;
  recorded_at: string; // ISO timestamp
}

export interface HistoryPoint {
  date: string; // yyyy-mm-dd
  value: number;
}

const RANGE_DAYS: Record<Exclude<RangeKey, "MAX">, number> = {
  "3M": 90,
  "6M": 180,
  "1Y": 365,
  "2Y": 730,
  "3Y": 1095,
};

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startDateForRange(range: RangeKey, firstTxDate: string): string {
  if (range === "MAX") return firstTxDate;
  const days = RANGE_DAYS[range];
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  const iso = toISODate(d);
  // Cap allo storico realmente disponibile
  return iso < firstTxDate ? firstTxDate : iso;
}

/**
 * Genera la serie storica del valore del portafoglio.
 * - Punti settimanali (ogni 7 giorni) per range ≤ 1Y
 * - Punti ogni 14 giorni per range > 1Y
 * - Per ogni data: quantità posseduta a D × prezzo più recente conosciuto ≤ D
 */
export function computePortfolioHistory(
  transactions: ParsedTransaction[],
  priceHistory: PriceHistoryRow[],
  currentPrices: Record<string, number>,
  range: RangeKey,
): HistoryPoint[] {
  if (transactions.length === 0) return [];

  const sortedTx = [...transactions].sort((a, b) =>
    a.trade_date.localeCompare(b.trade_date),
  );
  const firstTxDate = sortedTx[0].trade_date;
  const startISO = startDateForRange(range, firstTxDate);
  const todayISO = toISODate(new Date());

  // Step in giorni
  const stepDays = range === "3M" || range === "6M" || range === "1Y" ? 7 : 14;

  // Build elenco date (settimanali) tra start e oggi
  const dates: string[] = [];
  const cursor = new Date(startISO + "T00:00:00Z");
  const end = new Date(todayISO + "T00:00:00Z");
  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + stepDays);
  }
  if (dates[dates.length - 1] !== todayISO) dates.push(todayISO);

  // Indice prezzi storici per ISIN, ordinati per data asc
  // Includiamo anche i prezzi delle transazioni come fonti di prezzo
  const priceSources = new Map<string, { date: string; price: number }[]>();
  for (const tx of sortedTx) {
    const arr = priceSources.get(tx.isin) ?? [];
    arr.push({ date: tx.trade_date, price: tx.price });
    priceSources.set(tx.isin, arr);
  }
  for (const ph of priceHistory) {
    const isoDate = ph.recorded_at.slice(0, 10);
    const arr = priceSources.get(ph.isin) ?? [];
    arr.push({ date: isoDate, price: Number(ph.price) });
    priceSources.set(ph.isin, arr);
  }
  for (const [isin, arr] of priceSources) {
    arr.sort((a, b) => a.date.localeCompare(b.date));
    priceSources.set(isin, arr);
  }

  // Quantità per ISIN cumulata fino a una certa data
  function quantitiesAt(dateISO: string): Map<string, number> {
    const q = new Map<string, number>();
    for (const tx of sortedTx) {
      if (tx.trade_date > dateISO) break;
      const cur = q.get(tx.isin) ?? 0;
      const delta = tx.type === "buy" ? tx.quantity : -tx.quantity;
      q.set(tx.isin, cur + delta);
    }
    return q;
  }

  // Prezzo per ISIN alla data D (ultimo ≤ D), fallback ad attuale per oggi
  function priceAt(isin: string, dateISO: string): number {
    const arr = priceSources.get(isin);
    if (!arr || arr.length === 0) return currentPrices[isin] ?? 0;
    let last = 0;
    for (const p of arr) {
      if (p.date <= dateISO) last = p.price;
      else break;
    }
    return last || currentPrices[isin] || 0;
  }

  const points: HistoryPoint[] = [];
  for (const d of dates) {
    const isToday = d === todayISO;
    const q = quantitiesAt(d);
    let value = 0;
    for (const [isin, qty] of q) {
      if (qty <= 0.0000001) continue;
      const px = isToday ? currentPrices[isin] ?? priceAt(isin, d) : priceAt(isin, d);
      value += qty * px;
    }
    points.push({ date: d, value });
  }

  return points;
}
