import { motion } from "framer-motion";

export interface Insight {
  kind: "high" | "low" | "medium" | "summary";
  text: string;
}

interface Props {
  insights: Insight[];
}

const ICONS: Record<Insight["kind"], string> = {
  high: "🔴",
  low: "🟢",
  medium: "🟡",
  summary: "📊",
};

const ACCENTS: Record<Insight["kind"], string> = {
  high: "border-coral/40 bg-coral/10",
  low: "border-primary/40 bg-primary/10",
  medium: "border-warning/40 bg-warning/10",
  summary: "border-border bg-secondary/50",
};

export function InsightCards({ insights }: Props) {
  if (insights.length === 0) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {insights.map((ins, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.25 }}
          className={`flex items-start gap-3 rounded-3xl border p-4 ${ACCENTS[ins.kind]}`}
        >
          <span className="text-xl leading-none">{ICONS[ins.kind]}</span>
          <p className="text-sm leading-relaxed text-foreground">{ins.text}</p>
        </motion.div>
      ))}
    </div>
  );
}
