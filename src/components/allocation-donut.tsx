import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/format";

export interface AllocationSlice {
  name: string;
  value: number;
  isin?: string;
}

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export function AllocationDonut({
  data,
  currency = "EUR",
}: {
  data: AllocationSlice[];
  currency?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="relative h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-popover)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(v) => [formatCurrency(Number(v), currency), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Totale</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(total, currency)}</p>
        </div>
      </div>
      <div className="space-y-2">
        {data.slice(0, 8).map((d, i) => {
          const pct = total > 0 ? d.value / total : 0;
          return (
            <div key={d.isin ?? d.name} className="flex items-center gap-3">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{d.name}</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="text-sm font-semibold">{formatPercent(pct, 1)}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatCurrency(d.value, currency)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
