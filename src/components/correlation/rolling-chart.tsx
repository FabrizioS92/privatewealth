import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rollingCorrelation, alignSeries, logReturns } from "@/lib/correlation-math";
import type { PriceSeries } from "@/lib/yahoo-finance";

interface Props {
  series: PriceSeries[];
}

export function RollingChart({ series }: Props) {
  const pairs = useMemo(() => {
    const out: Array<{ id: string; a: string; b: string }> = [];
    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        out.push({ id: `${series[i].ticker}|${series[j].ticker}`, a: series[i].ticker, b: series[j].ticker });
      }
    }
    return out;
  }, [series]);

  const [selected, setSelected] = useState<string | undefined>(pairs[0]?.id);

  const data = useMemo(() => {
    if (!selected) return [];
    const pair = pairs.find((p) => p.id === selected);
    if (!pair) return [];
    const sa = series.find((s) => s.ticker === pair.a);
    const sb = series.find((s) => s.ticker === pair.b);
    if (!sa || !sb) return [];
    const ra = logReturns(sa.prices);
    const rb = logReturns(sb.prices);
    const [aa, bb] = alignSeries(ra, rb);
    const dates = sa.dates.length <= sb.dates.length ? sa.dates.slice(-aa.length - 1, -1) : sb.dates.slice(-aa.length - 1, -1);
    const safeDates = dates.length === aa.length ? dates : sa.dates.slice(-aa.length);
    return rollingCorrelation(aa, bb, safeDates, 60);
  }, [selected, pairs, series]);

  if (pairs.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="font-display text-base font-semibold">Come è cambiata la correlazione nel tempo</h3>
          <p className="text-xs text-muted-foreground">
            Valori vicini a +1 = si muovono insieme, vicini a −1 = si muovono in senso opposto.
          </p>
        </div>
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger className="w-full rounded-full sm:w-64">
            <SelectValue placeholder="Scegli coppia" />
          </SelectTrigger>
          <SelectContent>
            {pairs.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.a} ↔ {p.b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              minTickGap={32}
            />
            <YAxis
              domain={[-1, 1]}
              ticks={[-1, -0.5, 0, 0.5, 1]}
              tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
              width={32}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "var(--card)",
                fontSize: 12,
              }}
              formatter={(v) => [Number(v).toFixed(2), "Correlazione"]}
            />
            <ReferenceArea y1={-0.2} y2={0.2} fill="var(--muted)" fillOpacity={0.5} label={{ value: "zona neutra", fontSize: 10, fill: "var(--muted-foreground)" }} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
        {data.length === 0 && (
          <p className="-mt-48 text-center text-xs text-muted-foreground">
            Servono almeno 60 giorni di dati per la finestra mobile.
          </p>
        )}
      </div>
    </div>
  );
}
