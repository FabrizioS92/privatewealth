import { Link, useLocation } from "@tanstack/react-router";
import { Home, PieChart, ArrowLeftRight, Coins, Upload, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FolioMark } from "@/components/folio-mark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/portfolio", label: "Portafoglio", icon: PieChart },
  { to: "/transactions", label: "Movimenti", icon: ArrowLeftRight },
  { to: "/dividends", label: "Dividendi", icon: Coins },
  { to: "/import", label: "Import", icon: Upload },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar/80 backdrop-blur-xl md:flex">
        <div className="flex h-20 items-center gap-3 border-b border-border px-6">
          <FolioMark size={40} />
          <div>
            <p className="font-serif text-lg leading-none tracking-wide">Folio</p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-gold/80">
              Private Wealth
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-300",
                  active
                    ? "bg-gradient-to-r from-primary/15 via-primary/5 to-transparent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/40 hover:text-foreground",
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-[2px] -translate-y-1/2 rounded-r bg-gradient-to-b from-transparent via-gold to-transparent" />
                )}
                <Icon
                  className={cn(
                    "h-4 w-4 transition-colors",
                    active ? "text-gold" : "group-hover:text-gold/80",
                  )}
                />
                <span className="tracking-wide">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="mb-2 px-3 py-2">
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Impostazioni
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="mt-1 w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/70 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <FolioMark size={32} />
          <div>
            <p className="font-serif text-base leading-none">Folio</p>
            <p className="mt-0.5 text-[8px] uppercase tracking-[0.18em] text-gold/80">
              Private Wealth
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* Main content */}
      <main className="md:ml-64 md:pb-0 pb-24">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t border-border bg-background/85 px-1 pt-1.5 pb-2 backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[10px] font-medium tracking-wide transition-colors",
                active ? "text-gold" : "text-muted-foreground",
              )}
            >
              {active && (
                <span className="absolute -top-1.5 h-[2px] w-6 rounded-full bg-gold" />
              )}
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
