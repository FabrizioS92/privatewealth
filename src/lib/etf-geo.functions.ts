import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REGION_KEYS, type RegionKey } from "@/lib/regions";

const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const JUSTETF_SOURCE = "justetf" as const;
const JUSTETF_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
};

interface ScrapedRegion {
  region: RegionKey;
  weight: number;
}

function finalizeRegions(buckets: Map<RegionKey, number>, isin: string, minTotal = 30): ScrapedRegion[] | null {
  if (buckets.size === 0) {
    console.warn("[yahoo-finance] Nessun dato geografico trovato per ISIN", isin);
    return null;
  }

  const total = [...buckets.values()].reduce((sum, value) => sum + value, 0);
  if (total < minTotal) {
    console.warn("[yahoo-finance] Totale troppo basso", total, "per ISIN", isin);
    return null;
  }

  const factor = 100 / total;
  return [...buckets.entries()].map(([region, weight]) => ({
    region,
    weight: Math.round(weight * factor * 100) / 100,
  }));
}

async function fetchYahooJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS });
    if (!res.ok) {
      console.error("Yahoo Finance request failed", res.status, await res.text());
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.error("Yahoo Finance request error", err);
    return null;
  }
}

async function resolveYahooEtf(isin: string): Promise<YahooResolvedEtf | null> {
  const url = `${YAHOO_SEARCH_URL}?q=${encodeURIComponent(isin)}&quotesCount=10&newsCount=0`;
  const json = await fetchYahooJson<YahooSearchResponse>(url);
  const quotes = json?.quotes ?? [];
  const candidates = quotes
    .filter((quote) => quote.symbol && ["ETF", "MUTUALFUND"].includes((quote.quoteType ?? "").toUpperCase()))
    .sort((a, b) => {
      const aEtf = (a.quoteType ?? "").toUpperCase() === "ETF" ? 1 : 0;
      const bEtf = (b.quoteType ?? "").toUpperCase() === "ETF" ? 1 : 0;
      return bEtf - aEtf || (b.score ?? 0) - (a.score ?? 0);
    });

  for (const quote of candidates) {
    const symbol = quote.symbol?.trim();
    if (!symbol) continue;
    const chart = await fetchYahooJson<YahooChartResponse>(
      `${YAHOO_CHART_BASE_URL}${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    );
    const meta = chart?.chart?.result?.[0]?.meta;
    if (!chart?.chart?.error && meta) {
      return {
        symbol: meta.symbol || symbol,
        name: quote.longname || quote.shortname || symbol,
      };
    }
  }

  const fallback = candidates[0];
  if (!fallback?.symbol) return null;
  return {
    symbol: fallback.symbol,
    name: fallback.longname || fallback.shortname || fallback.symbol,
  };
}

function inferByEtfProfile(isin: string, resolved: YahooResolvedEtf): ScrapedRegion[] | null {
  const haystack = `${isin} ${resolved.symbol} ${resolved.name}`;
  return PROFILE_RULES.find((rule) => rule.match.test(haystack))?.regions ?? null;
}

function regionFromYahooHoldingSymbol(symbol: string | undefined): RegionKey | null {
  const value = String(symbol ?? "").trim().toUpperCase();
  if (!value) return null;

  if (/\.(TO|V|NE|CN)$/.test(value)) return "north_america";
  if (/\.(L|SW|PA|DE|F|BE|MI|AS|MC|ST|CO|OL|BR|VI|HE|LS|IR|WA|PR)$/.test(value)) {
    return "europe_developed";
  }
  if (/\.(T|KS|KQ|TW|HK|SI|AX|NZ|IL)$/.test(value)) return "asia_developed";
  if (/\.(SS|SZ|NS|BO|SA|MX|JO|IS|BK|JK|KL|PM|VN|QA|KW|AE)$/.test(value)) {
    return "emerging_markets";
  }
  if (/^[A-Z]{1,5}$/.test(value)) return "north_america";

  return null;
}

async function fetchYahooTopHoldings(symbol: string): Promise<YahooHolding[]> {
  const url = `${YAHOO_QUOTE_SUMMARY_BASE_URL}${encodeURIComponent(symbol)}?modules=topHoldings`;
  const json = await fetchYahooJson<YahooQuoteSummaryResponse>(url);
  return json?.quoteSummary?.result?.[0]?.topHoldings?.holdings ?? [];
}

async function inferFromYahooTopHoldings(isin: string, symbol: string): Promise<ScrapedRegion[] | null> {
  const holdings = await fetchYahooTopHoldings(symbol);
  const buckets = new Map<RegionKey, number>();

  for (const holding of holdings) {
    const region = regionFromYahooHoldingSymbol(holding.symbol);
    const rawWeight = holding.holdingPercent?.raw;
    if (!region || !Number.isFinite(rawWeight) || !rawWeight || rawWeight <= 0) continue;
    buckets.set(region, (buckets.get(region) ?? 0) + rawWeight);
  }

  return finalizeRegions(buckets, isin, 0.01);
}

async function scrapeYahooFinance(isin: string): Promise<ScrapedRegion[] | null> {
  const resolved = await resolveYahooEtf(isin);
  if (!resolved) return null;

  const fromProfile = inferByEtfProfile(isin, resolved);
  if (fromProfile) return fromProfile;

  return inferFromYahooTopHoldings(isin, resolved.symbol);
}

export const fetchEtfGeoBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ isin: z.string().regex(isinRegex) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 1. Cache hit?
    const { data: existing } = await supabase
      .from("etf_geo_breakdown")
      .select("region,weight,source")
      .eq("user_id", userId)
      .eq("isin", data.isin);

    if (existing && existing.length > 0) {
      return {
        success: true as const,
        cached: true,
        source: existing[0].source as "yahoo" | "manual" | "justetf",
        breakdown: existing.map((r) => ({
          region: r.region as RegionKey,
          weight: Number(r.weight),
        })),
      };
    }

    // 2. Import da Yahoo Finance
    try {
      const scraped = await scrapeYahooFinance(data.isin);
      if (!scraped || scraped.length === 0) {
        return { success: false as const, reason: "not_found" as const };
      }

      const rows = scraped.map((r: ScrapedRegion) => ({
        user_id: userId,
        isin: data.isin,
        region: r.region,
        weight: r.weight,
        source: YAHOO_DB_SOURCE,
      }));
      const { error: insertErr } = await supabase.from("etf_geo_breakdown").insert(rows);
      if (insertErr) {
        console.error("Failed to cache breakdown", insertErr);
      }

      return {
        success: true as const,
        cached: false,
        source: "yahoo" as const,
        breakdown: scraped,
      };
    } catch (err) {
      console.error("Scrape failed", err);
      return { success: false as const, reason: "scrape_error" as const };
    }
  });

export const saveManualEtfGeoBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      isin: z.string().regex(isinRegex),
      weights: z
        .array(
          z.object({
            region: z.enum(REGION_KEYS),
            weight: z.number().min(0).max(100),
          }),
        )
        .min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const total = data.weights.reduce((s, w) => s + w.weight, 0);
    if (Math.abs(total - 100) > 1) {
      return { success: false as const, reason: "invalid_total" as const, total };
    }

    // Cancello eventuali righe esistenti e reinserisco
    await supabase.from("etf_geo_breakdown").delete().eq("user_id", userId).eq("isin", data.isin);
    const rows = data.weights
      .filter((w) => w.weight > 0)
      .map((w) => ({
        user_id: userId,
        isin: data.isin,
        region: w.region,
        weight: w.weight,
        source: "manual",
      }));
    const { error } = await supabase.from("etf_geo_breakdown").insert(rows);
    if (error) {
      return { success: false as const, reason: "insert_error" as const };
    }
    return { success: true as const };
  });
