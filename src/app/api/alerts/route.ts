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

  const { itemId, direction, priceType, targetPrice } = await req.json();

  if (
    !Number.isFinite(itemId) ||
    !["above", "below"].includes(direction) ||
    !["high", "low"].includes(priceType) ||
    !Number.isFinite(targetPrice) ||
    targetPrice <= 0
  ) {
    return NextResponse.json({ error: "Invalid alert parameters" }, { status: 400 });
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
