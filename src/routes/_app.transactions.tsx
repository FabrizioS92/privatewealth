import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
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

  if (loading) return <Skeleton className="h-96 rounded-3xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Movimenti
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{txs.length} operazioni totali</p>
      </div>

      {txs.length === 0 ? (
        <Card className="card-soft p-10 text-center text-muted-foreground">
          Nessuna operazione importata.
        </Card>
      ) : (
        <div className="space-y-2.5">
          {txs.map((t, i) => {
            const isBuy = t.type === "buy";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i, 10) * 0.025 }}
              >
                <Card className="card-soft p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                        isBuy ? "bg-mint-soft text-primary-foreground" : "bg-coral/15 text-coral"
                      }`}
                    >
                      {isBuy ? (
                        <ArrowDownRight className="h-5 w-5" />
                      ) : (
                        <ArrowUpRight className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {formatDate(t.trade_date)} · {isBuy ? "Acquisto" : "Vendita"} ·{" "}
                        {formatNumber(t.quantity, 4)} @ {formatCurrency(t.price, t.currency)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-display text-sm font-semibold tabular-nums ${
                          isBuy ? "text-foreground" : "text-success"
                        }`}
                      >
                        {isBuy ? "−" : "+"}
                        {formatCurrency(Math.abs(t.total), t.currency)}
                      </p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
