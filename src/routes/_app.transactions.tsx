import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_app/transactions")({
  head: () => ({ meta: [{ title: "Movimenti — Folio" }] }),
  component: TransactionsPage,
});

interface TxRow {
  id: string;
  trade_date: string;
  isin: string;
  name: string;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  fees: number;
  total: number;
}

function TransactionsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [txs, setTxs] = useState<TxRow[]>([]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("transactions")
        .select("id,trade_date,isin,name,type,quantity,price,currency,fees,total")
        .eq("user_id", user.id)
        .order("trade_date", { ascending: false });
      setTxs(
        (data ?? []).map((d) => ({
          ...d,
          quantity: Number(d.quantity),
          price: Number(d.price),
          fees: Number(d.fees),
          total: Number(d.total),
        })) as TxRow[],
      );
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <Skeleton className="h-96" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Movimenti</h1>
        <p className="text-sm text-muted-foreground">{txs.length} operazioni totali</p>
      </div>

      {txs.length === 0 ? (
        <Card className="border-border bg-card p-10 text-center text-muted-foreground">
          Nessuna operazione importata.
        </Card>
      ) : (
        <div className="space-y-2">
          {txs.map((t) => {
            const isBuy = t.type === "buy";
            return (
              <Card key={t.id} className="border-border bg-card p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      isBuy ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {isBuy ? (
                      <ArrowDownRight className="h-4 w-4" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDate(t.trade_date)} · {isBuy ? "Acquisto" : "Vendita"} ·{" "}
                      {formatNumber(t.quantity, 4)} @ {formatCurrency(t.price, t.currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        isBuy ? "text-foreground" : "text-success"
                      }`}
                    >
                      {isBuy ? "−" : "+"}
                      {formatCurrency(Math.abs(t.total), t.currency)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
