
import { NextRequest, NextResponse } from "next/server";
import { getTimeseries } from "@/lib/osrs-api";

interface TimeseriesPoint {
  timestamp: number;
  avgHighPrice: number | null;
  avgLowPrice: number | null;
  highPriceVolume: number;
  lowPriceVolume: number;
}

function calcPctChange(points: TimeseriesPoint[]): number | null {
  const valid = points.filter((p) => p.avgHighPrice !== null);
  if (valid.length < 2) return null;
  const first = valid[0].avgHighPrice!;
  const last = valid[valid.length - 1].avgHighPrice!;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

function sumVolume(points: TimeseriesPoint[]): number {
  return points.reduce(
    (sum, p) => sum + (p.highPriceVolume ?? 0) + (p.lowPriceVolume ?? 0),
    0
  );
}

// Coefficient of variation (stddev / mean) of the 24h price series, as a
// percentage — a simple, comparable measure of how choppy an item's price
// has been, independent of its absolute gp value.
function calcVolatility(points: TimeseriesPoint[]): number | null {
  const values = points
    .map((p) => p.avgHighPrice)
    .filter((v): v is number => v !== null && v > 0);
  if (values.length < 2) return null;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  if (mean === 0) return null;

  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  return (stddev / mean) * 100;
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

  // 5m timestep ≈ last 24h, 1h ≈ last ~12 days, 6h ≈ last ~75 days
  const [h24, d7, d30] = await Promise.all([
    getTimeseries(itemId, "5m"),
    getTimeseries(itemId, "1h"),
    getTimeseries(itemId, "6h"),
  ]);

  const points24h: TimeseriesPoint[] = h24.data ?? [];
  const points7d: TimeseriesPoint[] = d7.data ?? [];
  const points30d: TimeseriesPoint[] = d30.data ?? [];

  return NextResponse.json({
    change24h: calcPctChange(points24h),
    change7d: calcPctChange(points7d),
    change30d: calcPctChange(points30d),
    volume24h: sumVolume(points24h),
    volatility24h: calcVolatility(points24h),
  });
}