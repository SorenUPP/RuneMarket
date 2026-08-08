import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const alerts = await prisma.alert.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    alerts.map((a) => ({
      id: a.id,
      itemId: a.itemId,
      itemName: a.item.name,
      iconUrl: a.item.iconUrl,
      direction: a.direction,
      priceType: a.priceType,
      targetPrice: a.targetPrice,
      triggered: a.triggered,
      triggeredAt: a.triggeredAt,
      createdAt: a.createdAt,
    }))
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const direction = body?.direction;
  const priceType = body?.priceType;
  const targetPrice = Number(body?.targetPrice);

  if (
    !Number.isInteger(itemId) ||
    itemId <= 0 ||
    !["above", "below"].includes(direction) ||
    !["high", "low"].includes(priceType) ||
    !Number.isFinite(targetPrice) ||
    targetPrice <= 0 ||
    targetPrice > 2_147_483_647 // fits Postgres int4, matches the Alert.targetPrice column
  ) {
    return NextResponse.json({ error: "Invalid alert parameters" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  // Cap how many active alerts one account can hold so a single user can't
  // spam the table (and inflate the row set /api/alerts/check scans).
  const activeCount = await prisma.alert.count({ where: { userId: user.id, triggered: false } });
  if (activeCount >= 50) {
    return NextResponse.json({ error: "Alert limit reached (50 active alerts)" }, { status: 429 });
  }

  const alert = await prisma.alert.create({
    data: {
      userId: user.id,
      itemId,
      direction,
      priceType,
      targetPrice: Math.round(targetPrice),
    },
  });

  return NextResponse.json({ ok: true, id: alert.id });
}
