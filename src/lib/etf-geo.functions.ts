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
    console.warn("[justetf] Nessun dato geografico trovato per ISIN", isin);
    return null;
  }

  const total = [...buckets.values()].reduce((sum, value) => sum + value, 0);
  if (total < minTotal) {
    console.warn("[justetf] Totale troppo basso", total, "per ISIN", isin);
    return null;
  }

  const factor = 100 / total;
  return [...buckets.entries()].map(([region, weight]) => ({
    region,
    weight: Math.round(weight * factor * 100) / 100,
  }));
}

const COUNTRY_TO_REGION: Record<string, RegionKey> = {
  "stati uniti": "north_america",
  "united states": "north_america",
  "usa": "north_america",
  "canada": "north_america",
  "giappone": "asia_developed",
  "japan": "asia_developed",
  "australia": "asia_developed",
  "hong kong": "asia_developed",
  "singapore": "asia_developed",
  "nuova zelanda": "asia_developed",
  "new zealand": "asia_developed",
  "regno unito": "europe_developed",
  "united kingdom": "europe_developed",
  "gran bretagna": "europe_developed",
  "germania": "europe_developed",
  "germany": "europe_developed",
  "francia": "europe_developed",
  "france": "europe_developed",
  "svizzera": "europe_developed",
  "switzerland": "europe_developed",
  "paesi bassi": "europe_developed",
  "netherlands": "europe_developed",
  "olanda": "europe_developed",
  "italia": "europe_developed",
  "italy": "europe_developed",
  "spagna": "europe_developed",
  "spain": "europe_developed",
  "svezia": "europe_developed",
  "sweden": "europe_developed",
  "danimarca": "europe_developed",
  "denmark": "europe_developed",
  "finlandia": "europe_developed",
  "finland": "europe_developed",
  "norvegia": "europe_developed",
  "norway": "europe_developed",
  "belgio": "europe_developed",
  "belgium": "europe_developed",
  "austria": "europe_developed",
  "irlanda": "europe_developed",
  "ireland": "europe_developed",
  "portogallo": "europe_developed",
  "portugal": "europe_developed",
  "cina": "emerging_markets",
  "china": "emerging_markets",
  "india": "emerging_markets",
  "taiwan": "emerging_markets",
  "corea del sud": "emerging_markets",
  "south korea": "emerging_markets",
  "brasile": "emerging_markets",
  "brazil": "emerging_markets",
  "messico": "emerging_markets",
  "mexico": "emerging_markets",
  "sudafrica": "emerging_markets",
  "south africa": "emerging_markets",
  "arabia saudita": "emerging_markets",
  "saudi arabia": "emerging_markets",
  "indonesia": "emerging_markets",
  "thailandia": "emerging_markets",
  "thailand": "emerging_markets",
  "malesia": "emerging_markets",
  "malaysia": "emerging_markets",
  "altri": "other",
  "altro": "other",
  "other": "other",
  "others": "other",
};

function cleanText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function countryKey(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePercent(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function addCountryToBuckets(buckets: Map<RegionKey, number>, country: string, weight: number) {
  const region = COUNTRY_TO_REGION[countryKey(country)];
  if (!region) return;
  buckets.set(region, (buckets.get(region) ?? 0) + weight);
}

function parseJustEtfCountries(content: string, isin: string): ScrapedRegion[] | null {
  const buckets = new Map<RegionKey, number>();
  const rowRegex = /<tr[^>]*data-testid=["']etf-holdings_countries_row["'][^>]*>(.*?)<\/tr>/gis;

  for (const rowMatch of content.matchAll(rowRegex)) {
    const row = rowMatch[1] ?? "";
    const name = row.match(/data-testid=["']tl_etf-holdings_countries_value_name["'][^>]*>(.*?)<\/td>/is)?.[1];
    const pct = row.match(/data-testid=["']tl_etf-holdings_countries_value_percentage["'][^>]*>\s*([\d.,]+)\s*%/is)?.[1];
    const weight = pct ? parsePercent(pct) : null;
    if (name && weight) addCountryToBuckets(buckets, name, weight);
  }

  if (buckets.size === 0) {
    const plainText = cleanText(content);
    const textRegex = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' .-]{2,}?)\s+(\d{1,3}(?:[,.]\d+)?)\s*%/g;
    for (const match of plainText.matchAll(textRegex)) {
      const weight = parsePercent(match[2] ?? "");
      if (match[1] && weight) addCountryToBuckets(buckets, match[1], weight);
    }
  }

  return finalizeRegions(buckets, isin, 30);
}

async function fetchJustEtfPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: JUSTETF_HEADERS, redirect: "follow" });
    if (!res.ok) return null;
    const text = await res.text();
    return text.includes("etf-holdings_countries") || text.includes("Paesi") || text.includes("Countries")
      ? text
      : null;
  } catch (err) {
    console.error("JustETF request error", err);
    return null;
  }
}

async function scrapeJustEtf(isin: string): Promise<ScrapedRegion[] | null> {
  const profilePaths = [
    `https://www.justetf.com/it/etf-profile.html?isin=${encodeURIComponent(isin)}`,
    `https://www.justetf.com/en/etf-profile.html?isin=${encodeURIComponent(isin)}`,
  ];

  for (const url of profilePaths) {
    const html = await fetchJustEtfPage(url);
    if (!html) continue;
    const parsed = parseJustEtfCountries(html, isin);
    if (parsed?.length) return parsed;
  }

  for (const url of profilePaths) {
    const readerUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, "")}`;
    const markdown = await fetchJustEtfPage(readerUrl);
    if (!markdown) continue;
    const parsed = parseJustEtfCountries(markdown, isin);
    if (parsed?.length) return parsed;
  }

  return null;
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

    // 2. Import da JustETF, leggendo la tabella Paesi come nel sito.
    try {
      const scraped = await scrapeJustEtf(data.isin);
      if (!scraped || scraped.length === 0) {
        return { success: false as const, reason: "not_found" as const };
      }

      const rows = scraped.map((r: ScrapedRegion) => ({
        user_id: userId,
        isin: data.isin,
        region: r.region,
        weight: r.weight,
        source: JUSTETF_SOURCE,
      }));
      const { error: insertErr } = await supabase.from("etf_geo_breakdown").insert(rows);
      if (insertErr) {
        console.error("Failed to cache breakdown", insertErr);
      }

      return {
        success: true as const,
        cached: false,
        source: JUSTETF_SOURCE,
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
