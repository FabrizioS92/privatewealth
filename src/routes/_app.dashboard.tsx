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
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-chart-2/20">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mt-6 text-2xl font-bold">Benvenuto su Folio</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Importa il tuo primo CSV DEGIRO per vedere portafoglio, performance e dividendi
          in pochi secondi.
        </p>
        <Button asChild className="mt-6 bg-primary text-primary-foreground hover:opacity-90">
          <Link to="/import">
            <Upload className="mr-2 h-4 w-4" />
            Importa CSV DEGIRO
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Ciao 👋</h1>
        <p className="text-sm text-muted-foreground">{formatDate(new Date())}</p>
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

      <Card className="border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Capitale investito nel tempo</h2>
            <p className="text-xs text-muted-foreground">
              Cumulato basato sulle tue transazioni
            </p>
          </div>
        </div>
        <PerformanceChart data={performance} />
      </Card>

      <Card className="border-border bg-card p-5">
        <div className="mb-4">
          <h2 className="font-semibold">Allocazione</h2>
          <p className="text-xs text-muted-foreground">Distribuzione per posizione</p>
        </div>
        <AllocationDonut data={allocation} />
      </Card>
    </div>
  );
}
