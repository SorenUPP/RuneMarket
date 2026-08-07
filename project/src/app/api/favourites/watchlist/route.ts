import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { getCachedItemMapping, getLatestPrices } from "@/lib/osrs-api";
import { calculateMargin, calculatePotentialProfit } from "@/lib/ge-tax";
import type { ScreenerItem } from "@/app/api/items/screener/route";

interface LatestPriceEntry {
  high: number | null;
  low: number | null;
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

  const [mapping, latest] = await Promise.all([
    getCachedItemMapping(),
    getLatestPrices(),
  ]);
  const mappingById = new Map(mapping.map((m) => [m.id, m]));
  const priceData = latest?.data as Record<string, LatestPriceEntry> | undefined;

  const results: WatchlistItem[] = favourites.map(({ item }) => {
    const meta = mappingById.get(item.id);
    const price = priceData?.[item.id];
    const buyPrice = price?.low ?? null;
    const sellPrice = price?.high ?? null;
    const hasLivePrice = buyPrice != null && sellPrice != null && buyPrice > 0 && sellPrice > 0;

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
      hasLivePrice: true,
    };
  });

  return NextResponse.json(results);
}
