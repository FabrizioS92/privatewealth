import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompactCurrency, formatCurrency, formatShortDate } from "@/lib/format";

interface PerformancePoint {
  date: string;
  value: number;
}

export function PerformanceChart({
  data,
  currency = "EUR",
}: {
  data: PerformancePoint[];
  currency?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="perfGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="date"
          tickFormatter={(v) => formatShortDate(v)}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis
          tickFormatter={(v) => formatCompactCurrency(v, currency)}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            fontSize: 12,
          }}
          labelFormatter={(v) => formatShortDate(v as string)}
          formatter={(v: number) => [formatCurrency(v, currency), "Valore"]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="var(--color-primary)"
          strokeWidth={2}
          fill="url(#perfGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
