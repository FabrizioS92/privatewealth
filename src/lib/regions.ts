export const REGION_KEYS = [
  "north_america",
  "europe_developed",
  "asia_developed",
  "emerging_markets",
  "other",
] as const;

export type RegionKey = (typeof REGION_KEYS)[number];

export const REGION_LABELS: Record<RegionKey, string> = {
  north_america: "Nord America",
  europe_developed: "Europa Sviluppata",
  asia_developed: "Asia Sviluppata",
  emerging_markets: "Mercati Emergenti",
  other: "Altro",
};

export const REGION_FLAGS: Record<RegionKey, string> = {
  north_america: "🌎",
  europe_developed: "🇪🇺",
  asia_developed: "🌏",
  emerging_markets: "🌍",
  other: "🏳️",
};

export interface RegionWeight {
  region: RegionKey;
  weight: number; // 0..100
}

// Mappa paese -> macro-regione (per parsing JustETF "Holdings by country")
const COUNTRY_TO_REGION: Record<string, RegionKey> = {
  // Nord America
  "united states": "north_america",
  usa: "north_america",
  "u.s.a.": "north_america",
  us: "north_america",
  canada: "north_america",
  // Europa sviluppata
  "united kingdom": "europe_developed",
  uk: "europe_developed",
  "great britain": "europe_developed",
  germany: "europe_developed",
  france: "europe_developed",
  switzerland: "europe_developed",
  netherlands: "europe_developed",
  italy: "europe_developed",
  spain: "europe_developed",
  sweden: "europe_developed",
  denmark: "europe_developed",
  norway: "europe_developed",
  finland: "europe_developed",
  belgium: "europe_developed",
  ireland: "europe_developed",
  austria: "europe_developed",
  portugal: "europe_developed",
  luxembourg: "europe_developed",
  // Asia sviluppata
  japan: "asia_developed",
  "south korea": "asia_developed",
  korea: "asia_developed",
  "hong kong": "asia_developed",
  singapore: "asia_developed",
  taiwan: "asia_developed",
  australia: "asia_developed",
  "new zealand": "asia_developed",
  israel: "asia_developed",
  // Emergenti
  china: "emerging_markets",
  india: "emerging_markets",
  brazil: "emerging_markets",
  mexico: "emerging_markets",
  "south africa": "emerging_markets",
  russia: "emerging_markets",
  turkey: "emerging_markets",
  thailand: "emerging_markets",
  indonesia: "emerging_markets",
  malaysia: "emerging_markets",
  philippines: "emerging_markets",
  vietnam: "emerging_markets",
  poland: "emerging_markets",
  "czech republic": "emerging_markets",
  hungary: "emerging_markets",
  chile: "emerging_markets",
  colombia: "emerging_markets",
  peru: "emerging_markets",
  egypt: "emerging_markets",
  "saudi arabia": "emerging_markets",
  uae: "emerging_markets",
  qatar: "emerging_markets",
};

export function countryToRegion(country: string): RegionKey {
  const key = country.trim().toLowerCase();
  return COUNTRY_TO_REGION[key] ?? "other";
}
