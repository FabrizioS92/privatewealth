import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  deltaLabel?: string;
  accent?: boolean;
  icon?: React.ReactNode;
  index?: number;
}

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  accent = false,
  icon,
  index = 0,
}: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.2, 0.8, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl p-5 md:p-6",
        accent
          ? "card-ink"
          : "card-soft",
      )}
    >
      {accent && (
        <span
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-50 blur-3xl"
          style={{ background: "var(--gradient-mint)" }}
        />
      )}
      <div className="flex items-start justify-between">
        <p
          className={cn(
            "text-xs font-medium tracking-wide",
            accent ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {label}
        </p>
        {icon && (
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              accent ? "bg-white/10 text-white" : "bg-mint-soft text-primary-foreground",
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <p
        className={cn(
          "mt-4 font-display text-3xl font-semibold tabular-nums tracking-tight md:text-4xl",
          accent ? "text-white" : "text-foreground",
        )}
      >
        {value}
      </p>
      {delta !== undefined && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
            positive
              ? accent
                ? "bg-mint/30 text-white"
                : "bg-mint-soft text-primary-foreground"
              : "bg-coral/15 text-coral",
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}
          {delta.toFixed(2)}%
          {deltaLabel && <span className="opacity-70">{deltaLabel}</span>}
        </div>
      )}
    </motion.div>
  );
}
