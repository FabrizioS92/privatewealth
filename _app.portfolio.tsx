import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { computePositions, type ParsedTransaction, type Position } from "@/lib/degiro-parser";

export const Route = createFileRoute("/_app/portfolio")({
  head: () => ({ meta: [{ title: "Portafoglio — Folio" }] }),
  component: PortfolioPage,
});

const TONES = ["bg-mint-soft", "bg-peach", "bg-lavender", "bg-coral/20"];

function PortfolioPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [editing, setEditing] = useState<Position | null>(null);
  const [editPrice, setEditPrice] = useState("");

  // FIX: load avvolta in useCallback per evitare ricrearla ad ogni render
  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: txs, error: txErr }, { data: pricesData, error: priceErr }] = await Promise.all([
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("trade_date", { ascending: true }),
      supabase.from("manual_prices").select("isin,price").eq("user_id", user.id),
    ]);
    if (txErr ?? priceErr) {
      toast.error("Errore caricamento portafoglio: " + (txErr ?? priceErr)!.message);
      setLoading(false);
      return;
    }
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
    (pricesData ?? []).forEach((p) => {
      pmap[p.isin] = Number(p.price);
    });
    setPrices(pmap);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const positions = useMemo(() => computePositions(transactions), [transactions]);

  const savePrice = async () => {
    if (!editing || !user) return;
    const price = parseFloat(editPrice.replace(",", "."));
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Prezzo non valido");
      return;
    }
    const { error } = await supabase.from("manual_prices").upsert(
      {
        user_id: user.id,
        isin: editing.isin,
        price,
        currency: editing.currency,
      },
      { onConflict: "user_id,isin" },
    );
    if (error) {
      toast.error(error.message);
      return;
    }
    setPrices((p) => ({ ...p, [editing.isin]: price }));
    toast.success("Prezzo aggiornato");
    setEditing(null);
    setEditPrice("");
  };

  if (loading) return <Skeleton className="h-96 rounded-3xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Portafoglio
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {positions.length} posizioni · Tocca per aggiornare il prezzo
        </p>
      </div>

      {positions.length === 0 ? (
        <Card className="card-soft p-10 text-center text-muted-foreground">
          Nessuna posizione aperta. Importa un CSV DEGIRO per iniziare.
        </Card>
      ) : (
        <div className="space-y-3">
          {positions.map((p, i) => {
            const currentPrice = prices[p.isin] ?? p.avg_cost;
            const value = p.quantity * currentPrice;
            const pnl = value - p.total_invested;
            const pnlPct = p.total_invested > 0 ? pnl / p.total_invested : 0;
            const positive = pnl >= 0;
            const tone = TONES[i % TONES.length];
            const initials = p.name
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase();
            return (
              <motion.div
                key={p.isin}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.04 }}
              >
                <Card className="card-soft hover-lift p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone} font-display text-sm font-bold text-ink`}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{p.isin}</p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Qty:{" "}
                          <span className="tabular-nums text-foreground">
                            {formatNumber(p.quantity, 4)}
                          </span>
                        </span>
                        <span>
                          PMC:{" "}
                          <span className="tabular-nums text-foreground">
                            {formatCurrency(p.avg_cost, p.currency)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display font-semibold tabular-nums">
                        {formatCurrency(value, p.currency)}
                      </p>
                      <p
                        className={`pill mt-1 ${positive ? "pill-mint" : "pill-coral"}`}
                      >
                        {positive ? "+" : ""}
                        {formatPercent(pnlPct, 2)}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-2 text-[11px]"
                        onClick={() => {
                          setEditing(p);
                          setEditPrice(String(currentPrice));
                        }}
                      >
                        <Pencil className="mr-1 h-3 w-3" /> Prezzo
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">Aggiorna prezzo</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{editing.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{editing.isin}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Prezzo corrente ({editing.currency})</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.0001"
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="h-11 rounded-2xl bg-secondary/60"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Annulla
            </Button>
            <Button onClick={savePrice}>Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
