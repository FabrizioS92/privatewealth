import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Lock, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Folio — Wealth tracker per investitori DEGIRO" },
      {
        name: "description",
        content:
          "Importa i tuoi CSV DEGIRO, monitora portafoglio, dividendi e performance con grafici professionali. Gratis e privacy-first.",
      },
      { property: "og:title", content: "Folio — Wealth tracker per investitori DEGIRO" },
      {
        property: "og:description",
        content:
          "Importa CSV DEGIRO, monitora portafoglio, dividendi e performance con UI fintech.",
      },
    ],
  }),
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-2">
            <span className="text-lg font-bold text-primary-foreground">F</span>
          </div>
          <span className="text-lg font-semibold">Folio</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth">Accedi</Link>
          </Button>
          <Button size="sm" asChild className="bg-primary text-primary-foreground hover:opacity-90">
            <Link to="/auth">Inizia gratis</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Built for DEGIRO investors
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight md:text-6xl">
            Il tuo portafoglio{" "}
            <span className="bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent">
              senza fogli Excel
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            Importa i CSV di DEGIRO, calcola PMC e P&amp;L, traccia dividendi e
            allocazione con grafici professionali. Tutto in pochi secondi.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="bg-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90"
            >
              <Link to="/auth">
                Inizia gratis <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="ghost" asChild>
              <Link to="/auth" search={{ demo: "1" }}>
                Prova con demo
              </Link>
            </Button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Upload,
              title: "Import CSV DEGIRO",
              text: "Trascina Transactions.csv o Account.csv. Parsing automatico con dedup intelligente.",
            },
            {
              icon: BarChart3,
              title: "Grafici reali",
              text: "Performance nel tempo, allocazione per asset, dividendi mensili. Recharts + UI fintech.",
            },
            {
              icon: Wallet,
              title: "PMC & P&L",
              text: "Prezzo medio di carico calcolato sulle tue transazioni reali. Niente più fogli Excel.",
            },
            {
              icon: Lock,
              title: "Privacy-first",
              text: "I tuoi dati sono protetti con RLS: solo tu puoi vederli. Nessuna condivisione.",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Folio · Wealth tracker non affiliato a DEGIRO · Non è consulenza finanziaria
      </footer>
    </div>
  );
}
