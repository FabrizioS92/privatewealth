import { useState, type KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  tickers: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
  onAnalyze: () => void;
  loading: boolean;
  colorMap: Record<string, string>;
  error?: string | null;
}

export function ETFSelector({ tickers, onAdd, onRemove, onAnalyze, loading, colorMap, error }: Props) {
  const [value, setValue] = useState("");

  const handleAdd = () => {
    const v = value.trim().toUpperCase();
    if (!v) return;
    onAdd(v);
    setValue("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  const canAnalyze = tickers.length >= 2 && !loading;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Aggiungi ticker (es. VWCE.DE)"
            className="rounded-2xl"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleAdd}
            className="shrink-0 rounded-full"
          >
            <Plus className="h-4 w-4" />
            Aggiungi
          </Button>
        </div>
        <Button
          type="button"
          onClick={onAnalyze}
          disabled={!canAnalyze}
          className="rounded-full"
        >
          <Sparkles className="h-4 w-4" />
          Analizza
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <AnimatePresence initial={false}>
          {tickers.map((t) => (
            <motion.div
              key={t}
              layout
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs font-semibold"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorMap[t] ?? "var(--color-chart-1)" }}
              />
              <span>{t}</span>
              <button
                type="button"
                onClick={() => onRemove(t)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={`Rimuovi ${t}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {tickers.length < 2 && (
        <p className="text-xs text-muted-foreground">
          Aggiungi almeno 2 ETF per vedere la correlazione.
        </p>
      )}
    </div>
  );
}
