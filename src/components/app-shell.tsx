import { Link, useLocation } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Home, PieChart, ArrowLeftRight, Coins, Upload, Settings, LogOut, BarChart2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FolioMark } from "@/components/folio-mark";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/portfolio", label: "Portafoglio", icon: PieChart },
  { to: "/transactions", label: "Movimenti", icon: ArrowLeftRight },
  { to: "/dividends", label: "Dividendi", icon: Coins },
  { to: "/correlation", label: "Correlazione", icon: BarChart2 },
  { to: "/import", label: "Import", icon: Upload },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar/90 backdrop-blur-xl md:flex">
        <div className="flex h-20 items-center gap-3 px-6">
          <FolioMark size={40} />
          <div>
            <p className="font-display text-xl font-semibold leading-none tracking-tight">
              Folio
            </p>
            <p className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground">
              Portfolio tracker
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item, i) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.to);
            return (
              <motion.div
                key={item.to}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
              >
                <Link
                  to={item.to}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-all duration-300",
                    active
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-mint)]"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 transition-transform",
                      active ? "" : "group-hover:scale-110",
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              </motion.div>
            );
          })}
        </nav>

        <div className="p-3">
          <div className="mb-2 rounded-2xl bg-secondary/60 p-3">
            <p className="truncate text-xs font-medium text-muted-foreground">{user?.email}</p>
          </div>
          <Link
            to="/settings"
            className="flex items-center gap-3 rounded-2xl px-3.5 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
            Impostazioni
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={signOut}
            className="mt-1 w-full justify-start gap-3 rounded-2xl text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2.5">
          <FolioMark size={32} />
          <p className="font-display text-lg font-semibold leading-none tracking-tight">Folio</p>
        </div>
        <Button variant="ghost" size="icon" onClick={signOut} className="h-9 w-9">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      {/* Main content */}
      <main className="md:ml-64 md:pb-0 pb-24">
        <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-3 left-3 right-3 z-30 grid grid-cols-6 rounded-3xl border border-border bg-card/95 p-1.5 shadow-[var(--shadow-elevated)] backdrop-blur-xl md:hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = location.pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-2xl py-2 text-[10px] font-semibold transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-mint)]"
                  : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
