import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { FolioMark } from "@/components/folio-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Accedi — Folio" }, { name: "description", content: "Accedi al tuo wealth tracker Folio." }] }),
  validateSearch: (search: Record<string, unknown>) => ({ demo: search.demo === "1" ? "1" : undefined }),
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
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
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { display_name: displayName || email.split("@")[0] } },
        });
        if (error) throw error;
        toast.success(t("auth_success"));
        navigate({ to: "/onboarding" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("auth_error_unknown");
      if (msg.toLowerCase().includes("invalid")) toast.error(t("auth_invalid"));
      else if (msg.toLowerCase().includes("already")) { toast.error(t("auth_already_exists")); setMode("signin"); }
      else toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute left-1/2 top-1/4 h-[500px] w-[500px] -translate-x-1/2 rounded-full opacity-40 blur-[120px]" style={{ background: "var(--gradient-mint)" }} />
      {/* Language switcher top-right */}
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <FolioMark size={56} className="mx-auto" />
          <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">
            {mode === "signin" ? t("auth_title_signin") : t("auth_title_signup")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {mode === "signin" ? t("auth_subtitle_signin") : t("auth_subtitle_signup")}
          </p>
        </div>
        <Card className="card-soft p-7 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">{t("auth_name")}</Label>
                <Input id="name" type="text" placeholder="Marco Rossi" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 rounded-2xl bg-secondary/60" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">{t("auth_email")}</Label>
              <Input id="email" type="email" placeholder="tu@email.com" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-2xl bg-secondary/60" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">{t("auth_password")}</Label>
              <Input id="password" type="password" placeholder="••••••••" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-2xl bg-secondary/60" />
            </div>
            <Button type="submit" disabled={loading} className="h-12 w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? t("auth_btn_signin") : t("auth_btn_signup")}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? t("auth_no_account") : t("auth_have_account")}
            <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="font-semibold text-primary hover:underline">
              {mode === "signin" ? t("auth_register_link") : t("auth_login_link")}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
