import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedItemMapping, getLatestPrices } from "@/lib/osrs-api";
import { calculateMargin, calculatePotentialProfit } from "@/lib/ge-tax";

interface LatestPriceEntry {
  high: number | null;
  low: number | null;
}

export interface ScreenerItem {
  id: number;
  name: string;
  iconUrl: string | null;
  buyPrice: number;
  sellPrice: number;
  buyLimit: number | null;
  tax: number;
  grossMargin: number;
  netProfit: number;
  roiPercent: number | null;
  potentialProfit: number | null;
}

export async function GET() {
  const [mapping, latest] = await Promise.all([
    getCachedItemMapping(),
    getLatestPrices(),
  ]);

  const priceData = latest?.data as Record<string, LatestPriceEntry> | undefined;
  if (!priceData) {
    return NextResponse.json([]);
  }

  // Only surface items we track locally (tradeable === true), same
  // convention used by the trending/search routes.
  const localItems = await prisma.item.findMany({
    where: { tradeable: true },
    select: { id: true, iconUrl: true },
  });
  const localById = new Map(localItems.map((i) => [i.id, i]));

  const results: ScreenerItem[] = [];

  for (const meta of mapping) {
    const local = localById.get(meta.id);
    if (!local) continue;

    const price = priceData[meta.id];
    // Flipping convention: buy in at the current "low" (insta-sell) price,
    // sell out at the current "high" (insta-buy) price.
    if (!price || price.low == null || price.high == null) continue;

    const buyPrice = price.low;
    const sellPrice = price.high;
    if (buyPrice <= 0 || sellPrice <= 0) continue;

    const { tax, grossMargin, netProfit, roiPercent } = calculateMargin(
      buyPrice,
      sellPrice,
      meta.id
    );
    const buyLimit = meta.limit ?? null;
    const potentialProfit = calculatePotentialProfit(netProfit, buyLimit);

    results.push({
      id: meta.id,
      name: meta.name,
      iconUrl: local.iconUrl,
      buyPrice,
      sellPrice,
      buyLimit,
      tax,
      grossMargin,
      netProfit,
      roiPercent,
      potentialProfit,
    });
  }

  return NextResponse.json(results);
}
