import { useState, type ChangeEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, Loader2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n } from "@/lib/i18n";
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
  const { t } = useI18n();
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
        toast.error(t("import_format_error"));
      } else {
        toast.success(`Riconosciuto: ${r.detected === "transactions" ? "Transactions" : "Account"}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_parsing"));
    } finally {
      setParsing(false);
      e.target.value = "";
    }
  };

  const doImport = async () => {
    if (!result || !user) return;
    setImporting(true);
    try {
      let inserted = 0;
      let skipped = 0;
      if (result.transactions.length > 0) {
        const rows = result.transactions.map((tx) => ({ ...tx, user_id: user.id }));
        const { error, count } = await supabase.from("transactions").upsert(rows, { onConflict: "user_id,dedup_hash", ignoreDuplicates: true, count: "exact" });
        if (error) throw error;
        inserted += count ?? 0;
        skipped += rows.length - (count ?? 0);
      }
      if (result.dividends.length > 0) {
        const rows = result.dividends.map((d) => ({ ...d, user_id: user.id }));
        const { error, count } = await supabase.from("dividends").upsert(rows, { onConflict: "user_id,dedup_hash", ignoreDuplicates: true, count: "exact" });
        if (error) throw error;
        inserted += count ?? 0;
        skipped += rows.length - (count ?? 0);
      }
      setImported({ inserted, skipped });
      toast.success(`${inserted} ${t("import_success", { skipped })}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("error_parsing"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{t("import_title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("import_subtitle")}</p>
      </div>

      <Card className="card-soft border-2 border-dashed border-border p-10 text-center">
        <input id="file-input" type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        <label htmlFor="file-input" className="cursor-pointer">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl" style={{ background: "var(--gradient-mint)", boxShadow: "var(--shadow-mint)" }}>
            <Upload className="h-7 w-7 text-primary-foreground" />
          </motion.div>
          <p className="mt-5 font-display text-lg font-semibold">{t("import_drag_title")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("import_drag_sub")}</p>
          <Button type="button" asChild className="mt-5">
            <span>
              {parsing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("import_btn_choose")}
            </span>
          </Button>
        </label>
      </Card>

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="card-soft p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-mint-soft text-primary-foreground">
                <FileText className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-display font-semibold capitalize">{t("import_file_label")} {result.detected}</p>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div className="rounded-2xl bg-secondary/60 p-3">
                    <p className="text-xs text-muted-foreground">{t("import_transactions_label")}</p>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{result.transactions.length}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/60 p-3">
                    <p className="text-xs text-muted-foreground">{t("import_dividends_label")}</p>
                    <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{result.dividends.length}</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <p className="mt-2 text-xs text-warning">{result.errors.length} {t("import_warnings")}</p>
                )}
                {imported ? (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl bg-mint-soft p-3 text-sm font-medium text-primary-foreground">
                    <CheckCircle2 className="h-4 w-4" />
                    {imported.inserted} {t("import_success", { skipped: imported.skipped })}
                  </div>
                ) : (
                  <Button onClick={doImport} disabled={importing || (result.transactions.length === 0 && result.dividends.length === 0)} className="mt-4">
                    {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {t("import_btn_import")}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      <Card className="card-soft p-6">
        <h3 className="font-display text-lg font-semibold">{t("import_how_title")}</h3>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>{t("import_how_1")}</li>
          <li>{t("import_how_2")}</li>
          <li>{t("import_how_3")}</li>
          <li>{t("import_how_4")}</li>
        </ol>
      </Card>
    </div>
  );
}
