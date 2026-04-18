import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiCard } from "@/components/kpi-card";
import { formatCompactCurrency, formatCurrency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/dividends")({
  head: () => ({ meta: [{ title: "Dividendi — Folio" }] }),
  component: DividendsPage,
});

interface DividendRow {
  id: string;
  pay_date: string;
  isin: string;
  name: string;
  amount: number;
  currency: string;
  withholding_tax: number;
  net_amount: number;
}

function DividendsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [divs, setDivs] = useState<DividendRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("dividends")
        .select("*")
        .eq("user_id", user.id)
        .order("pay_date", { ascending: false });
      setDivs(
        (data ?? []).map((d) => ({
          ...d,
          amount: Number(d.amount),
          withholding_tax: Number(d.withholding_tax),
          net_amount: Number(d.net_amount),
        })) as DividendRow[],
      );
      setLoading(false);
    })();
  }, [user]);

  const stats = useMemo(() => {
    const gross = divs.reduce((s, d) => s + d.amount, 0);
    const tax = divs.reduce((s, d) => s + d.withholding_tax, 0);
    const net = divs.reduce((s, d) => s + d.net_amount, 0);
    return { gross, tax, net };
  }, [divs]);

  const monthly = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of divs) {
      const key = d.pay_date.slice(0, 7); // yyyy-mm
      map.set(key, (map.get(key) ?? 0) + d.net_amount);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, value]) => ({ month, value }));
  }, [divs]);

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Dividendi</h1>
        <p className="text-sm text-muted-foreground">{divs.length} pagamenti ricevuti</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Lordo totale" value={formatCurrency(stats.gross)} />
        <KpiCard label="Ritenute" value={formatCurrency(stats.tax)} />
        <KpiCard label="Netto incassato" value={formatCurrency(stats.net)} accent />
      </div>

      {monthly.length > 0 && (
        <Card className="border-border bg-card p-5">
          <h2 className="mb-4 font-semibold">Dividendi mensili (netti)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <XAxis
                dataKey="month"
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => formatCompactCurrency(v)}
                stroke="var(--color-muted-foreground)"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(v) => [formatCurrency(Number(v)), "Netto"]}
              />
              <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {divs.length === 0 ? (
        <Card className="border-border bg-card p-10 text-center text-muted-foreground">
          Nessun dividendo registrato. Importa Account.csv da DEGIRO.
        </Card>
      ) : (
        <div className="space-y-2">
          {divs.map((d) => (
            <Card key={d.id} className="border-border bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{d.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatDate(d.pay_date)} · Lordo {formatCurrency(d.amount, d.currency)} ·
                    Tax {formatCurrency(d.withholding_tax, d.currency)}
                  </p>
                </div>
                <p className="text-sm font-semibold tabular-nums text-success">
                  +{formatCurrency(d.net_amount, d.currency)}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
