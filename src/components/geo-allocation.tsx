import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Download, Loader2, Pencil, Save } from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { GeoSlice, BreakdownMap } from "@/lib/geo-allocation";
import { REGION_KEYS, REGION_LABELS, REGION_FLAGS, type RegionKey } from "@/lib/regions";
import { fetchEtfGeoBreakdown, saveManualEtfGeoBreakdown } from "@/lib/etf-geo.functions";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

interface MissingPosition {
  isin: string;
  name: string;
}

interface GeoAllocationProps {
  data: GeoSlice[];
  currency?: string;
  missingPositions: MissingPosition[];
  coveredValue: number;
  totalValue: number;
  onBreakdownUpdated: (isin: string, weights: { region: RegionKey; weight: number }[]) => void;
}

export function GeoAllocation({
  data,
  currency = "EUR",
  missingPositions,
  coveredValue,
  totalValue,
  onBreakdownUpdated,
}: GeoAllocationProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const coveragePct = totalValue > 0 ? (coveredValue / totalValue) * 100 : 0;

  return (
    <div className="space-y-5">
      {data.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="relative h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={3}
                  stroke="var(--color-card)"
                  strokeWidth={4}
                  cornerRadius={6}
                  isAnimationActive
                  animationDuration={800}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 16,
                    fontSize: 12,
                    boxShadow: "var(--shadow-elevated)",
                  }}
                  formatter={
                    ((v: unknown, _n: unknown, item: unknown) => {
                      const num = Number(v ?? 0);
                      const slice = (item as { payload?: GeoSlice } | undefined)?.payload;
                      return [
                        `${formatCurrency(num, currency)} · ${formatPercent(
                          total > 0 ? num / total : 0,
                          1,
                        )}`,
                        slice ? `${slice.flag} ${slice.name}` : "",
                      ];
                    }) as never
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Coperto</p>
              <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                {coveragePct.toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="space-y-2.5">
            {data.map((d, i) => {
              const pct = total > 0 ? d.value / total : 0;
              return (
                <motion.div
                  key={d.region}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.4 }}
                  className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-2.5"
                >
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: COLORS[i % COLORS.length] }}
                  />
                  <span className="text-lg leading-none">{d.flag}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-sm font-semibold">{formatPercent(pct, 1)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatCurrency(d.value, currency)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="rounded-2xl bg-secondary/60 p-4 text-center text-sm text-muted-foreground">
          Nessuna composizione ETF disponibile. Importa la composizione automaticamente o
          inseriscila manualmente qui sotto.
        </p>
      )}

      {missingPositions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              ETF senza composizione ({missingPositions.length})
            </p>
            {coveragePct < 100 && data.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Allocazione calcolata sul {coveragePct.toFixed(0)}% del portafoglio
              </p>
            )}
          </div>
          <div className="space-y-2">
            {missingPositions.map((p) => (
              <EtfBreakdownRow key={p.isin} isin={p.isin} name={p.name} onSaved={onBreakdownUpdated} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EtfBreakdownRow({
  isin,
  name,
  onSaved,
}: {
  isin: string;
  name: string;
  onSaved: (isin: string, weights: { region: RegionKey; weight: number }[]) => void;
}) {
  const fetchFn = useServerFn(fetchEtfGeoBreakdown);
  const saveFn = useServerFn(saveManualEtfGeoBreakdown);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [weights, setWeights] = useState<Record<RegionKey, string>>({
    north_america: "",
    europe_developed: "",
    asia_developed: "",
    emerging_markets: "",
    other: "",
  });

  const handleAuto = async () => {
    setLoading(true);
    try {
      const res = await fetchFn({ data: { isin } });
      if (res.success) {
        toast.success(`Composizione importata da ${res.source === "justetf" ? "JustETF" : "cache"}`);
        onSaved(isin, res.breakdown);
      } else {
        toast.error("ETF non trovato su JustETF — inseriscilo manualmente");
        setEditing(true);
      }
    } catch (err) {
      console.error(err);
      toast.error("Errore durante lo scraping");
      setEditing(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const parsed = REGION_KEYS.map((r) => ({
      region: r,
      weight: parseFloat(weights[r].replace(",", ".")) || 0,
    }));
    const total = parsed.reduce((s, w) => s + w.weight, 0);
    if (Math.abs(total - 100) > 1) {
      toast.error(`La somma deve essere 100% (attuale: ${total.toFixed(1)}%)`);
      return;
    }
    setLoading(true);
    try {
      const res = await saveFn({ data: { isin, weights: parsed } });
      if (res.success) {
        toast.success("Composizione salvata");
        onSaved(isin, parsed);
        setEditing(false);
      } else {
        toast.error("Salvataggio fallito");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-secondary/40 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-[10px] text-muted-foreground">{isin}</p>
        </div>
        {!editing && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={handleAuto}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Download className="mr-1 h-3.5 w-3.5" /> Auto
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-xs"
              onClick={() => setEditing(true)}
            >
              <Pencil className="mr-1 h-3.5 w-3.5" /> Manuale
            </Button>
          </>
        )}
      </div>
      {editing && (
        <div className="mt-3 space-y-2">
          {REGION_KEYS.map((r) => (
            <div key={r} className="flex items-center gap-2">
              <span className="text-base">{REGION_FLAGS[r]}</span>
              <Label className="flex-1 text-xs font-normal">{REGION_LABELS[r]}</Label>
              <div className="relative w-20">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  value={weights[r]}
                  onChange={(e) => setWeights((w) => ({ ...w, [r]: e.target.value }))}
                  className="h-8 pr-6 text-right text-xs tabular-nums"
                  placeholder="0"
                />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditing(false)}>
              Annulla
            </Button>
            <Button size="sm" className="h-8" onClick={handleSave} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <>
                  <Save className="mr-1 h-3.5 w-3.5" /> Salva
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
