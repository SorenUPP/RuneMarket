import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getLatestPrices } from "@/lib/osrs-api";

interface LatestPriceEntry {
  high: number | null;
  low: number | null;
}

/**
 * Evaluates every untriggered alert against the current OSRS GE price feed
 * and flips `triggered` on any that have crossed their target. Intended to
 * be invoked on a schedule (e.g. Vercel Cron) rather than by end users, so
 * it's guarded by CRON_SECRET when that env var is set.
 *
 * Example vercel.json entry:
 *   { "path": "/api/alerts/check", "schedule": "*\/5 * * * *" }
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Fail closed: without a configured secret this endpoint would otherwise
  // be world-writable (anyone could force-trigger alerts or hammer the
  // upstream OSRS price API on demand). Require it rather than treating an
  // unset secret as "no auth needed".
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run" },
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await prisma.alert.findMany({
    where: { triggered: false },
    include: { item: true },
  });

  if (pending.length === 0) {
    return NextResponse.json({ checked: 0, triggered: [] });
  }

  const latest = await getLatestPrices();
  const prices: Record<string, LatestPriceEntry> = latest.data ?? {};

  const newlyTriggered: { id: string; itemName: string; targetPrice: number }[] = [];

  for (const alert of pending) {
    const entry = prices[String(alert.itemId)];
    if (!entry) continue;

    const currentPrice = alert.priceType === "high" ? entry.high : entry.low;
    if (currentPrice === null || currentPrice === undefined) continue;

    const crossed =
      alert.direction === "above"
        ? currentPrice >= alert.targetPrice
        : currentPrice <= alert.targetPrice;

    if (crossed) {
      newlyTriggered.push({
        id: alert.id,
        itemName: alert.item.name,
        targetPrice: alert.targetPrice,
      });
    }
  }

  if (newlyTriggered.length > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: newlyTriggered.map((a) => a.id) } },
      data: { triggered: true, triggeredAt: new Date() },
    });
  }

  return NextResponse.json({ checked: pending.length, triggered: newlyTriggered });
}
