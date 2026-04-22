import type { ParsedTransaction } from "@/lib/degiro-parser";
import { computePositions } from "@/lib/degiro-parser";
import type { RebalancingRow } from "@/components/rebalancing-table";

interface TxWithCreatedAt extends ParsedTransaction {
  created_at?: string;
}

/**
 * Compute the target allocation from the FIRST CSV import.
 *
 * Heuristic: take all transactions whose `created_at` falls within
 * a 60-minute window from the earliest `created_at` — that is the
 * first import batch. Compute positions and value-weighted allocation
 * using the price stored on each transaction (cost basis at import time).
 */
export function computeTargetAllocation(
  transactions: TxWithCreatedAt[],
): Record<string, number> {
  if (transactions.length === 0) return {};

  const withTs = transactions
    .filter((t) => t.created_at)
    .map((t) => ({ tx: t, ts: new Date(t.created_at as string).getTime() }))
    .sort((a, b) => a.ts - b.ts);

  if (withTs.length === 0) {
    // fallback: use earliest trade_date batch
    const sorted = [...transactions].sort((a, b) =>
      a.trade_date.localeCompare(b.trade_date),
    );
    const firstDate = sorted[0].trade_date;
    const firstBatch = sorted.filter((t) => t.trade_date === firstDate);
    return weightsFromTransactions(firstBatch);
  }

  const earliest = withTs[0].ts;
  const WINDOW_MS = 60 * 60 * 1000; // 60 minutes
  const firstBatch = withTs
    .filter((x) => x.ts - earliest <= WINDOW_MS)
    .map((x) => x.tx);

  return weightsFromTransactions(firstBatch);
}

function weightsFromTransactions(txs: ParsedTransaction[]): Record<string, number> {
  const positions = computePositions(txs);
  const totals: Record<string, number> = {};
  let sum = 0;
  for (const p of positions) {
    const v = p.quantity * p.avg_cost;
    if (v <= 0) continue;
    totals[p.isin] = v;
    sum += v;
  }
  if (sum <= 0) return {};
  const weights: Record<string, number> = {};
  for (const isin of Object.keys(totals)) {
    weights[isin] = (totals[isin] / sum) * 100;
  }
  return weights;
}

/**
 * Build rebalancing rows from current positions vs target weights.
 */
export function buildRebalancingRows(
  positions: { isin: string; name: string; quantity: number; avg_cost: number }[],
  prices: Record<string, number>,
  targetWeights: Record<string, number>,
): { rows: RebalancingRow[]; totalValue: number } {
  // Compute current values
  const currentValues: Record<string, { name: string; value: number }> = {};
  let total = 0;
  for (const p of positions) {
    const px = prices[p.isin] ?? p.avg_cost;
    const v = p.quantity * px;
    if (v <= 0) continue;
    currentValues[p.isin] = { name: p.name, value: v };
    total += v;
  }

  // Union of ISINs in positions and target
  const isinSet = new Set<string>([
    ...Object.keys(currentValues),
    ...Object.keys(targetWeights),
  ]);

  const rows: RebalancingRow[] = [];
  for (const isin of isinSet) {
    const current = currentValues[isin];
    const targetPct = targetWeights[isin] ?? 0;
    const currentValue = current?.value ?? 0;
    const currentPct = total > 0 ? (currentValue / total) * 100 : 0;
    const targetValue = (targetPct / 100) * total;
    const name =
      current?.name ??
      positions.find((p) => p.isin === isin)?.name ??
      isin;

    rows.push({
      isin,
      name,
      currentPct,
      targetPct,
      currentValue,
      targetValue,
      delta: currentPct - targetPct,
    });
  }

  rows.sort((a, b) => b.targetPct - a.targetPct || b.currentPct - a.currentPct);
  return { rows, totalValue: total };
}
