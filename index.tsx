import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { translations, LOCALES, type Locale, type TranslationKey } from "./translations";

const STORAGE_KEY = "folio_locale";

function detectLocale(): Locale {
  // 1. Salvata in localStorage
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && translations[saved]) return saved;
  // 2. Browser language
  const lang = navigator.language.slice(0, 2) as Locale;
  if (translations[lang]) return lang;
  return "it";
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try { return detectLocale(); } catch { return "it"; }
  });

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch {}
  }, []);

  // Aggiorna l'attributo lang dell'html
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>): string => {
      const dict = translations[locale] as Record<string, string>;
      let str = dict[key] ?? (translations.it as Record<string, string>)[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export { LOCALES };
export type { Locale };
