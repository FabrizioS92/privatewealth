import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Coins, Globe2, PieChart, Scale, Sparkles, TrendingUp, Upload, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { KpiCard } from "@/components/kpi-card";
import { CountUp } from "@/components/count-up";
import { PerformanceChart } from "@/components/performance-chart";
import { AllocationDonut } from "@/components/allocation-donut";
import { RangeSelector } from "@/components/range-selector";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ParsedTransaction } from "@/lib/degiro-parser";
import { computePositions } from "@/lib/degiro-parser";
import { computePortfolioHistory, type PriceHistoryRow, type RangeKey } from "@/lib/portfolio-history";
import { RebalancingTable } from "@/components/rebalancing-table";
import { buildRebalancingRows, computeTargetAllocation } from "@/lib/rebalancing";
import { GeoAllocation } from "@/components/geo-allocation";
import { computeGeoAllocation } from "@/lib/geo-allocation";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Home — Folio" }] }),
  component: Dashboard,
});

interface ManualPrice {
  isin: string;
  price: number;
}

function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [dividendsTotal, setDividendsTotal] = useState(0);
  const [range, setRange] = useState<RangeKey>("6M");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: txs }, { data: pricesData }, { data: divs }, { data: phData }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("trade_date", { ascending: true }),
        supabase.from("manual_prices").select("isin,price").eq("user_id", user.id),
        supabase.from("dividends").select("net_amount").eq("user_id", user.id),
        supabase
          .from("price_history")
          .select("isin,price,recorded_at")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: true }),
      ]);

      setTransactions(
        (txs ?? []).map((t) => ({
          ...t,
          quantity: Number(t.quantity),
          price: Number(t.price),
          fees: Number(t.fees),
          total: Number(t.total),
          fx_rate: Number(t.fx_rate ?? 1),
          created_at: t.created_at,
        })) as unknown as ParsedTransaction[],
      );
      const pmap: Record<string, number> = {};
      (pricesData as ManualPrice[] | null)?.forEach((p) => {
        pmap[p.isin] = Number(p.price);
      });
      setPrices(pmap);
      setPriceHistory(
        (phData ?? []).map((r) => ({
          isin: r.isin,
          price: Number(r.price),
          recorded_at: String(r.recorded_at),
        })),
      );
      setDividendsTotal((divs ?? []).reduce((s, d) => s + Number(d.net_amount), 0));
      setLoading(false);
    })();
  }, [user]);

  const positions = useMemo(() => computePositions(transactions), [transactions]);

  const stats = useMemo(() => {
    let invested = 0;
    let marketValue = 0;
    for (const p of positions) {
      invested += p.total_invested;
      const px = prices[p.isin] ?? p.avg_cost;
      marketValue += p.quantity * px;
    }
    const pnl = marketValue - invested;
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;
    return { invested, marketValue, pnl, pnlPct };
  }, [positions, prices]);

  const allocation = useMemo(
    () =>
      positions
        .map((p) => ({
          name: p.name,
          isin: p.isin,
          value: p.quantity * (prices[p.isin] ?? p.avg_cost),
        }))
        .sort((a, b) => b.value - a.value),
    [positions, prices],
  );

  const performance = useMemo(
    () => computePortfolioHistory(transactions, priceHistory, prices, range),
    [transactions, priceHistory, prices, range],
  );

  const periodChange = useMemo(() => {
    if (performance.length < 2) return { abs: 0, pct: 0 };
    const first = performance[0].value;
    const last = performance[performance.length - 1].value;
    const abs = last - first;
    const pct = first > 0 ? (abs / first) * 100 : 0;
    return { abs, pct };
  }, [performance]);

  const geoAllocation = useMemo(
    () => computeGeoAllocation(positions, prices),
    [positions, prices],
  );

  const rebalancing = useMemo(() => {
    const target = computeTargetAllocation(transactions);
    if (Object.keys(target).length === 0) return null;
    return buildRebalancingRows(positions, prices, target);
  }, [transactions, positions, prices]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-3xl" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
        <Skeleton className="h-72 rounded-3xl" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="flex h-20 w-20 items-center justify-center rounded-3xl"
          style={{ background: "var(--gradient-mint)", boxShadow: "var(--shadow-mint)" }}
        >
          <Sparkles className="h-9 w-9 text-primary-foreground" />
        </motion.div>
        <h2 className="mt-7 font-display text-3xl font-semibold tracking-tight">
          Benvenuto su Folio
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
          Importa il tuo primo CSV DEGIRO per vedere portafoglio, performance e dividendi.
        </p>
        <Button asChild className="mt-7 h-12 px-7">
          <Link to="/import">
            <Upload className="mr-2 h-4 w-4" />
            Importa CSV DEGIRO
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-1"
      >
        <p className="text-xs font-medium text-muted-foreground">{formatDate(new Date())}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Buongiorno 👋
        </h1>
      </motion.div>

      {/* Hero balance card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        className="card-ink relative overflow-hidden rounded-3xl p-7 md:p-9"
      >
        <span
          className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-60 blur-3xl"
          style={{ background: "var(--gradient-mint)" }}
        />
        <span
          className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-card-coral)" }}
        />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-white/70">Valore portafoglio</p>
            <p className="mt-3 font-display text-5xl font-semibold tabular-nums tracking-tight md:text-6xl">
              <CountUp value={stats.marketValue} format={(n) => formatCurrency(n)} />
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                  stats.pnl >= 0 ? "bg-mint/30 text-white" : "bg-coral/30 text-white"
                }`}
              >
                <ArrowUpRight className={`h-3 w-3 ${stats.pnl < 0 ? "rotate-90" : ""}`} />
                {stats.pnl >= 0 ? "+" : ""}
                {stats.pnlPct.toFixed(2)}%
              </span>
              <span className="text-xs text-white/60 tabular-nums">
                {stats.pnl >= 0 ? "+" : ""}
                {formatCurrency(stats.pnl)}
              </span>
            </div>
          </div>
          <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-white/10 md:flex">
            <Wallet className="h-5 w-5 text-white" />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <KpiCard
          label="Investito"
          value={formatCurrency(stats.invested)}
          icon={<TrendingUp className="h-4 w-4" />}
          index={0}
        />
        <KpiCard
          label="Dividendi netti"
          value={formatCurrency(dividendsTotal)}
          icon={<Coins className="h-4 w-4" />}
          index={1}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="card-soft p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Performance</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Performance portafoglio</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
                    periodChange.abs >= 0 ? "bg-mint-soft text-ink" : "bg-coral/20 text-ink"
                  }`}
                >
                  {periodChange.abs >= 0 ? "+" : ""}
                  {periodChange.pct.toFixed(2)}%
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {periodChange.abs >= 0 ? "+" : ""}
                  {formatCurrency(periodChange.abs)}
                </span>
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-mint-soft text-primary-foreground">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mb-3 -mx-1 overflow-x-auto">
            <RangeSelector value={range} onChange={setRange} />
          </div>
          <PerformanceChart data={performance} />
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Storico basato sui prezzi rilevati negli import CSV. Più CSV importi, più la curva sarà ricca di punti reali.
          </p>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="card-soft p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Composizione</p>
              <h2 className="mt-1 font-display text-xl font-semibold">Allocazione</h2>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-peach text-ink">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <AllocationDonut data={allocation} />
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <Card className="card-soft p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Geografia
              </p>
              <h2 className="mt-1 font-display text-xl font-semibold">Allocazione geografica</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Distribuzione per paese di emissione (codice ISIN)
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-primary-foreground">
              <Globe2 className="h-4 w-4" />
            </div>
          </div>
          <GeoAllocation data={geoAllocation} />
        </Card>
      </motion.div>

      {rebalancing && rebalancing.rows.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card className="card-soft p-5 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ribilanciamento
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold">
                  Scostamento dalla target allocation
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Confronto tra l'allocazione attuale e quella del primo CSV importato
                </p>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-primary-foreground">
                <Scale className="h-4 w-4" />
              </div>
            </div>
            <RebalancingTable rows={rebalancing.rows} totalValue={rebalancing.totalValue} />
          </Card>
        </motion.div>
      )}
    </div>
  );
}
