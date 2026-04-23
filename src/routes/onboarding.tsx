import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Benvenuto — Folio" }] }),
  component: OnboardingPage,
});

const STEPS = [
  {
    icon: Sparkles,
    title: "Benvenuto su Folio 👋",
    text: "Il tuo wealth tracker per portafogli DEGIRO. Segui 3 step per iniziare.",
  },
  {
    icon: Upload,
    title: "Importa il tuo CSV",
    text: "Esporta Transactions.csv da DEGIRO e caricalo. Riconoscimento automatico, dedup intelligente.",
  },
  {
    icon: BarChart3,
    title: "Esplora la dashboard",
    text: "Vedi PMC, P&L, allocazione e dividendi con grafici professionali.",
  },
] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loadingDemo, setLoadingDemo] = useState(false);

  const next = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else navigate({ to: "/import" });
  };

  const loadDemo = async () => {
    if (!user) return;
    setLoadingDemo(true);
    try {
      const today = new Date();
      const daysAgo = (n: number) => {
        const d = new Date(today);
        d.setDate(d.getDate() - n);
        return d.toISOString().slice(0, 10);
      };

      const enc = (s: string) => {
        // simple deterministic hash for demo dedup keys
        let h = 0;
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        return `demo-${Math.abs(h).toString(16)}`;
      };

      const demoTx = [
        { date: daysAgo(180), isin: "IE00B4L5Y983", name: "iShares Core MSCI World", qty: 25, price: 80 },
        { date: daysAgo(120), isin: "IE00B5BMR087", name: "iShares S&P 500", qty: 10, price: 420 },
        { date: daysAgo(90), isin: "US0378331005", name: "Apple Inc.", qty: 8, price: 175 },
        { date: daysAgo(60), isin: "US5949181045", name: "Microsoft Corp.", qty: 5, price: 380 },
        { date: daysAgo(30), isin: "IE00B4L5Y983", name: "iShares Core MSCI World", qty: 15, price: 85 },
      ].map((t) => ({
        user_id: user.id,
        trade_date: t.date,
        isin: t.isin,
        name: t.name,
        type: "buy" as const,
        quantity: t.qty,
        price: t.price,
        currency: "EUR",
        fees: 2,
        total: -(t.qty * t.price + 2),
        dedup_hash: enc(`${t.date}|${t.isin}|${t.qty}|${t.price}`),
        source: "demo",
      }));

      const demoDiv = [
        { date: daysAgo(45), isin: "US0378331005", name: "Apple Inc.", gross: 1.92, tax: 0.29 },
        { date: daysAgo(15), isin: "US5949181045", name: "Microsoft Corp.", gross: 3.75, tax: 0.56 },
      ].map((d) => ({
        user_id: user.id,
        pay_date: d.date,
        isin: d.isin,
        name: d.name,
        amount: d.gross,
        currency: "EUR",
        withholding_tax: d.tax,
        net_amount: d.gross - d.tax,
        dedup_hash: enc(`DIV|${d.date}|${d.isin}|${d.gross}`),
        source: "demo",
      }));

      const demoPrices = [
        { isin: "IE00B4L5Y983", price: 92.5 },
        { isin: "IE00B5BMR087", price: 470 },
        { isin: "US0378331005", price: 195 },
        { isin: "US5949181045", price: 415 },
      ].map((p) => ({ user_id: user.id, isin: p.isin, price: p.price, currency: "EUR" }));

      await Promise.all([
        supabase.from("transactions").upsert(demoTx, {
          onConflict: "user_id,dedup_hash",
          ignoreDuplicates: true,
        }),
        supabase.from("dividends").upsert(demoDiv, {
          onConflict: "user_id,dedup_hash",
          ignoreDuplicates: true,
        }),
        supabase.from("manual_prices").upsert(demoPrices, { onConflict: "user_id,isin" }),
      ]);

      toast.success("Dati demo caricati!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(friendlyError(err, "Impossibile caricare i dati demo."));
    } finally {
      setLoadingDemo(false);
    }
  };

  const Current = STEPS[step];
  const Icon = Current.icon;

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]"
        style={{ background: "var(--gradient-mint)" }}
      />
      <div className="relative z-10 w-full max-w-md">
        <Card className="card-soft p-8 md:p-10">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "var(--gradient-mint)", boxShadow: "var(--shadow-mint)" }}
          >
            <Icon className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="mt-6 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
              Step {step + 1} / {STEPS.length}
            </p>
            <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {Current.title}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{Current.text}</p>
          </div>

          <div className="mt-6 flex justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-[3px] rounded-full transition-all duration-500 ${
                  i === step ? "w-10 bg-primary" : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="mt-7 space-y-2">
            <Button onClick={next} className="w-full">
              {step < STEPS.length - 1 ? "Avanti" : "Importa CSV"}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
            {step === 0 && (
              <Button
                onClick={loadDemo}
                disabled={loadingDemo}
                variant="outline"
                className="w-full"
              >
                {loadingDemo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Esplora con dati demo
              </Button>
            )}
            {step > 0 && (
              <Button asChild variant="ghost" className="w-full text-muted-foreground">
                <Link to="/dashboard">Salta tour</Link>
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
