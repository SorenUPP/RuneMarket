import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedItemMapping, getLatestPrices, get5MinuteVolumes } from "@/lib/osrs-api";
import { calculateMargin, calculatePotentialProfit } from "@/lib/ge-tax";

interface LatestPriceEntry {
  high: number | null;
  highTime?: number;
  low: number | null;
  lowTime?: number;
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
  volume: number;
  members: boolean;
  updatedSecondsAgo: number | null;
  flipScore: number;
}

export async function GET() {
  const [mapping, latest, volumes] = await Promise.all([
    getCachedItemMapping(),
    getLatestPrices(),
    get5MinuteVolumes().catch(() => null),
  ]);

  const priceData = latest?.data as Record<string, LatestPriceEntry> | undefined;
  if (!priceData) {
    return NextResponse.json([]);
  }
  const volumeData = volumes?.data ?? {};
  const now = Math.floor(Date.now() / 1000);

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

    const vol = volumeData[meta.id];
    const volume = vol ? vol.highPriceVolume + vol.lowPriceVolume : 0;

    const lastTraded = Math.max(price.highTime ?? 0, price.lowTime ?? 0);
    const updatedSecondsAgo = lastTraded > 0 ? Math.max(0, now - lastTraded) : null;

    // A simple composite ranking that rewards margin, ROI, and liquidity
    // together, so a huge-margin item nobody is trading doesn't outrank a
    // smaller but genuinely flippable one. Volume is log-scaled since raw
    // trade counts span several orders of magnitude across items.
    const flipScore =
      Math.max(0, netProfit) *
      (1 + Math.min(2, (roiPercent ?? 0) / 20)) *
      Math.log10(volume + 10);

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
      volume,
      members: meta.members ?? true,
      updatedSecondsAgo,
      flipScore,
    });
  }

  return NextResponse.json(results);
}
