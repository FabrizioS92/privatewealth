import { useEffect, useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Upload } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { KpiCard } from "@/components/kpi-card";
import { PerformanceChart } from "@/components/performance-chart";
import { AllocationDonut } from "@/components/allocation-donut";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ParsedTransaction } from "@/lib/degiro-parser";
import { computePositions } from "@/lib/degiro-parser";

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
  const [dividendsTotal, setDividendsTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: txs }, { data: pricesData }, { data: divs }] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", user.id)
          .order("trade_date", { ascending: true }),
        supabase.from("manual_prices").select("isin,price").eq("user_id", user.id),
        supabase.from("dividends").select("net_amount").eq("user_id", user.id),
      ]);

      setTransactions(
        (txs ?? []).map((t) => ({
          ...t,
          quantity: Number(t.quantity),
          price: Number(t.price),
          fees: Number(t.fees),
          total: Number(t.total),
          fx_rate: Number(t.fx_rate ?? 1),
        })) as unknown as ParsedTransaction[],
      );
      const pmap: Record<string, number> = {};
      (pricesData as ManualPrice[] | null)?.forEach((p) => {
        pmap[p.isin] = Number(p.price);
      });
      setPrices(pmap);
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

  // Performance series: cumulativo invested vs market vibe via transazioni
  const performance = useMemo(() => {
    if (transactions.length === 0) return [];
    const byDate = new Map<string, number>();
    let cum = 0;
    for (const tx of transactions) {
      const sign = tx.type === "buy" ? 1 : -1;
      cum += sign * tx.quantity * tx.price;
      byDate.set(tx.trade_date, cum);
    }
    return Array.from(byDate.entries()).map(([date, value]) => ({ date, value }));
  }, [transactions]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full border border-gold/30"
          style={{ background: "var(--gradient-gold)" }}
        >
          <Sparkles className="h-7 w-7 text-primary-foreground" />
        </div>
        <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-gold/80">Welcome</p>
        <h2 className="mt-3 font-serif text-3xl tracking-tight">Benvenuto su Folio</h2>
        <div className="mx-auto mt-4 gold-divider w-16" />
        <p className="mt-5 max-w-md text-sm leading-relaxed text-muted-foreground">
          Importa il tuo primo CSV DEGIRO per vedere portafoglio, performance e dividendi
          curati con eleganza.
        </p>
        <Button asChild variant="luxury" className="mt-7 rounded-full px-7">
          <Link to="/import">
            <Upload className="mr-2 h-4 w-4" />
            Importa CSV DEGIRO
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-[0.25em] text-gold/80">
          {formatDate(new Date())}
        </p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
          Buongiorno <span className="gold-text italic">·</span>
        </h1>
        <div className="mt-4 gold-divider w-16" />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Valore portafoglio" value={formatCurrency(stats.marketValue)} accent />
        <KpiCard
          label="P&L totale"
          value={formatCurrency(stats.pnl)}
          delta={stats.pnlPct}
          deltaLabel=""
        />
        <KpiCard label="Dividendi netti" value={formatCurrency(dividendsTotal)} />
      </div>

      <Card className="glass hover-lift border-border p-6" style={{ boxShadow: "var(--shadow-elevated)" }}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80">Performance</p>
            <h2 className="mt-1 font-serif text-2xl">Capitale nel tempo</h2>
          </div>
        </div>
        <PerformanceChart data={performance} />
      </Card>

      <Card className="glass hover-lift border-border p-6" style={{ boxShadow: "var(--shadow-elevated)" }}>
        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold/80">Composizione</p>
          <h2 className="mt-1 font-serif text-2xl">Allocazione</h2>
        </div>
        <AllocationDonut data={allocation} />
      </Card>
    </div>
  );
}
