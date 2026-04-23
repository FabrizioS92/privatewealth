import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { friendlyError } from "@/lib/error-handler";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Impostazioni — Folio" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
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
      .update({ display_name: displayName, base_currency: currency })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error(friendlyError(error, "Impossibile aggiornare il profilo."));
    else toast.success("Profilo aggiornato");
  };

  const wipeData = async () => {
    if (!user) return;
    if (!confirm("Eliminare tutti i tuoi dati (transazioni, dividendi, prezzi)? Irreversibile."))
      return;
    await Promise.all([
      supabase.from("transactions").delete().eq("user_id", user.id),
      supabase.from("dividends").delete().eq("user_id", user.id),
      supabase.from("manual_prices").delete().eq("user_id", user.id),
    ]);
    toast.success("Dati eliminati");
  };

  if (loading) return <Skeleton className="h-64 rounded-3xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
          Impostazioni
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <Card className="card-soft p-6 md:p-7">
        <h2 className="mb-4 font-display text-lg font-semibold">Profilo</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dn" className="text-xs font-medium text-muted-foreground">
              Nome visualizzato
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
              Valuta base
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
            Salva modifiche
          </Button>
        </div>
      </Card>

      <Card className="card-soft p-6 md:p-7">
        <h2 className="font-display text-lg font-semibold">Zona pericolo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Elimina tutti i dati o esci dall'account.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={signOut}>
            Esci
          </Button>
          <Button variant="destructive" onClick={wipeData}>
            Elimina tutti i dati
          </Button>
        </div>
      </Card>
    </div>
  );
}
