import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  accent?: boolean;
}

export function KpiCard({ label, value, delta, deltaLabel, accent = false }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <Card
      className={cn(
        "relative overflow-hidden border-border bg-card p-5 shadow-[var(--shadow-elevated)]",
        accent && "bg-gradient-to-br from-primary/15 to-chart-2/10",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums md:text-3xl">{value}</p>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-2 inline-flex items-center gap-1 text-xs font-medium tabular-nums",
            positive ? "text-success" : "text-destructive",
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}
          {delta.toFixed(2)}%
          {deltaLabel && <span className="text-muted-foreground">{deltaLabel}</span>}
        </div>
      )}
    </Card>
  );
}
