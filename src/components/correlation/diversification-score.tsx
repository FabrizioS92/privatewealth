import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface Props {
  score: number; // 0-100
}

function descriptor(score: number): { label: string; tone: string; help: string } {
  if (score < 40) {
    return {
      label: "Poco diversificato",
      tone: "text-destructive",
      help: "I tuoi ETF si muovono molto insieme. Un calo di settore potrebbe colpirli tutti contemporaneamente.",
    };
  }
  if (score < 65) {
    return {
      label: "Moderatamente diversificato",
      tone: "text-warning",
      help: "C'è una certa diversificazione, ma alcune coppie si muovono ancora in modo simile.",
    };
  }
  return {
    label: "Ben diversificato",
    tone: "text-primary",
    help: "I tuoi ETF si muovono abbastanza in modo indipendente. Buona protezione contro i cali settoriali.",
  };
}

export function DiversificationScore({ score }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const d = descriptor(clamped);
  return (
    <Card className="overflow-hidden p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Diversificazione del portafoglio
          </p>
          <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Il tuo portafoglio è diversificato al{" "}
            <motion.span
              key={clamped}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={d.tone}
            >
              {clamped}%
            </motion.span>
          </h2>
          <p className={`mt-1 text-sm font-semibold ${d.tone}`}>{d.label}</p>
        </div>
      </div>
      <div className="mt-5">
        <Progress value={clamped} className="h-3" />
        <p className="mt-3 text-sm text-muted-foreground">{d.help}</p>
      </div>
    </Card>
  );
}
