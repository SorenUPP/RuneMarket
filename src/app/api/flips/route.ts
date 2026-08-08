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

  const { itemId, quantity, buyPrice, notes } = await req.json();

  if (!Number.isFinite(itemId) || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(buyPrice) || buyPrice <= 0) {
    return NextResponse.json({ error: "Invalid flip parameters" }, { status: 400 });
  }

  const flip = await prisma.flip.create({
    data: {
      userId: user.id,
      itemId,
      quantity: Math.round(quantity),
      buyPrice: Math.round(buyPrice),
      notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 280) : null,
    },
  });

  return NextResponse.json({ ok: true, id: flip.id });
}
