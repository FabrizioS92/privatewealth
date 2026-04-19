import { useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseDegiroCsv, type ParseResult } from "@/lib/degiro-parser";

export const Route = createFileRoute("/_app/import")({
  head: () => ({ meta: [{ title: "Importa CSV — Folio" }] }),
  component: ImportPage,
});

function ImportPage() {
  const { user } = useAuth();
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<{ inserted: number; skipped: number } | null>(null);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParsing(true);
    setResult(null);
    setImported(null);
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
      toast.error(err instanceof Error ? err.message : "Errore parsing");
    } finally {
      setParsing(false);
    }
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

      setImported({ inserted, skipped });
      toast.success(`${inserted} righe importate · ${skipped} duplicate ignorate`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore import");
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
          DEGIRO.
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

      <Card className="card-soft p-6">
        <h3 className="font-display text-lg font-semibold">Come esportare da DEGIRO</h3>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Accedi a DEGIRO → menu Attività → Transazioni o Account</li>
          <li>Scegli intervallo date, clicca "Esporta" → CSV</li>
          <li>Carica qui il file. Riconosciamo automaticamente il tipo</li>
          <li>Le righe duplicate vengono ignorate (dedup via hash SHA-256)</li>
        </ol>
      </Card>
    </div>
  );
}
