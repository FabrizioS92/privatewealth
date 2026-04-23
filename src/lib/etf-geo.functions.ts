import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { countryToRegion, REGION_KEYS, type RegionKey } from "@/lib/regions";

const isinRegex = /^[A-Z]{2}[A-Z0-9]{9}\d$/;

interface ScrapedRegion {
  region: RegionKey;
  weight: number;
}

async function scrapeJustEtf(isin: string): Promise<ScrapedRegion[] | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY non configurata");

  const url = `https://www.justetf.com/en/etf-profile.html?isin=${isin}`;
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
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
  const md = json.data?.markdown ?? json.markdown ?? "";
  if (!md) return null;

  // JustETF rende la composizione geografica in una sezione che si chiama
  // "Countries" (heading "### Countries") seguita da una tabella markdown:
  //   | United States | 66.27% |
  //   | Japan         |  5.94% |
  //   | Other         | 21.20% |
  // La sezione termina al successivo heading (es. "### Sectors").
  const buckets = new Map<RegionKey, number>();
  const lines = md.split("\n");
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);

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
      // Qualunque altro heading chiude la sezione corrente
      if (inSection) break;
      continue;
    }

    if (!inSection) continue;

    // Salto separatori di tabella markdown (| --- | --- |)
    if (/^\|?\s*-{2,}/.test(trimmed)) continue;

    // Riga tabella: "| Country | xx.xx% |" oppure "Country | xx.xx%"
    const match = trimmed.match(/^\|?\s*([A-Za-z][A-Za-z .&'-]+?)\s*\|\s*(\d+(?:[.,]\d+)?)\s*%/);
    if (!match) continue;

    const country = match[1].trim();
    const pct = parseFloat(match[2].replace(",", "."));
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) continue;
    if (country.toLowerCase() === "country" || country.toLowerCase() === "weighting") continue;

    const region = countryToRegion(country);
    buckets.set(region, (buckets.get(region) ?? 0) + pct);
  }

  if (buckets.size === 0) {
    console.warn("[justetf] Nessun paese trovato nel markdown per ISIN", isin);
    return null;
  }

  // Normalizzo in modo che la somma sia 100 (JustETF tipicamente mostra
  // i top paesi + "Other" che sommati fanno ~100)
  const total = [...buckets.values()].reduce((s, v) => s + v, 0);
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
