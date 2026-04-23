import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BarChart2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ETFSelector } from "@/components/correlation/etf-selector";
import { CorrelationHeatmap } from "@/components/correlation/correlation-heatmap";
import { InsightCards, type Insight } from "@/components/correlation/insight-cards";
import { RollingChart } from "@/components/correlation/rolling-chart";
import { DiversificationScore } from "@/components/correlation/diversification-score";
import { fetchManySeries, type PriceSeries } from "@/lib/yahoo-finance";
import {
  alignSeries,
  averageOffDiagonal,
  correlationPValue,
  labelText,
  logReturns,
  pearson,
} from "@/lib/correlation-math";

export const Route = createFileRoute("/_app/correlation")({
  head: () => ({ meta: [{ title: "Correlazione ETF — Folio" }] }),
  component: CorrelationPage,
});

const DEFAULT_TICKERS = ["VWCE.DE", "IUIT.L", "AGGH.L", "IEMG.L"];
const PALETTE = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--coral)",
  "var(--lavender)",
  "var(--peach)",
];

interface AnalysisResult {
  series: PriceSeries[];
  matrix: number[][];
  pvalues: number[][];
  avg: number;
}

function buildInsights(result: AnalysisResult): Insight[] {
  const { matrix, series, avg } = result;
  const out: Insight[] = [];
  let bestHigh: { i: number; j: number; r: number } | null = null;
  let bestLow: { i: number; j: number; r: number } | null = null;
  let bestNeg: { i: number; j: number; r: number } | null = null;

  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix.length; j++) {
      const r = matrix[i][j];
      if (!bestHigh || r > bestHigh.r) bestHigh = { i, j, r };
      if (!bestLow || Math.abs(r) < Math.abs(bestLow.r)) bestLow = { i, j, r };
      if (!bestNeg || r < bestNeg.r) bestNeg = { i, j, r };
    }
  }

  if (bestHigh && bestHigh.r >= 0.7) {
    out.push({
      kind: "high",
      text: `${series[bestHigh.i].ticker} e ${series[bestHigh.j].ticker} si muovono quasi sempre insieme (+${bestHigh.r.toFixed(2)}). Tenerli entrambi non diversifica molto il rischio.`,
    });
  } else if (bestHigh && bestHigh.r >= 0.4) {
    out.push({
      kind: "medium",
      text: `${series[bestHigh.i].ticker} e ${series[bestHigh.j].ticker} sono ${labelText(bestHigh.r).toLowerCase()} (+${bestHigh.r.toFixed(2)}). Diversificazione parziale.`,
    });
  }

  if (bestLow && Math.abs(bestLow.r) < 0.2 && (!bestHigh || bestLow.i !== bestHigh.i || bestLow.j !== bestHigh.j)) {
    const sign = bestLow.r >= 0 ? "+" : "";
    out.push({
      kind: "low",
      text: `${series[bestLow.i].ticker} e ${series[bestLow.j].ticker} sono quasi indipendenti (${sign}${bestLow.r.toFixed(2)}). Questa coppia diversifica bene.`,
    });
  }

  if (bestNeg && bestNeg.r < -0.2) {
    out.push({
      kind: "low",
      text: `${series[bestNeg.i].ticker} e ${series[bestNeg.j].ticker} si muovono in direzioni opposte (${bestNeg.r.toFixed(2)}): un'ottima copertura naturale.`,
    });
  }

  out.push({
    kind: "summary",
    text: `La tua correlazione media di portafoglio è ${avg.toFixed(2)} (${avg < 0.3 ? "buona diversificazione" : avg < 0.6 ? "diversificazione moderata" : "diversificazione bassa"}).`,
  });

  return out.slice(0, 4);
}

function CorrelationPage() {
  const [tickers, setTickers] = useState<string[]>(DEFAULT_TICKERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const colorMap = useMemo(() => {
    const map: Record<string, string> = {};
    tickers.forEach((t, i) => {
      map[t] = PALETTE[i % PALETTE.length];
    });
    return map;
  }, [tickers]);

  const handleAdd = (t: string) => {
    if (tickers.includes(t)) return;
    setTickers((prev) => [...prev, t]);
  };

  const handleRemove = (t: string) => {
    setTickers((prev) => prev.filter((x) => x !== t));
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const series = await fetchManySeries(tickers);
      // Compute log returns and align all to the shortest series
      const returns = series.map((s) => logReturns(s.prices));
      const minLen = Math.min(...returns.map((r) => r.length));
      const aligned = returns.map((r) => r.slice(r.length - minLen));

      const n = series.length;
      const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
      const pvalues: number[][] = Array.from({ length: n }, () => Array(n).fill(1));
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) {
            matrix[i][j] = 1;
            pvalues[i][j] = 0;
            continue;
          }
          const [a, b] = alignSeries(aligned[i], aligned[j]);
          const r = pearson(a, b);
          matrix[i][j] = r;
          pvalues[i][j] = correlationPValue(r, a.length);
        }
      }
      const avg = averageOffDiagonal(matrix);
      setResult({ series, matrix, pvalues, avg });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Dati temporaneamente non disponibili, riprova";
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const insights = result ? buildInsights(result) : [];
  const score = result ? Math.max(0, Math.min(100, (1 - result.avg) * 100)) : 50;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <BarChart2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Correlazione ETF</h1>
            <p className="text-sm text-muted-foreground">
              Scopri quanto i tuoi ETF si muovono insieme. Più sono indipendenti, meglio è diversificato il portafoglio.
            </p>
          </div>
        </div>
      </motion.div>

      <Card className="p-6">
        <ETFSelector
          tickers={tickers}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onAnalyze={handleAnalyze}
          loading={loading}
          colorMap={colorMap}
        />
        {error && (
          <div className="mt-4 flex items-center justify-between rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <span>{error.includes("non trovato") ? "ETF non trovato, controlla il codice (es. VWCE.DE)." : "Dati temporaneamente non disponibili, riprova."}</span>
            <Button size="sm" variant="outline" onClick={handleAnalyze} className="rounded-full">
              <RefreshCw className="h-4 w-4" />
              Riprova
            </Button>
          </div>
        )}
      </Card>

      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
          <Skeleton className="h-64 w-full rounded-3xl" />
        </div>
      )}

      {result && !loading && (
        <>
          <DiversificationScore score={score} />

          <Card className="p-6">
            <div className="mb-4">
              <h2 className="font-display text-lg font-semibold">Matrice di correlazione</h2>
              <p className="text-xs text-muted-foreground">
                Quanto si muovono insieme due ETF, da −1 (opposti) a +1 (identici).
              </p>
            </div>
            <CorrelationHeatmap
              tickers={result.series.map((s) => s.ticker)}
              matrix={result.matrix}
              pvalues={result.pvalues}
            />
          </Card>

          <InsightCards insights={insights} />

          <Card className="p-6">
            <RollingChart series={result.series} />
          </Card>
        </>
      )}

      {!result && !loading && !error && (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Aggiungi i tuoi ETF e premi <span className="font-semibold text-foreground">Analizza</span> per scoprire come si muovono tra loro.
          </p>
        </Card>
      )}
    </div>
  );
}
