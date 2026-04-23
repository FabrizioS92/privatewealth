// Fetch adjusted-close price history from Yahoo Finance, with a CORS proxy fallback.

export interface PriceSeries {
  ticker: string;
  dates: string[]; // ISO yyyy-mm-dd
  prices: number[]; // adjusted close
}

interface YahooResponse {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
        quote?: Array<{ close?: Array<number | null> }>;
      };
    }>;
    error?: { description?: string } | null;
  };
}

const BASE = "https://query1.finance.yahoo.com/v8/finance/chart/";
const PROXY = "https://corsproxy.io/?";

async function fetchYahooRaw(url: string): Promise<YahooResponse> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as YahooResponse;
}

export async function fetchPriceSeries(
  ticker: string,
  range: string = "1y",
): Promise<PriceSeries> {
  const trimmed = ticker.trim().toUpperCase();
  const url = `${BASE}${encodeURIComponent(trimmed)}?interval=1d&range=${range}`;
  let data: YahooResponse;
  try {
    data = await fetchYahooRaw(url);
  } catch {
    // Fallback through CORS proxy
    data = await fetchYahooRaw(`${PROXY}${encodeURIComponent(url)}`);
  }

  const result = data.chart?.result?.[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    throw new Error("ETF non trovato");
  }

  const ts = result.timestamp;
  const adj = result.indicators?.adjclose?.[0]?.adjclose;
  const close = result.indicators?.quote?.[0]?.close;
  const raw = adj && adj.length === ts.length ? adj : close ?? [];

  const dates: string[] = [];
  const prices: number[] = [];
  for (let i = 0; i < ts.length; i++) {
    const p = raw[i];
    if (p == null || !Number.isFinite(p)) continue;
    dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
    prices.push(p);
  }

  if (prices.length < 2) {
    throw new Error("Dati insufficienti");
  }

  return { ticker: trimmed, dates, prices };
}

export async function fetchManySeries(tickers: string[]): Promise<PriceSeries[]> {
  const results = await Promise.allSettled(tickers.map((t) => fetchPriceSeries(t)));
  const out: PriceSeries[] = [];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") out.push(r.value);
    else errors.push(tickers[i]);
  });
  if (out.length === 0) {
    throw new Error(`Impossibile caricare: ${errors.join(", ")}`);
  }
  return out;
}
