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
    if (error) toast.error(error.message);
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

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      <Card className="border-border bg-card p-6">
        <h2 className="mb-4 font-semibold">Profilo</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dn">Nome visualizzato</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cur">Valuta base</Label>
            <select
              id="cur"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:opacity-90"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salva modifiche
          </Button>
        </div>
      </Card>

      <Card className="border-border bg-card p-6">
        <h2 className="font-semibold">Zona pericolo</h2>
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
