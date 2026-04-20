/**
 * Formatters per UI fintech.
 */

function normalizeCurrencyCode(currency?: string): string {
  const code = currency?.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code ?? "") ? code! : "EUR";
}

export function formatCurrency(
  value: number,
  currency: string = "EUR",
  options: Intl.NumberFormatOptions = {},
): string {
  if (!Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: normalizeCurrencyCode(currency),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    }).format(value);
  }
}

export function formatCompactCurrency(value: number, currency: string = "EUR"): string {
  if (!Number.isFinite(value)) return "—";

  try {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: normalizeCurrencyCode(currency),
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
}

export function formatPercent(value: number, fractionDigits: number = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "percent",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatNumber(value: number, fractionDigits: number = 2): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatShortDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "short",
  }).format(d);
}
