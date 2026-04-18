import { useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
        // Use upsert with ignoreDuplicates via onConflict on dedup_hash
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
        <h1 className="text-2xl font-bold md:text-3xl">Importa CSV DEGIRO</h1>
        <p className="text-sm text-muted-foreground">
          Carica <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Transactions.csv</code>{" "}
          per le operazioni o{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">Account.csv</code> per i
          dividendi.
        </p>
      </div>

      <Card className="border-2 border-dashed border-border bg-card p-10 text-center">
        <input
          id="file-input"
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="hidden"
        />
        <label htmlFor="file-input" className="cursor-pointer">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-4 font-semibold">Trascina o seleziona un file CSV</p>
          <p className="mt-1 text-xs text-muted-foreground">Max 10MB · CSV DEGIRO</p>
          <Button
            type="button"
            asChild
            className="mt-5 bg-primary text-primary-foreground hover:opacity-90"
          >
            <span>
              {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Scegli file
            </span>
          </Button>
        </label>
      </Card>

      {result && (
        <Card className="border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <FileText className="h-8 w-8 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-semibold capitalize">File: {result.detected}</p>
              <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Transazioni</p>
                  <p className="text-2xl font-bold tabular-nums">
                    {result.transactions.length}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Dividendi</p>
                  <p className="text-2xl font-bold tabular-nums">{result.dividends.length}</p>
                </div>
              </div>
              {result.errors.length > 0 && (
                <p className="mt-2 text-xs text-warning">
                  {result.errors.length} avvisi durante il parsing
                </p>
              )}
              {imported ? (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-success/15 p-3 text-sm text-success">
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
                  className="mt-4 bg-primary text-primary-foreground hover:opacity-90"
                >
                  {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Importa nel portafoglio
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card className="border-border bg-card p-5">
        <h3 className="font-semibold">Come esportare da DEGIRO</h3>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Accedi a DEGIRO → menu Attività → Transazioni o Account</li>
          <li>Scegli intervallo date, clicca "Esporta" → CSV</li>
          <li>Carica qui il file. Riconosciamo automaticamente il tipo</li>
          <li>Le righe duplicate vengono ignorate (dedup via hash SHA-256)</li>
        </ol>
      </Card>
    </div>
  );
}
