import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, BarChart3, Lock, Sparkles, Upload, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolioMark } from "@/components/folio-mark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/welcome")({
  head: () => ({
    meta: [
      { title: "Folio — Portfolio tracker per investitori DEGIRO" },
      {
        name: "description",
        content:
          "Importa CSV DEGIRO, monitora portafoglio, performance e dividendi. Design moderno, dati al sicuro.",
      },
      { property: "og:title", content: "Folio — Portfolio tracker" },
      {
        property: "og:description",
        content:
          "Wealth tracker semplice e bello per investitori DEGIRO. Privacy-first.",
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
      {/* Soft pastel orbs */}
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-[500px] w-[500px] rounded-full opacity-60 blur-[120px]"
        style={{ background: "var(--gradient-mint)" }}
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/3 h-[400px] w-[400px] rounded-full opacity-40 blur-[100px]"
        style={{ background: "var(--gradient-card-coral)" }}
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-6 md:py-6">
        <div className="flex items-center gap-2.5">
          <FolioMark size={40} />
          <p className="font-display text-xl font-semibold tracking-tight">Folio</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/auth" search={{}}>Accedi</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/auth" search={{}}>
              Inizia <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-20 pt-10 md:px-6 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-[11px] font-semibold text-primary shadow-[var(--shadow-soft)]">
            <Sparkles className="h-3 w-3" />
            Per investitori DEGIRO
          </span>
          <h1 className="mt-7 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
            Investi
            <br />
            <span className="relative inline-block">
              <span
                className="absolute inset-x-0 bottom-2 h-3 rounded-full opacity-60 md:bottom-3 md:h-4"
                style={{ background: "var(--gradient-mint)" }}
              />
              <span className="relative">con chiarezza.</span>
            </span>
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            Importa i CSV DEGIRO, calcola PMC e P&amp;L, traccia dividendi
            con un'interfaccia pensata per essere usata davvero.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="h-12 px-7 text-base">
              <Link to="/auth">
                Inizia gratis <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="h-12 px-7 text-base">
              <Link to="/auth" search={{ demo: "1" }}>
                Esplora la demo
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Visual mockup card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <div className="card-soft rounded-[32px] p-6 md:p-8">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card-ink rounded-2xl p-5">
                <p className="text-xs text-white/70">Portafoglio</p>
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums">€48.230</p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-mint/30 px-2 py-0.5 text-[11px] font-semibold">
                  +12,4%
                </p>
              </div>
              <div className="rounded-2xl bg-mint-soft p-5 text-primary-foreground">
                <p className="text-xs opacity-70">Dividendi</p>
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums">€842</p>
                <p className="mt-2 text-[11px] opacity-70">12 mesi</p>
              </div>
              <div className="rounded-2xl bg-peach p-5 text-ink">
                <p className="text-xs opacity-70">Posizioni</p>
                <p className="mt-2 font-display text-2xl font-semibold tabular-nums">14</p>
                <p className="mt-2 text-[11px] opacity-70">in 4 mercati</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Features */}
        <div className="mt-20 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Upload,
              title: "Import semplice",
              text: "Trascina Transactions.csv. Riconoscimento automatico, dedup intelligente.",
              tone: "bg-mint-soft text-primary-foreground",
            },
            {
              icon: BarChart3,
              title: "Grafici chiari",
              text: "Performance, allocazione e dividendi visualizzati con cura.",
              tone: "bg-peach text-ink",
            },
            {
              icon: Wallet,
              title: "PMC & P&L",
              text: "Prezzo medio di carico calcolato sulle tue transazioni reali.",
              tone: "bg-lavender text-ink",
            },
            {
              icon: Lock,
              title: "Privato",
              text: "Crittografia at rest, RLS rigorosa: i dati sono solo tuoi.",
              tone: "bg-card text-foreground",
            },
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="card-soft hover-lift rounded-3xl p-6"
              >
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${f.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
              </motion.div>
            );
          })}
        </div>
      </section>

      <footer className="relative z-10 py-10 text-center">
        <p className="text-xs text-muted-foreground">
          Folio · Portfolio tracker · Non affiliato a DEGIRO
        </p>
      </footer>
    </div>
  );
}
