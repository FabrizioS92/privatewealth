import Papa from "papaparse";

/**
 * DEGIRO CSV parser
 * ----------------------------------------------------------------
 * Supporta i due export principali:
 *  1. Transactions.csv  → operazioni di compravendita
 *  2. Account.csv       → estratto conto (dividendi, ritenute, fees)
 *
 * Strategia di dedup:
 *   hash = sha-256-like deterministico su (date|isin|qty|price|type)
 *   La UNIQUE (user_id, dedup_hash) sul DB blocca duplicati.
 */

export interface ParsedTransaction {
  trade_date: string; // ISO yyyy-mm-dd
  isin: string;
  ticker: string | null;
  name: string;
  exchange: string | null;
  type: "buy" | "sell";
  quantity: number;
  price: number;
  currency: string;
  fx_rate: number;
  fees: number;
  total: number;
  dedup_hash: string;
}

export interface ParsedDividend {
  pay_date: string;
  isin: string;
  ticker: string | null;
  name: string;
  amount: number;
  currency: string;
  withholding_tax: number;
  net_amount: number;
  dedup_hash: string;
}

export interface ParseResult {
  transactions: ParsedTransaction[];
  dividends: ParsedDividend[];
  errors: string[];
  detected: "transactions" | "account" | "unknown";
}

// ---------- helpers ----------

function normalizeNumber(v: string | undefined | null): number {
  if (v === undefined || v === null || v === "") return 0;
  // DEGIRO usa virgola come decimale + punto come migliaia (formato EU)
  const cleaned = String(v).trim().replace(/\./g, "").replace(",", ".").replace(/\s/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseDateDDMMYYYY(v: string): string {
  // DEGIRO format: dd-mm-yyyy
  const parts = v.trim().split(/[-/]/);
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  return `${y.padStart(4, "0")}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

async function sha256(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // fallback semplice
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h << 5) - h + input.charCodeAt(i);
  return Math.abs(h).toString(16);
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase().trim() === k.toLowerCase()) return row[rk] ?? "";
    }
  }
  return "";
}

// ---------- detector ----------

function detectFile(headers: string[]): "transactions" | "account" | "unknown" {
  const h = headers.map((x) => x.toLowerCase().trim());
  const has = (s: string) => h.some((x) => x.includes(s));
  if (has("isin") && (has("aantal") || has("quantity")) && (has("koers") || has("price"))) {
    return "transactions";
  }
  if (has("omschrijving") || has("description")) {
    return "account";
  }
  return "unknown";
}

// ---------- transactions parser ----------

async function parseTransactionRow(row: Record<string, string>): Promise<ParsedTransaction | null> {
  const dateRaw = pick(row, ["Datum", "Date"]);
  const isin = pick(row, ["ISIN"]).trim().toUpperCase();
  const name = pick(row, ["Product", "Producto"]).trim();
  const exchange = pick(row, ["Beurs", "Venue", "Exchange"]).trim() || null;
  const qtyRaw = pick(row, ["Aantal", "Quantity"]);
  const priceRaw = pick(row, ["Koers", "Price"]);
  const currency = (pick(row, ["Mutatie", "Currency"]) || "EUR").trim().toUpperCase().slice(0, 3);
  const feesRaw =
    pick(row, ["Transactiekosten en/of", "Transaction and/or third", "Fees"]) ||
    pick(row, ["Kosten", "Costs"]);
  const totalRaw = pick(row, ["Totaal", "Total"]);
  const fxRaw = pick(row, ["Wisselkoers", "FX"]);

  if (!isin || !dateRaw) return null;

  const quantity = normalizeNumber(qtyRaw);
  if (quantity === 0) return null;
  const type: "buy" | "sell" = quantity > 0 ? "buy" : "sell";
  const absQty = Math.abs(quantity);
  const price = Math.abs(normalizeNumber(priceRaw));
  const fees = Math.abs(normalizeNumber(feesRaw));
  const fx = normalizeNumber(fxRaw) || 1;
  const total = normalizeNumber(totalRaw) || (type === "buy" ? -(absQty * price + fees) : absQty * price - fees);

  const trade_date = parseDateDDMMYYYY(dateRaw) || new Date(dateRaw).toISOString().slice(0, 10);
  const dedupKey = `${trade_date}|${isin}|${absQty.toFixed(6)}|${price.toFixed(6)}|${type}`;
  const dedup_hash = await sha256(dedupKey);

  return {
    trade_date,
    isin,
    ticker: null,
    name: name || isin,
    exchange,
    type,
    quantity: absQty,
    price,
    currency,
    fx_rate: fx,
    fees,
    total,
    dedup_hash,
  };
}

// ---------- account parser (dividends) ----------

const DIV_KEYWORDS = /dividend|dividendo/i;
const TAX_KEYWORDS = /dividendbelasting|withholding|ritenuta/i;

async function parseAccountRows(rows: Record<string, string>[]): Promise<ParsedDividend[]> {
  // Raggruppa righe vicine con stesso ISIN+data: dividendo + ritenuta
  const dividends: ParsedDividend[] = [];
  // Map: isin|date -> { gross, tax, name, currency }
  const grouped = new Map<
    string,
    { gross: number; tax: number; name: string; currency: string; isin: string; date: string }
  >();

  for (const row of rows) {
    const dateRaw = pick(row, ["Datum", "Date"]);
    const desc = pick(row, ["Omschrijving", "Description"]);
    const isin = pick(row, ["ISIN"]).trim().toUpperCase();
    const name = pick(row, ["Product", "Producto"]).trim();
    const currency = (pick(row, ["Mutatie", "Currency"]) || "EUR").trim().toUpperCase().slice(0, 3);
    const amountRaw = pick(row, ["", "Bedrag", "Amount"]);
    const amount = normalizeNumber(amountRaw);

    if (!isin || !dateRaw || !desc) continue;
    if (!DIV_KEYWORDS.test(desc) && !TAX_KEYWORDS.test(desc)) continue;

    const date = parseDateDDMMYYYY(dateRaw) || new Date(dateRaw).toISOString().slice(0, 10);
    const key = `${isin}|${date}`;
    const entry = grouped.get(key) ?? {
      gross: 0,
      tax: 0,
      name: name || isin,
      currency,
      isin,
      date,
    };
    if (TAX_KEYWORDS.test(desc)) {
      entry.tax += Math.abs(amount);
    } else {
      entry.gross += Math.abs(amount);
    }
    grouped.set(key, entry);
  }

  for (const e of grouped.values()) {
    if (e.gross === 0) continue;
    const net = e.gross - e.tax;
    const dedupKey = `DIV|${e.date}|${e.isin}|${e.gross.toFixed(4)}`;
    const dedup_hash = await sha256(dedupKey);
    dividends.push({
      pay_date: e.date,
      isin: e.isin,
      ticker: null,
      name: e.name,
      amount: e.gross,
      currency: e.currency,
      withholding_tax: e.tax,
      net_amount: net,
      dedup_hash,
    });
  }

  return dividends;
}

// ---------- public API ----------

export async function parseDegiroCsv(text: string): Promise<ParseResult> {
  const result: ParseResult = {
    transactions: [],
    dividends: [],
    errors: [],
    detected: "unknown",
  };

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0) {
    result.errors.push(...parsed.errors.slice(0, 3).map((e) => e.message));
  }

  const headers = parsed.meta.fields ?? [];
  const kind = detectFile(headers);
  result.detected = kind;

  if (kind === "transactions") {
    for (const row of parsed.data) {
      try {
        const tx = await parseTransactionRow(row);
        if (tx) result.transactions.push(tx);
      } catch (e) {
        result.errors.push(String(e));
      }
    }
  } else if (kind === "account") {
    try {
      result.dividends = await parseAccountRows(parsed.data);
    } catch (e) {
      result.errors.push(String(e));
    }
  } else {
    result.errors.push(
      "Formato CSV non riconosciuto. Esporta da DEGIRO → Transactions o Account.",
    );
  }

  return result;
}

// ---------- portfolio aggregation ----------

export interface Position {
  isin: string;
  name: string;
  quantity: number;
  avg_cost: number;
  total_invested: number;
  currency: string;
}

export function computePositions(transactions: ParsedTransaction[]): Position[] {
  const map = new Map<string, Position>();
  // ordina per data asc per FIFO
  const sorted = [...transactions].sort((a, b) => a.trade_date.localeCompare(b.trade_date));

  for (const tx of sorted) {
    const cur = map.get(tx.isin) ?? {
      isin: tx.isin,
      name: tx.name,
      quantity: 0,
      avg_cost: 0,
      total_invested: 0,
      currency: tx.currency,
    };
    if (tx.type === "buy") {
      const newQty = cur.quantity + tx.quantity;
      const newInvested = cur.total_invested + tx.quantity * tx.price + tx.fees;
      cur.avg_cost = newQty > 0 ? newInvested / newQty : 0;
      cur.quantity = newQty;
      cur.total_invested = newInvested;
      cur.name = tx.name;
    } else {
      // sell — riduce quantità, mantiene PMC
      const sellQty = Math.min(tx.quantity, cur.quantity);
      cur.total_invested -= cur.avg_cost * sellQty;
      cur.quantity -= sellQty;
      if (cur.quantity <= 0.0000001) {
        cur.quantity = 0;
        cur.total_invested = 0;
      }
    }
    map.set(tx.isin, cur);
  }

  return Array.from(map.values()).filter((p) => p.quantity > 0);
}
