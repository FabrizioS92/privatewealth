import type { Position } from "@/lib/degiro-parser";
import { REGION_FLAGS, REGION_LABELS, type RegionKey } from "@/lib/regions";

export interface GeoSlice {
  region: RegionKey;
  name: string;
  flag: string;
  value: number;
}

export interface BreakdownMap {
  // ISIN -> array di { region, weight (0..100) }
  [isin: string]: { region: RegionKey; weight: number }[];
}

/**
 * Calcola l'allocazione geografica look-through:
 * Per ogni posizione, distribuisce il valore di mercato sulle regioni in base
 * alla composizione interna dell'ETF (breakdown). Posizioni senza breakdown
 * vengono escluse dal calcolo (e segnalate separatamente).
 */
export function computeGeoAllocation(
  positions: Position[],
  prices: Record<string, number>,
  breakdowns: BreakdownMap,
): { slices: GeoSlice[]; missingIsins: string[]; coveredValue: number; totalValue: number } {
  const buckets = new Map<RegionKey, number>();
  const missing: string[] = [];
  let covered = 0;
  let total = 0;

  for (const p of positions) {
    if (p.quantity <= 0) continue;
    const value = p.quantity * (prices[p.isin] ?? p.avg_cost);
    total += value;
    const bd = breakdowns[p.isin];
    if (!bd || bd.length === 0) {
      missing.push(p.isin);
      continue;
    }
    covered += value;
    for (const row of bd) {
      const portion = value * (row.weight / 100);
      buckets.set(row.region, (buckets.get(row.region) ?? 0) + portion);
    }
  }

  const slices = [...buckets.entries()]
    .map(([region, value]) => ({
      region,
      value,
      name: REGION_LABELS[region],
      flag: REGION_FLAGS[region],
    }))
    .sort((a, b) => b.value - a.value);

  return { slices, missingIsins: missing, coveredValue: covered, totalValue: total };
}
