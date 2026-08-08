import { NextRequest, NextResponse } from "next/server";
import { getTimeseries } from "@/lib/osrs-api";
import {
  ema,
  bollingerBands,
  macd,
  macdSignalFromSeries,
  volatilityPct,
  type MacdSignal,
} from "@/lib/technicals";

interface TimeseriesPoint {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

interface DayPoint {
  day: number; // day index, 0 = oldest
  timestamp: number; // unix seconds, end of day bucket
  price: number;
  volume: number;
  ema12: number | null;
  ema26: number | null;
  bbUpper: number | null;
  bbLower: number | null;
}

// --- small regression helpers (no external deps) ---

function linreg(xs: number[], ys: number[]) {
  const n = xs.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i];
    sumY += ys[i];
    sumXY += xs[i] * ys[i];
    sumXX += xs[i] * xs[i];
  }
  const denom = n * sumXX - sumX * sumX;
  const m = denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  const k = (sumY - m * sumX) / n;

  const meanY = sumY / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const pred = m * xs[i] + k;
    ssTot += (ys[i] - meanY) ** 2;
    ssRes += (ys[i] - pred) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);
  return { m, k, r2 };
}

// Fits y = a*x^2 + b*x + c via least squares (3x3 normal equations, Gaussian elimination)
function quadreg(xs: number[], ys: number[]) {
  const n = xs.length;
  let s0 = n, s1 = 0, s2 = 0, s3 = 0, s4 = 0, sy0 = 0, sy1 = 0, sy2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], y = ys[i];
    const x2 = x * x;
    s1 += x; s2 += x2; s3 += x2 * x; s4 += x2 * x2;
    sy0 += y; sy1 += x * y; sy2 += x2 * y;
  }
  // Matrix [[s4,s3,s2],[s3,s2,s1],[s2,s1,s0]] * [a,b,c]^T = [sy2,sy1,sy0]^T
  const A = [
    [s4, s3, s2, sy2],
    [s3, s2, s1, sy1],
    [s2, s1, s0, sy0],
  ];
  // Gaussian elimination
  for (let i = 0; i < 3; i++) {
    let pivot = A[i][i];
    if (Math.abs(pivot) < 1e-9) pivot = 1e-9;
    for (let j = i; j < 4; j++) A[i][j] /= pivot;
    for (let r = 0; r < 3; r++) {
      if (r === i) continue;
      const factor = A[r][i];
      for (let j = i; j < 4; j++) A[r][j] -= factor * A[i][j];
    }
  }
  return { a: A[0][3], b: A[1][3], c: A[2][3] };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itemId = Number(id);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const futureDays = Math.min(
    14,
    Math.max(1, Number(req.nextUrl.searchParams.get("days") ?? 7))
  );

  // 6h timestep gives ~75 days of history - plenty to aggregate into daily buckets
  const res = await getTimeseries(itemId, "6h");
  const raw: TimeseriesPoint[] = res.data ?? [];

  // Aggregate into daily buckets: avg price per day, total volume per day
  const buckets = new Map<number, { prices: number[]; volume: number; ts: number }>();
  const DAY = 86400;
  for (const p of raw) {
    const price =
      p.avgHighPrice != null && p.avgLowPrice != null
        ? (p.avgHighPrice + p.avgLowPrice) / 2
        : p.avgHighPrice ?? p.avgLowPrice;
    if (price == null) continue;
    const dayKey = Math.floor(p.timestamp / DAY);
    const vol = (p.highPriceVolume ?? 0) + (p.lowPriceVolume ?? 0);
    const bucket = buckets.get(dayKey) ?? { prices: [], volume: 0, ts: p.timestamp };
    bucket.prices.push(price);
    bucket.volume += vol;
    bucket.ts = Math.max(bucket.ts, p.timestamp);
    buckets.set(dayKey, bucket);
  }

  const sortedDays = [...buckets.keys()].sort((a, b) => a - b);
  const dailyPrices = sortedDays.map((dayKey) => {
    const b = buckets.get(dayKey)!;
    return b.prices.reduce((s, v) => s + v, 0) / b.prices.length;
  });

  // Technical indicators computed over the whole daily price series so each
  // point lines up with its corresponding day (nulls until a window fills).
  const ema12Series = ema(dailyPrices, 12);
  const ema26Series = ema(dailyPrices, 26);
  const bbSeries = bollingerBands(dailyPrices, 20, 2);
  const macdSeries = macd(dailyPrices, 12, 26, 9);

  const daily: DayPoint[] = sortedDays.map((dayKey, i) => {
    const b = buckets.get(dayKey)!;
    return {
      day: i,
      timestamp: b.ts,
      price: dailyPrices[i],
      volume: b.volume,
      ema12: ema12Series[i],
      ema26: ema26Series[i],
      bbUpper: bbSeries[i].upper,
      bbLower: bbSeries[i].lower,
    };
  });

  if (daily.length < 5) {
    return NextResponse.json({
      historical: daily,
      predicted: [],
      meta: { insufficientData: true },
    });
  }

  const dayIdx = daily.map((d) => d.day);
  const prices = daily.map((d) => d.price);
  const volumes = daily.map((d) => d.volume);

  // How volume (sales activity) is accelerating over time: volume(t) = a*t^2 + b*t + c
  const volFit = quadreg(dayIdx, volumes);
  // Historical relationship between sales volume and price for this item
  const priceOnVolume = linreg(volumes, prices);
  // Plain price-over-time drift, as a fallback when volume doesn't explain price well
  const priceOnTime = linreg(dayIdx, prices);

  const lastDay = daily[daily.length - 1];
  const lastActualPrice = lastDay.price;
  const secondsPerDay = DAY;

  // Model value at the last known day, used to anchor predictions so the
  // forecast starts exactly where the real data ends (no visual jump).
  const volumeAt = (t: number) => Math.max(0, volFit.a * t * t + volFit.b * t + volFit.c);
  const modelPriceAt = (t: number) => {
    const v = volumeAt(t);
    const fromVolume = priceOnVolume.m * v + priceOnVolume.k;
    const fromTrend = priceOnTime.m * t + priceOnTime.k;
    // Weight the volume-driven estimate by how well volume actually explains
    // price historically (r2); otherwise lean on the simple time trend.
    return priceOnVolume.r2 * fromVolume + (1 - priceOnVolume.r2) * fromTrend;
  };
  const anchorOffset = lastActualPrice - modelPriceAt(lastDay.day);

  // Volatility (coefficient of variation over the trailing 14 days) drives a
  // widening confidence band on the forecast: a random-walk-style assumption
  // that uncertainty grows with sqrt(days ahead), scaled by how noisy this
  // item's price actually is.
  const vol14 = volatilityPct(prices, 14) ?? 0;

  const predicted = [];
  for (let i = 1; i <= futureDays; i++) {
    const t = lastDay.day + i;
    const price = Math.max(0, modelPriceAt(t) + anchorOffset);
    const band = price * (vol14 / 100) * Math.sqrt(i);
    predicted.push({
      day: t,
      timestamp: lastDay.timestamp + i * secondsPerDay,
      price,
      priceUpper: price + band,
      priceLower: Math.max(0, price - band),
      projectedVolume: Math.round(volumeAt(t)),
    });
  }

  const accelerationPerDay2 = volFit.a * 2; // items/day^2 - the "sales acceleration"
  const priceAtEnd = predicted[predicted.length - 1]?.price ?? lastActualPrice;
  const pctChange =
    lastActualPrice === 0 ? 0 : ((priceAtEnd - lastActualPrice) / lastActualPrice) * 100;

  const { signal: macdSignal, crossover: macdCrossover } = macdSignalFromSeries(macdSeries);

  return NextResponse.json({
    historical: daily,
    predicted,
    meta: {
      accelerationPerDay2: Math.round(accelerationPerDay2),
      salesDirection:
        accelerationPerDay2 > 1 ? "accelerating" : accelerationPerDay2 < -1 ? "decelerating" : "steady",
      confidence: Math.round(priceOnVolume.r2 * 100), // how well volume explains price historically
      projectedChangePct: pctChange,
      horizonDays: futureDays,
      volatilityPct: Math.round(vol14 * 10) / 10,
      macdSignal: macdSignal as MacdSignal,
      macdCrossover,
    },
  });
}
