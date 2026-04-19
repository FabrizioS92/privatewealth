import { Globe } from "lucide-react";
import { useI18n, LOCALES } from "@/lib/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const current = LOCALES.find((l) => l.code === locale)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 rounded-2xl text-muted-foreground hover:text-foreground",
            compact ? "h-8 px-2" : "h-9 px-3",
          )}
        >
          <Globe className="h-4 w-4 shrink-0" />
          {!compact && (
            <span className="text-sm font-medium">{current.flag} {current.label}</span>
          )}
          {compact && <span className="text-sm">{current.flag}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px] rounded-2xl p-1.5">
        {LOCALES.map((loc) => (
          <DropdownMenuItem
            key={loc.code}
            onClick={() => setLocale(loc.code)}
            className={cn(
              "flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm",
              locale === loc.code && "bg-primary/10 font-semibold text-primary",
            )}
          >
            <span>{loc.flag}</span>
            <span>{loc.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
