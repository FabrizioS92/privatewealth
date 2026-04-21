import { motion } from "framer-motion";
import type { RangeKey } from "@/lib/portfolio-history";
import { cn } from "@/lib/utils";

const RANGES: RangeKey[] = ["3M", "6M", "1Y", "2Y", "3Y", "MAX"];

export function RangeSelector({
  value,
  onChange,
  labels,
}: {
  value: RangeKey;
  onChange: (r: RangeKey) => void;
  labels?: Partial<Record<RangeKey, string>>;
}) {
  return (
    <div className="inline-flex items-center gap-1 rounded-2xl bg-secondary/60 p-1">
      {RANGES.map((r) => {
        const active = r === value;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            className={cn(
              "relative rounded-xl px-3 py-1.5 text-xs font-semibold tabular-nums transition-colors",
              active ? "text-ink" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId="range-pill"
                className="absolute inset-0 rounded-xl bg-mint-soft"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{labels?.[r] ?? r}</span>
          </button>
        );
      })}
    </div>
  );
}
