import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getCachedItemMapping, getLatestPrices, get5MinuteVolumes } from "@/lib/osrs-api";
import { calculateMargin, calculatePotentialProfit } from "@/lib/ge-tax";
import type { ScreenerItem } from "@/app/api/items/screener/route";

interface LatestPriceEntry {
  high: number | null;
  highTime?: number;
  low: number | null;
  lowTime?: number;
}

export type WatchlistItem = ScreenerItem & {
  /** null when the item currently has no live buy/sell price on the wiki */
  hasLivePrice: boolean;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const favourites = await prisma.favourite.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });

  if (favourites.length === 0) {
    return NextResponse.json([]);
  }

  const [mapping, latest, volumes] = await Promise.all([
    getCachedItemMapping(),
    getLatestPrices(),
    get5MinuteVolumes().catch(() => null),
  ]);
  const mappingById = new Map(mapping.map((m) => [m.id, m]));
  const priceData = latest?.data as Record<string, LatestPriceEntry> | undefined;
  const volumeData = volumes?.data ?? {};
  const now = Math.floor(Date.now() / 1000);

  const results: WatchlistItem[] = favourites.map(({ item }) => {
    const meta = mappingById.get(item.id);
    const price = priceData?.[item.id];
    const buyPrice = price?.low ?? null;
    const sellPrice = price?.high ?? null;
    const hasLivePrice = buyPrice != null && sellPrice != null && buyPrice > 0 && sellPrice > 0;

    const vol = volumeData[item.id];
    const volume = vol ? vol.highPriceVolume + vol.lowPriceVolume : 0;
    const members = meta?.members ?? true;
    const lastTraded = Math.max(price?.highTime ?? 0, price?.lowTime ?? 0);
    const updatedSecondsAgo = lastTraded > 0 ? Math.max(0, now - lastTraded) : null;

    if (!hasLivePrice) {
      return {
        id: item.id,
        name: item.name,
        iconUrl: item.iconUrl,
        buyPrice: 0,
        sellPrice: 0,
        buyLimit: meta?.limit ?? null,
        tax: 0,
        grossMargin: 0,
        netProfit: 0,
        roiPercent: null,
        potentialProfit: null,
        volume,
        members,
        updatedSecondsAgo,
        flipScore: 0,
        hasLivePrice: false,
      };
    }

    const { tax, grossMargin, netProfit, roiPercent } = calculateMargin(
      buyPrice!,
      sellPrice!,
      item.id
    );
    const buyLimit = meta?.limit ?? null;
    const potentialProfit = calculatePotentialProfit(netProfit, buyLimit);

    // Same composite ranking used by the screener, so a watchlisted item's
    // flip score is directly comparable to what's shown there.
    const flipScore =
      Math.max(0, netProfit) *
      (1 + Math.min(2, (roiPercent ?? 0) / 20)) *
      Math.log10(volume + 10);

    return {
      id: item.id,
      name: item.name,
      iconUrl: item.iconUrl,
      buyPrice: buyPrice!,
      sellPrice: sellPrice!,
      buyLimit,
      tax,
      grossMargin,
      netProfit,
      roiPercent,
      potentialProfit,
      volume,
      members,
      updatedSecondsAgo,
      flipScore,
      hasLivePrice: true,
    };
  });

  return NextResponse.json(results);
}
