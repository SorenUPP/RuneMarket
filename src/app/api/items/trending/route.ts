
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLatestPrices } from "@/lib/osrs-api";

// Hand-picked popular items for now — replace with real volume ranking in Phase 2/3
const TRENDING_IDS = [4151, 11832, 11834, 21015, 13652, 12006, 6585, 1215];

export async function GET() {
  const [items, latest] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: TRENDING_IDS } } }),
    getLatestPrices(),
  ]);

  const withPrices = items.map((item) => {
    const price = latest.data?.[item.id];
    return {
      id: item.id,
      name: item.name,
      iconUrl: item.iconUrl,
      high: price?.high ?? null,
      low: price?.low ?? null,
    };
  });

  return NextResponse.json(withPrices);
}