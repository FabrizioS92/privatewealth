import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Lock, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolioMark } from "@/components/folio-mark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Folio — Private Wealth tracker per investitori DEGIRO" },
      {
        name: "description",
        content:
          "Il tuo wealth tracker premium per portafogli DEGIRO. Importa CSV, monitora performance, dividendi e allocazione con grafici professionali.",
      },
      { property: "og:title", content: "Folio — Private Wealth tracker" },
      {
        property: "og:description",
        content:
          "Wealth tracker premium per investitori DEGIRO. Privacy-first, design luxury.",
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
    <div className="relative min-h-screen overflow-hidden">
      {/* Decorative gold orbs */}
      <div
        className="pointer-events-none absolute -left-32 top-0 h-[500px] w-[500px] rounded-full opacity-25 blur-[120px]"
        style={{ background: "var(--gradient-gold)" }}
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[400px] w-[400px] rounded-full opacity-20 blur-[100px]"
        style={{ background: "var(--gradient-gold)" }}
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <FolioMark size={40} />
          <div>
            <p className="font-serif text-xl leading-none tracking-wide">Folio</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.22em] text-gold/80">
              Private Wealth
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
            <Link to="/auth">Accedi</Link>
          </Button>
          <Button
            size="sm"
            asChild
            className="border border-gold/40 bg-transparent text-gold hover:bg-gold/10"
          >
            <Link to="/auth">
              Inizia <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-12 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-card/40 px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-gold/90 backdrop-blur">
            <span className="h-1 w-1 rounded-full bg-gold" />
            Built for serious DEGIRO investors
          </span>
          <h1 className="mt-8 font-serif text-5xl leading-[1.05] tracking-tight md:text-7xl">
            Il tuo patrimonio,
            <br />
            <span className="gold-text italic">curato come un'opera d'arte.</span>
          </h1>
          <div className="mx-auto mt-8 gold-divider w-24" />
          <p className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Importa i CSV di DEGIRO, calcola PMC e P&amp;L, traccia dividendi
            e allocazione con un'interfaccia ispirata al private banking.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              asChild
              className="rounded-full px-8 text-primary-foreground hover:opacity-95"
              style={{
                background: "var(--gradient-gold)",
                boxShadow: "var(--shadow-glow)",
              }}
            >
              <Link to="/auth">
                Inizia gratis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="rounded-full border border-border px-8 text-muted-foreground hover:text-foreground"
            >
              <Link to="/auth" search={{ demo: "1" }}>
                Esplora la demo
              </Link>
            </Button>
          </div>
        </div>

        {/* Feature cards */}
        <div className="mx-auto mt-24 max-w-md text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold/70">L'esperienza</p>
          <div className="mx-auto mt-3 gold-divider w-12" />
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Upload,
              title: "Import elegante",
              text: "Trascina Transactions.csv o Account.csv. Riconoscimento automatico, dedup intelligente.",
            },
            {
              icon: BarChart3,
              title: "Grafici raffinati",
              text: "Performance, allocazione e dividendi in un'estetica da private banking.",
            },
            {
              icon: Wallet,
              title: "PMC & P&L",
              text: "Prezzo medio di carico calcolato sulle tue transazioni reali. Niente più Excel.",
            },
            {
              icon: Lock,
              title: "Riservato",
              text: "Crittografia at rest, RLS rigorosa: i dati appartengono solo a te.",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="hover-lift glass rounded-2xl p-6 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold/30 bg-gold/5">
                  <Icon className="h-4 w-4 text-gold" />
                </div>
                <h3 className="mt-5 font-serif text-lg">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border py-10 text-center">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Folio · Private Wealth tracker
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          Non affiliato a DEGIRO · Non costituisce consulenza finanziaria
        </p>
      </footer>
    </div>
  );
}
