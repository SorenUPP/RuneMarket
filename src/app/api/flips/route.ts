import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { calculateMargin } from "@/lib/ge-tax";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const flips = await prisma.flip.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { boughtAt: "desc" },
  });

  return NextResponse.json(
    flips.map((f) => {
      const margin =
        f.status === "closed" && f.sellPrice !== null
          ? calculateMargin(f.buyPrice, f.sellPrice, f.itemId)
          : null;

      return {
        id: f.id,
        itemId: f.itemId,
        itemName: f.item.name,
        iconUrl: f.item.iconUrl,
        quantity: f.quantity,
        buyPrice: f.buyPrice,
        sellPrice: f.sellPrice,
        status: f.status,
        boughtAt: f.boughtAt,
        soldAt: f.soldAt,
        notes: f.notes,
        netProfit: margin ? margin.netProfit * f.quantity : null,
        tax: margin ? margin.tax * f.quantity : null,
        roiPercent: margin?.roiPercent ?? null,
      };
    })
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const quantity = Number(body?.quantity);
  const buyPrice = Number(body?.buyPrice);
  const notes = body?.notes;

  if (
    !Number.isInteger(itemId) ||
    itemId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity > 2_000_000_000 || // GE buy limits never come close to this; blocks bogus P&L math
    !Number.isFinite(buyPrice) ||
    buyPrice <= 0 ||
    buyPrice > 2_147_483_647
  ) {
    return NextResponse.json({ error: "Invalid flip parameters" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const flip = await prisma.flip.create({
    data: {
      userId: user.id,
      itemId,
      quantity,
      buyPrice: Math.round(buyPrice),
      notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 280) : null,
    },
  });

  return NextResponse.json({ ok: true, id: flip.id });
}
