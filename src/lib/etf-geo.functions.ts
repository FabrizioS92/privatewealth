import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { countryToRegion, REGION_KEYS, type RegionKey } from "@/lib/regions";

const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
const JUSTETF_BASE_URL = "https://www.justetf.com/en/etf-profile.html?isin=";

interface ScrapedRegion {
  region: RegionKey;
  weight: number;
}

function normalizeCountryLabel(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function finalizeRegions(buckets: Map<RegionKey, number>, isin: string): ScrapedRegion[] | null {
  if (buckets.size === 0) {
    console.warn("[justetf] Nessun paese trovato per ISIN", isin);
    return null;
  }

  const total = [...buckets.values()].reduce((sum, value) => sum + value, 0);
  if (total < 30) {
    console.warn("[justetf] Totale troppo basso", total, "per ISIN", isin);
    return null;
  }

  const factor = 100 / total;
  return [...buckets.entries()].map(([region, weight]) => ({
    region,
    weight: Math.round(weight * factor * 100) / 100,
  }));
}

function parseCountriesTable(lines: string[], isin: string): ScrapedRegion[] | null {
  const buckets = new Map<RegionKey, number>();
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    const plainHeading = trimmed.toLowerCase();

    if (headingMatch) {
      const headingText = headingMatch[1].toLowerCase();
      if (
        headingText === "countries" ||
        headingText.startsWith("countries") ||
        headingText.includes("holdings by country") ||
        headingText.includes("country breakdown") ||
        headingText.includes("country weight")
      ) {
        inSection = true;
        continue;
      }
      if (inSection) break;
      continue;
    }

    if (!inSection && plainHeading === "countries") {
      inSection = true;
      continue;
    }

    if (!inSection || !trimmed || trimmed.toLowerCase() === "show more") continue;
    if (/^\|?\s*-{2,}/.test(trimmed)) continue;

    const match = trimmed.match(/^\|?\s*(.+?)\s*\|\s*(\d+(?:[.,]\d+)?)\s*%/);
    if (!match) continue;

    const country = normalizeCountryLabel(match[1]);
    const pct = parseFloat(match[2].replace(",", "."));
    if (!country || !Number.isFinite(pct) || pct <= 0 || pct > 100) continue;

    const normalized = country.toLowerCase();
    if (normalized === "country" || normalized === "weighting") continue;

    const region = countryToRegion(country);
    buckets.set(region, (buckets.get(region) ?? 0) + pct);
  }

  return finalizeRegions(buckets, isin);
}

function parseJustEtfHtml(html: string, isin: string): ScrapedRegion[] | null {
  const sectionMatch = html.match(/<h[1-6][^>]*>\s*Countries\s*<\/h[1-6]>([\s\S]*?)(?=<h[1-6][^>]*>)/i);
  const section = sectionMatch?.[1] ?? html;
  const rowRegex = /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>[\s\S]*?(\d+(?:[.,]\d+)?)%/gi;
  const buckets = new Map<RegionKey, number>();

  for (const match of section.matchAll(rowRegex)) {
    const country = normalizeCountryLabel(match[1] ?? "");
    const pct = parseFloat((match[2] ?? "").replace(",", "."));
    if (!country || !Number.isFinite(pct) || pct <= 0 || pct > 100) continue;

    const normalized = country.toLowerCase();
    if (normalized === "country" || normalized === "weighting") continue;

    const region = countryToRegion(country);
    buckets.set(region, (buckets.get(region) ?? 0) + pct);
  }

  return finalizeRegions(buckets, isin);
}

async function scrapeWithFirecrawl(isin: string): Promise<ScrapedRegion[] | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: `${JUSTETF_BASE_URL}${isin}`,
      formats: ["markdown"],
      onlyMainContent: true,
      waitFor: 4000,
    }),
  });

  if (!res.ok) {
    console.error("Firecrawl scrape failed", res.status, await res.text());
    return null;
  }

  const json = (await res.json()) as { data?: { markdown?: string }; markdown?: string };
  const markdown = json.data?.markdown ?? json.markdown ?? "";
  if (!markdown) return null;

  return parseCountriesTable(markdown.split("\n"), isin);
}

async function fetchJustEtfHtml(isin: string): Promise<string | null> {
  const res = await fetch(`${JUSTETF_BASE_URL}${isin}`, {
    headers: {
      "user-agent": "Mozilla/5.0",
      "accept-language": "en-US,en;q=0.9",
    },
  });

  if (!res.ok) {
    console.error("JustETF direct fetch failed", res.status, await res.text());
    return null;
  }

  return res.text();
}

async function scrapeJustEtf(isin: string): Promise<ScrapedRegion[] | null> {
  const fromFirecrawl = await scrapeWithFirecrawl(isin);
  if (fromFirecrawl && fromFirecrawl.length > 0) {
    return fromFirecrawl;
  }

  const html = await fetchJustEtfHtml(isin);
  if (!html) return null;

  return parseJustEtfHtml(html, isin);
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
        source: existing[0].source as "justetf" | "manual",
        breakdown: existing.map((r) => ({
          region: r.region as RegionKey,
          weight: Number(r.weight),
        })),
      };
    }

    // 2. Scraping JustETF
    try {
      const scraped = await scrapeJustEtf(data.isin);
      if (!scraped || scraped.length === 0) {
        return { success: false as const, reason: "not_found" as const };
      }

      const rows = scraped.map((r) => ({
        user_id: userId,
        isin: data.isin,
        region: r.region,
        weight: r.weight,
        source: "justetf",
      }));
      const { error: insertErr } = await supabase.from("etf_geo_breakdown").insert(rows);
      if (insertErr) {
        console.error("Failed to cache breakdown", insertErr);
      }

      return {
        success: true as const,
        cached: false,
        source: "justetf" as const,
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
