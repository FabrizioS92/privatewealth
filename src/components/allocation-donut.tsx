import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { motion } from "framer-motion";
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
      <div className="relative h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
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
              formatter={(v) => [formatCurrency(Number(v), currency), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Totale</p>
          <p className="mt-1 font-display text-xl font-semibold tabular-nums">
            {formatCurrency(total, currency)}
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        {data.slice(0, 8).map((d, i) => {
          const pct = total > 0 ? d.value / total : 0;
          return (
            <motion.div
              key={d.isin ?? d.name}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4 }}
              className="flex items-center gap-3 rounded-2xl bg-secondary/60 p-2.5"
            >
              <div
                className="h-3 w-3 shrink-0 rounded-full"
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
