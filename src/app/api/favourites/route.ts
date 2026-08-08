import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const favourites = await prisma.favourite.findMany({
    where: { userId: user.id },
    include: { item: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    favourites.map((f) => ({
      id: f.item.id,
      name: f.item.name,
      iconUrl: f.item.iconUrl,
    }))
  );
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const itemId = Number(body?.itemId);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  // Confirm the item actually exists before writing a favourite for it —
  // without this check a bad/forged itemId hits the FK constraint and
  // surfaces as an unhandled 500 instead of a clean 404.
  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  await prisma.favourite.upsert({
    where: { userId_itemId: { userId: user.id, itemId } },
    create: { userId: user.id, itemId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}