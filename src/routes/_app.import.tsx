import { useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Loader2, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseDegiroCsv, type ParsedTransaction, type ParseResult } from "@/lib/degiro-parser";
import { formatCurrency, formatPercent } from "@/lib/format";

export const Route = createFileRoute("/_app/import")({
  head: () => ({ meta: [{ title: "Importa CSV — Folio" }] }),
  component: ImportPage,
});

interface PriceChange {
  isin: string;
  name: string;
  oldPrice: number | null;
  newPrice: number;
  currency: string;
  oldCurrency: string | null;
  deltaPct: number | null;
  isNew: boolean;
}

function latestPricePerIsin(txs: ParsedTransaction[]): Map<string, ParsedTransaction> {
  const map = new Map<string, ParsedTransaction>();
  for (const tx of txs) {
    if (!tx.isin || !Number.isFinite(tx.price) || tx.price <= 0) continue;
    const existing = map.get(tx.isin);
    if (!existing || tx.trade_date > existing.trade_date) {
      map.set(tx.isin, tx);
    }
  }
  return map;
}

function ImportPage() {
  const { user } = useAuth();
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ inserted: number; skipped: number } | null>(null);
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([]);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResult(null);
    setImported(null);
    setPriceChanges([]);
    try {
      const text = await file.text();
      const r = await parseDegiroCsv(text);
      setResult(r);
      if (r.detected === "unknown") {
        toast.error("Formato CSV non riconosciuto");
      } else {
        toast.success(
          `Riconosciuto: ${r.detected === "transactions" ? "Transactions" : "Account"}`,
        );
      }
    } catch (err) {
      toast.error(friendlyError(err, "Errore durante il parsing del file."));
    } finally {
      setParsing(false);
    }
  };

  const syncPrices = async (txs: ParsedTransaction[]): Promise<PriceChange[]> => {
    if (!user || txs.length === 0) return [];

    // 1. snapshot prezzi attuali
    const { data: existing } = await supabase
      .from("manual_prices")
      .select("isin, price, currency")
      .eq("user_id", user.id);

    const oldMap = new Map<string, { price: number; currency: string }>();
    (existing ?? []).forEach((p) =>
      oldMap.set(p.isin, { price: Number(p.price), currency: p.currency }),
    );

    // 2. nuovo prezzo = ultimo per ISIN
    const latest = latestPricePerIsin(txs);
    if (latest.size === 0) return [];

    // 3. upsert manual_prices + insert price_history + calcolo delta
    const upserts = Array.from(latest.values()).map((tx) => ({
      user_id: user.id,
      isin: tx.isin,
      price: tx.price,
      currency: tx.currency,
    }));
    const historyRows = upserts.map((r) => ({ ...r }));

    const [{ error: upErr }, { error: histErr }] = await Promise.all([
      supabase.from("manual_prices").upsert(upserts, { onConflict: "user_id,isin" }),
      supabase.from("price_history").insert(historyRows),
    ]);
    if (upErr) throw upErr;
    if (histErr) console.warn("price_history insert error", histErr);

    // 4. costruisci elenco variazioni
    const changes: PriceChange[] = [];
    for (const tx of latest.values()) {
      const prev = oldMap.get(tx.isin);
      const isNew = !prev;
      let deltaPct: number | null = null;
      if (prev && prev.price > 0 && prev.currency === tx.currency) {
        deltaPct = (tx.price - prev.price) / prev.price;
      }
      changes.push({
        isin: tx.isin,
        name: tx.name,
        oldPrice: prev?.price ?? null,
        newPrice: tx.price,
        currency: tx.currency,
        oldCurrency: prev?.currency ?? null,
        deltaPct,
        isNew,
      });
    }
    // ordina per |Δ%| desc, nuovi in fondo
    changes.sort((a, b) => {
      if (a.isNew && !b.isNew) return 1;
      if (!a.isNew && b.isNew) return -1;
      return Math.abs(b.deltaPct ?? 0) - Math.abs(a.deltaPct ?? 0);
    });
    return changes;
  };

  const doImport = async () => {
    if (!result || !user) return;
    setImporting(true);
    try {
      let inserted = 0;
      let skipped = 0;

      if (result.transactions.length > 0) {
        const rows = result.transactions.map((t) => ({ ...t, user_id: user.id }));
        const { error, count } = await supabase
          .from("transactions")
          .upsert(rows, {
            onConflict: "user_id,dedup_hash",
            ignoreDuplicates: true,
            count: "exact",
          });
        if (error) throw error;
        inserted += count ?? 0;
        skipped += rows.length - (count ?? 0);
      }

      if (result.dividends.length > 0) {
        const rows = result.dividends.map((d) => ({ ...d, user_id: user.id }));
        const { error, count } = await supabase
          .from("dividends")
          .upsert(rows, {
            onConflict: "user_id,dedup_hash",
            ignoreDuplicates: true,
            count: "exact",
          });
        if (error) throw error;
        inserted += count ?? 0;
        skipped += rows.length - (count ?? 0);
      }

      // sincronizza prezzi e calcola scostamenti
      const changes = await syncPrices(result.transactions);
      setPriceChanges(changes);

      setImported({ inserted, skipped });
      const updated = changes.filter((c) => !c.isNew).length;
      const created = changes.filter((c) => c.isNew).length;
      toast.success(
        `${inserted} righe importate · ${skipped} duplicate · ${updated} prezzi aggiornati · ${created} nuovi`,
      );
    } catch (err) {
      toast.error(friendlyError(err, "Importazione non riuscita."));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Importa CSV
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carica <code className="rounded-md bg-secondary px-1.5 py-0.5 text-xs">Transactions.csv</code>{" "}
          o <code className="rounded-md bg-secondary px-1.5 py-0.5 text-xs">Account.csv</code> da
          DEGIRO. I prezzi vengono aggiornati automaticamente e confrontati con l'import precedente.
        </p>
      </div>

      <Card className="card-soft border-2 border-dashed border-border p-10 text-center">
        <input
          id="file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="hidden"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl"
            style={{ background: "var(--gradient-mint)", boxShadow: "var(--shadow-mint)" }}
          >
            <Upload className="h-7 w-7 text-primary-foreground" />
          </motion.div>
          <p className="mt-5 font-display text-lg font-semibold">Trascina o seleziona il CSV</p>
          <p className="mt-1 text-xs text-muted-foreground">Max 10MB · Italiano o inglese</p>
          <Button type="button" asChild className="mt-5">
            <span>
              {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Scegli file
            </span>
          </Button>
        </label>
      </Card>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="card-soft p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-primary-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-display font-semibold capitalize">File: {result.detected}</p>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-2xl bg-secondary/60 p-3">
                    <p className="text-xs text-muted-foreground">Transazioni</p>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                      {result.transactions.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-secondary/60 p-3">
                    <p className="text-xs text-muted-foreground">Dividendi</p>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">
                      {result.dividends.length}
                    </p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <p className="mt-2 text-xs text-warning">
                    {result.errors.length} avvisi durante il parsing
                  </p>
                )}
                {imported ? (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-mint-soft p-3 text-sm font-medium text-primary-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    Importate {imported.inserted} righe · {imported.skipped} duplicate ignorate
                  </div>
                ) : (
                  <Button
                    onClick={doImport}
                    disabled={
                      importing ||
                      (result.transactions.length === 0 && result.dividends.length === 0)
                    }
                    className="mt-4"
                  >
                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Importa nel portafoglio
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {priceChanges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <Card className="card-soft p-6">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-lg font-semibold">Variazioni prezzi</h3>
              <p className="text-xs text-muted-foreground">
                {priceChanges.filter((c) => !c.isNew).length} aggiornati ·{" "}
                {priceChanges.filter((c) => c.isNew).length} nuovi
              </p>
            </div>
            <div className="mt-4 divide-y divide-border">
              {priceChanges.slice(0, 10).map((c) => {
                const positive = (c.deltaPct ?? 0) > 0;
                const negative = (c.deltaPct ?? 0) < 0;
                return (
                  <div key={c.isin} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{c.isin}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="flex items-center justify-end gap-2 text-xs tabular-nums text-muted-foreground">
                        {c.oldPrice !== null ? (
                          <>
                            <span>{formatCurrency(c.oldPrice, c.oldCurrency ?? c.currency)}</span>
                            <span>→</span>
                            <span className="font-semibold text-foreground">
                              {formatCurrency(c.newPrice, c.currency)}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold text-foreground">
                            {formatCurrency(c.newPrice, c.currency)}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex justify-end">
                        {c.isNew ? (
                          <span className="pill bg-secondary text-muted-foreground">Nuovo</span>
                        ) : c.deltaPct === null ? (
                          <span className="pill bg-secondary text-muted-foreground">—</span>
                        ) : (
                          <span
                            className={`pill inline-flex items-center gap-1 ${
                              positive ? "pill-mint" : negative ? "pill-coral" : ""
                            }`}
                          >
                            {positive && <TrendingUp className="h-3 w-3" />}
                            {negative && <TrendingDown className="h-3 w-3" />}
                            {positive ? "+" : ""}
                            {formatPercent(c.deltaPct, 2)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {priceChanges.length > 10 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                + altre {priceChanges.length - 10} variazioni minori
              </p>
            )}
          </Card>
        </motion.div>
      )}

      <Card className="card-soft p-6">
        <h3 className="font-display text-lg font-semibold">Come esportare da DEGIRO</h3>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Accedi a DEGIRO → menu Attività → Transazioni o Account</li>
          <li>Scegli intervallo date, clicca "Esporta" → CSV</li>
          <li>Carica qui il file. Riconosciamo automaticamente il tipo</li>
          <li>Le righe duplicate vengono ignorate (dedup via hash SHA-256)</li>
          <li>I prezzi vengono aggiornati e confrontati con l'import precedente</li>
        </ol>
      </Card>
    </div>
  );
}
