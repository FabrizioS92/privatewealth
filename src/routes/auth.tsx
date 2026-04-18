import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { FolioMark } from "@/components/folio-mark";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Accedi — Folio" },
      { name: "description", content: "Accedi al tuo wealth tracker Folio." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    demo: search.demo === "1" ? "1" : undefined,
  }),
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Account creato! Benvenuto su Folio.");
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      if (msg.toLowerCase().includes("invalid")) {
        toast.error("Email o password non validi");
      } else if (msg.toLowerCase().includes("already")) {
        toast.error("Account già esistente. Accedi.");
        setMode("signin");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-20 blur-[120px]"
        style={{ background: "var(--gradient-gold)" }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-10 text-center">
          <FolioMark size={56} className="mx-auto" />
          <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-gold/80">
            Private Wealth
          </p>
          <h1 className="mt-3 font-serif text-3xl tracking-tight">
            {mode === "signin" ? "Bentornato" : "Crea il tuo account"}
          </h1>
          <div className="mx-auto mt-4 gold-divider w-16" />
          <p className="mt-4 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Accedi al tuo portafoglio privato"
              : "Inizia a curare il tuo patrimonio"}
          </p>
        </div>

        <Card
          className="glass border-border p-7"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">
                  Nome
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Marco Rossi"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" variant="luxury" disabled={loading} className="w-full rounded-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Accedi" : "Crea account"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "Non hai un account? " : "Hai già un account? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-medium text-primary hover:underline"
            >
              {mode === "signin" ? "Registrati" : "Accedi"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
