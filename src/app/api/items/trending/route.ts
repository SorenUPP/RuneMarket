
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLatestPrices } from "@/lib/osrs-api";

// How many items to show in the "highest selling" strip.
const LIMIT = 20;
// Look at more candidates than LIMIT since not every id from the wiki's
// price feed has a matching row in our Item table (untradeable/unmapped ids).
const CANDIDATE_POOL = 80;

interface LatestPriceEntry {
  high: number | null;
  low: number | null;
}

export async function GET() {
  const latest = await getLatestPrices();
  const data = latest?.data as Record<string, LatestPriceEntry> | undefined;

  if (!data) {
    return NextResponse.json([]);
  }

  // Rank every priced item by its current high (insta-buy/sell) price,
  // highest first — this is what "highest selling items" means on the GE.
  const rankedIds = Object.entries(data)
    .filter(([, price]) => typeof price?.high === "number")
    .sort((a, b) => (b[1].high ?? 0) - (a[1].high ?? 0))
    .slice(0, CANDIDATE_POOL)
    .map(([id]) => Number(id));

  const items = await prisma.item.findMany({
    where: { id: { in: rankedIds }, tradeable: true },
  });
  const itemById = new Map(items.map((item) => [item.id, item]));

  const topSellers = rankedIds
    .map((id) => {
      const item = itemById.get(id);
      if (!item) return null;
      const price = data[id];
      return {
        id: item.id,
        name: item.name,
        iconUrl: item.iconUrl,
        high: price?.high ?? null,
        low: price?.low ?? null,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .slice(0, LIMIT);

  return NextResponse.json(topSellers);
}