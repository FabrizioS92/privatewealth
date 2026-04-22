import type { Position } from "@/lib/degiro-parser";

// ISIN: i primi 2 caratteri sono il codice ISO 3166-1 alpha-2 del paese di emissione
export interface GeoSlice {
  code: string; // codice ISO (es. "US", "IE", "DE")
  name: string; // nome paese localizzato
  flag: string; // emoji bandiera
  value: number; // valore di mercato in base currency
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "Stati Uniti",
  IE: "Irlanda",
  LU: "Lussemburgo",
  DE: "Germania",
  FR: "Francia",
  IT: "Italia",
  GB: "Regno Unito",
  NL: "Paesi Bassi",
  CH: "Svizzera",
  ES: "Spagna",
  BE: "Belgio",
  AT: "Austria",
  PT: "Portogallo",
  SE: "Svezia",
  NO: "Norvegia",
  DK: "Danimarca",
  FI: "Finlandia",
  CA: "Canada",
  JP: "Giappone",
  CN: "Cina",
  HK: "Hong Kong",
  KR: "Corea del Sud",
  IN: "India",
  AU: "Australia",
  BR: "Brasile",
  MX: "Messico",
  ZA: "Sudafrica",
  SG: "Singapore",
  KY: "Isole Cayman",
  BM: "Bermuda",
  JE: "Jersey",
  GG: "Guernsey",
  IM: "Isola di Man",
  IL: "Israele",
};

function codeToFlag(code: string): string {
  if (code.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  const chars = [...code.toUpperCase()].map((c) =>
    String.fromCodePoint(A + (c.charCodeAt(0) - a)),
  );
  return chars.join("");
}

export function computeGeoAllocation(
  positions: Position[],
  prices: Record<string, number>,
): GeoSlice[] {
  const buckets = new Map<string, number>();
  for (const p of positions) {
    if (p.quantity <= 0) continue;
    const code = (p.isin ?? "").slice(0, 2).toUpperCase();
    const value = p.quantity * (prices[p.isin] ?? p.avg_cost);
    if (!code || code.length !== 2 || !/^[A-Z]{2}$/.test(code)) {
      buckets.set("??", (buckets.get("??") ?? 0) + value);
      continue;
    }
    buckets.set(code, (buckets.get(code) ?? 0) + value);
  }
  return [...buckets.entries()]
    .map(([code, value]) => ({
      code,
      value,
      name: code === "??" ? "Sconosciuto" : (COUNTRY_NAMES[code] ?? code),
      flag: code === "??" ? "🏳️" : codeToFlag(code),
    }))
    .sort((a, b) => b.value - a.value);
}
