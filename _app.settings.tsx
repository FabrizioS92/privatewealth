import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useI18n, LOCALES } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Impostazioni — Folio" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const { t, locale, setLocale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("EUR");

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name,base_currency")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name ?? "");
        setCurrency(data.base_currency ?? "EUR");
      }
      setLoading(false);
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, display_name: displayName, base_currency: currency },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t("settings_profile_updated"));
  };

  const wipeData = async () => {
    if (!user) return;
    if (!confirm(t("settings_wipe_confirm"))) return;
    const [{ error: e1 }, { error: e2 }, { error: e3 }] = await Promise.all([
      supabase.from("transactions").delete().eq("user_id", user.id),
      supabase.from("dividends").delete().eq("user_id", user.id),
      supabase.from("manual_prices").delete().eq("user_id", user.id),
    ]);
    if (e1 ?? e2 ?? e3) {
      toast.error(t("settings_wipe_error") + (e1 ?? e2 ?? e3)!.message);
    } else {
      toast.success(t("settings_wipe_success"));
    }
  };

  if (loading) return <Skeleton className="h-64 rounded-3xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          {t("settings_title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <Card className="card-soft p-6 md:p-7">
        <h2 className="mb-4 font-display text-lg font-semibold">{t("settings_profile_section")}</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dn" className="text-xs font-medium text-muted-foreground">
              {t("settings_display_name")}
            </Label>
            <Input
              id="dn"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="h-11 rounded-2xl bg-secondary/60"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur" className="text-xs font-medium text-muted-foreground">
              {t("settings_base_currency")}
            </Label>
            <select
              id="cur"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-11 w-full rounded-2xl border border-input bg-secondary/60 px-3 text-sm"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("settings_btn_save")}
          </Button>
        </div>
      </Card>

      {/* Language selector */}
      <Card className="card-soft p-6 md:p-7">
        <h2 className="mb-4 font-display text-lg font-semibold">{t("settings_language")}</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {LOCALES.map((loc) => (
            <button
              key={loc.code}
              onClick={() => setLocale(loc.code)}
              className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm font-medium transition-all ${
                locale === loc.code
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/40 text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <span className="text-base">{loc.flag}</span>
              <span>{loc.label}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="card-soft p-6 md:p-7">
        <h2 className="font-display text-lg font-semibold">{t("settings_danger_title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings_danger_desc")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={signOut}>{t("settings_btn_signout")}</Button>
          <Button variant="destructive" onClick={wipeData}>{t("settings_btn_wipe")}</Button>
        </div>
      </Card>
    </div>
  );
}
