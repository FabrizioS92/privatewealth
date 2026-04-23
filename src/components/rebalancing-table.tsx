import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";

export interface RebalancingRow {
  isin: string;
  name: string;
  currentPct: number; // 0-100
  targetPct: number; // 0-100
  currentValue: number;
  targetValue: number;
  delta: number; // currentPct - targetPct
}

const TOLERANCE = 0.5; // % considered "in line"

function deltaTone(delta: number): "pos" | "neg" | "neutral" {
  if (Math.abs(delta) < TOLERANCE) return "neutral";
  return delta > 0 ? "pos" : "neg";
}

function Bar({
  current,
  target,
  color,
}: {
  current: number;
  target: number;
  color?: string;
}) {
  // Proporzionale al 100% reale del portafoglio (NON riscalato).
  const currentW = Math.max(0, Math.min(100, current));
  const targetX = Math.max(0, Math.min(100, target));

  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/70">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${currentW}%` }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="absolute left-0 top-0 h-full rounded-full"
        style={{ backgroundColor: color ?? "var(--color-chart-1)" }}
      />
      <span
        className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full bg-foreground/70"
        style={{ left: `${targetX}%` }}
        aria-label="target"
      />
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  const tone = deltaTone(delta);
  if (tone === "neutral") {
    return (
      <span className="inline-flex items-center rounded-full bg-secondary/70 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
        In linea
      </span>
    );
  }
  const cls =
    tone === "pos"
      ? "bg-[oklch(0.92_0.05_55)] text-[oklch(0.42_0.12_50)]"
      : "bg-[oklch(0.92_0.04_240)] text-[oklch(0.42_0.12_240)]";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums ${cls}`}
    >
      {delta > 0 ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  );
}

export function RebalancingTable({
  rows,
  totalValue,
  colorMap,
}: {
  rows: RebalancingRow[];
  totalValue: number;
  colorMap?: Record<string, string>;
}) {
  const actionable = rows.filter((r) => Math.abs(r.delta) >= TOLERANCE);
  const toSell = actionable.filter((r) => r.delta > 0);
  const toBuy = actionable.filter((r) => r.delta < 0);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-border/60">
        {/* Header */}
        <div className="hidden grid-cols-[minmax(140px,1.4fr)_minmax(160px,2fr)_60px_70px_72px] items-center gap-4 border-b border-border/60 bg-secondary/30 px-5 py-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
          <span>Asset</span>
          <span>Attuale vs Target</span>
          <span className="text-right">Att.</span>
          <span className="text-right">Target</span>
          <span className="text-right">Delta</span>
        </div>

        {/* Rows */}
        <ul className="divide-y divide-border/60">
          {rows.map((r, i) => (
            <motion.li
              key={r.isin}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.04 }}
              className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-4 md:grid-cols-[minmax(140px,1.4fr)_minmax(160px,2fr)_60px_70px_72px] md:px-5"
            >
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-semibold">{r.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums md:hidden">
                  {formatCurrency(r.currentValue)} / {formatCurrency(r.targetValue)}
                </p>
              </div>

              <div className="col-span-2 md:col-span-1 md:order-2">
                <Bar current={r.currentPct} target={r.targetPct} />
              </div>

              <div className="hidden text-right text-sm font-medium tabular-nums md:block md:order-3">
                {r.currentPct.toFixed(0)}%
              </div>
              <div className="hidden text-right text-sm text-muted-foreground tabular-nums md:block md:order-4">
                {r.targetPct.toFixed(0)}%
              </div>
              <div className="justify-self-end md:order-5">
                <DeltaBadge delta={r.delta} />
              </div>
            </motion.li>
          ))}
        </ul>
      </div>

      {/* Action hint */}
      {actionable.length > 0 && (
        <div className="flex items-center justify-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/70 text-muted-foreground">
            <ArrowDown className="h-4 w-4" />
          </div>
        </div>
      )}

      {actionable.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {toBuy.length > 0 && (
            <div className="rounded-2xl bg-[oklch(0.96_0.02_240)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.42_0.12_240)]">
                Da incrementare
              </p>
              <ul className="mt-2 space-y-1.5">
                {toBuy.map((r) => (
                  <li
                    key={r.isin}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate pr-2 font-medium">{r.name}</span>
                    <span className="shrink-0 tabular-nums text-[oklch(0.42_0.12_240)]">
                      +{formatCurrency(r.targetValue - r.currentValue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {toSell.length > 0 && (
            <div className="rounded-2xl bg-[oklch(0.96_0.03_55)] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[oklch(0.42_0.12_50)]">
                Da ridurre
              </p>
              <ul className="mt-2 space-y-1.5">
                {toSell.map((r) => (
                  <li
                    key={r.isin}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate pr-2 font-medium">{r.name}</span>
                    <span className="shrink-0 tabular-nums text-[oklch(0.42_0.12_50)]">
                      −{formatCurrency(r.currentValue - r.targetValue)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Target calcolato dall'allocazione del primo CSV importato (totale {formatCurrency(totalValue)}).
      </p>
    </div>
  );
}
