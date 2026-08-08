// Small technical-indicator helpers, no external deps. Mirrors the style of
// the regression helpers in the prediction route: plain functions over
// number arrays, aligned 1:1 with the input series (nulls where a window
// doesn't have enough history yet).

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  if (values.length === 0) return out;
  const k = 2 / (period + 1);
  // Seed with the SMA of the first `period` values so the line doesn't
  // start biased toward the very first data point.
  let seeded = false;
  let prev = 0;
  for (let i = 0; i < values.length; i++) {
    if (!seeded) {
      if (i < period - 1) continue;
      const windowSlice = values.slice(i - period + 1, i + 1);
      prev = windowSlice.reduce((s, v) => s + v, 0) / period;
      out[i] = prev;
      seeded = true;
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

function stddevOf(values: number[], mean: number): number {
  if (values.length === 0) return 0;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function rollingStddev(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const window = values.slice(i - period + 1, i + 1);
    const mean = window.reduce((s, v) => s + v, 0) / period;
    out[i] = stddevOf(window, mean);
  }
  return out;
}

export interface BollingerPoint {
  mid: number | null;
  upper: number | null;
  lower: number | null;
}

export function bollingerBands(
  values: number[],
  period = 20,
  mult = 2
): BollingerPoint[] {
  const mids = sma(values, period);
  const stds = rollingStddev(values, period);
  return values.map((_, i) => {
    const mid = mids[i];
    const std = stds[i];
    if (mid === null || std === null) return { mid: null, upper: null, lower: null };
    return { mid, upper: mid + mult * std, lower: mid - mult * std };
  });
}

export interface MacdPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function macd(
  values: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9
): MacdPoint[] {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: (number | null)[] = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? emaFast[i]! - emaSlow[i]! : null
  );

  // EMA of the MACD line itself, skipping the leading nulls before it seeds.
  const firstValid = macdLine.findIndex((v) => v !== null);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  if (firstValid !== -1) {
    const compact = macdLine.slice(firstValid).map((v) => v as number);
    const compactSignal = ema(compact, signalPeriod);
    for (let i = 0; i < compactSignal.length; i++) {
      signalLine[firstValid + i] = compactSignal[i];
    }
  }

  return values.map((_, i) => {
    const m = macdLine[i];
    const s = signalLine[i];
    return { macd: m, signal: s, histogram: m !== null && s !== null ? m - s : null };
  });
}

// Coefficient of variation (stddev / mean) over the trailing `period` values,
// expressed as a percentage. A simple, comparable-across-items volatility score.
export function volatilityPct(values: number[], period: number): number | null {
  if (values.length < 2) return null;
  const window = values.slice(-Math.min(period, values.length));
  const mean = window.reduce((s, v) => s + v, 0) / window.length;
  if (mean === 0) return null;
  return (stddevOf(window, mean) / mean) * 100;
}

export type MacdSignal = "bullish" | "bearish" | "neutral";

// Reads the last two MACD points to detect a fresh crossover (stronger signal)
// vs. just the current histogram sign (weaker, ongoing signal).
export function macdSignalFromSeries(points: MacdPoint[]): {
  signal: MacdSignal;
  crossover: boolean;
} {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!last || last.macd === null || last.signal === null) {
    return { signal: "neutral", crossover: false };
  }
  const lastDiff = last.macd - last.signal;
  const prevDiff =
    prev && prev.macd !== null && prev.signal !== null ? prev.macd - prev.signal : null;

  const crossover = prevDiff !== null && Math.sign(prevDiff) !== Math.sign(lastDiff) && lastDiff !== 0;
  const signal: MacdSignal = lastDiff > 0 ? "bullish" : lastDiff < 0 ? "bearish" : "neutral";
  return { signal, crossover };
}
