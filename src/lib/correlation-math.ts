// Pure math utilities for portfolio correlation analysis.

export interface RollingPoint {
  date: string;
  value: number;
}

/** Convert a price series into log returns. Skips non-positive values. */
export function logReturns(prices: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const prev = prices[i - 1];
    const curr = prices[i];
    if (prev > 0 && curr > 0 && Number.isFinite(prev) && Number.isFinite(curr)) {
      out.push(Math.log(curr / prev));
    } else {
      out.push(0);
    }
  }
  return out;
}

/** Truncate two arrays to their shared (shortest) length, aligned to the right. */
export function alignSeries(a: number[], b: number[]): [number[], number[]] {
  const n = Math.min(a.length, b.length);
  return [a.slice(a.length - n), b.slice(b.length - n)];
}

/** Pearson correlation in [-1, +1]. Returns 0 when degenerate. */
export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += x[i];
    sy += y[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (den === 0 || !Number.isFinite(den)) return 0;
  return Math.max(-1, Math.min(1, num / den));
}

/** Rolling Pearson correlation over a window. */
export function rollingCorrelation(
  x: number[],
  y: number[],
  dates: string[],
  window = 60,
): RollingPoint[] {
  const n = Math.min(x.length, y.length, dates.length);
  if (n < window) return [];
  const out: RollingPoint[] = [];
  for (let i = window; i <= n; i++) {
    const wx = x.slice(i - window, i);
    const wy = y.slice(i - window, i);
    out.push({ date: dates[i - 1], value: pearson(wx, wy) });
  }
  return out;
}

/** Standard normal CDF via Abramowitz & Stegun 7.1.26 approximation. */
function normalCDF(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const p =
    d *
    t *
    (0.319381530 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
}

/** Two-sided t-test for Pearson correlation. Returns p-value. */
export function correlationPValue(r: number, n: number): number {
  if (n < 3) return 1;
  const rr = Math.min(0.999999, Math.max(-0.999999, r));
  const t = (rr * Math.sqrt(n - 2)) / Math.sqrt(1 - rr * rr);
  const p = 2 * (1 - normalCDF(Math.abs(t)));
  return Math.max(0, Math.min(1, p));
}

export type CorrelationLabel = "molto-simili" | "simili" | "indipendenti" | "opposti-lievi" | "opposti";

export function labelFor(r: number): CorrelationLabel {
  if (r >= 0.7) return "molto-simili";
  if (r >= 0.4) return "simili";
  if (r > -0.1) return "indipendenti";
  if (r >= -0.4) return "opposti-lievi";
  return "opposti";
}

export function labelText(r: number): string {
  switch (labelFor(r)) {
    case "molto-simili":
      return "Molto simili";
    case "simili":
      return "Simili";
    case "indipendenti":
      return "Indipendenti";
    case "opposti-lievi":
      return "Lievemente opposti";
    case "opposti":
      return "Opposti";
  }
}

/** Average of off-diagonal correlations from a square matrix. */
export function averageOffDiagonal(matrix: number[][]): number {
  const n = matrix.length;
  if (n < 2) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sum += matrix[i][j];
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}
