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
        "hover-lift relative overflow-hidden border-border p-6",
        accent ? "glass-strong shimmer" : "glass",
      )}
      style={{ boxShadow: "var(--shadow-elevated)" }}
    >
      {accent && (
        <span
          className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-gold)" }}
        />
      )}
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-gold/80">{label}</p>
      <p
        className={cn(
          "mt-3 text-3xl font-serif tabular-nums tracking-tight md:text-4xl",
          accent && "gold-text",
        )}
      >
        {value}
      </p>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
            positive
              ? "bg-success/10 text-success"
              : "bg-destructive/10 text-destructive",
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
