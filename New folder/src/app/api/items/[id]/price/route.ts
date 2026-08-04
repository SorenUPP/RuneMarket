import { NextRequest, NextResponse } from "next/server";
import { getLatestPrices } from "@/lib/osrs-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itemId = Number(id);

  if (isNaN(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const data = await getLatestPrices();
  const price = data.data?.[itemId];

  if (!price) {
    return NextResponse.json({ error: "No price data" }, { status: 404 });
  }

  return NextResponse.json({
    itemId,
    high: price.high ?? null,
    highTime: price.highTime ?? null,
    low: price.low ?? null,
    lowTime: price.lowTime ?? null,
  });
}