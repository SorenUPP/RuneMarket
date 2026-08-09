import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromApiToken } from "@/lib/auth-token";

/**
 * Machine-to-machine counterpart of /api/flips and /api/flips/[id], used
 * by the RuneLite plugin to log Grand Exchange offers as they complete.
 * Authenticated with a personal API token (see /api/tokens) instead of a
 * Supabase cookie session, since a Java client can't hold browser cookies.
 *
 * POST  -> opens a flip from a completed buy offer, returns its id so the
 *          plugin can remember which GE slot maps to which flip.
 * PATCH -> closes an open flip from a completed sell offer.
 */

const MAX_QUANTITY = 2_000_000_000; // GE buy limits never come close to this
const MAX_PRICE = 2_147_483_647;

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromApiToken(req);
  if (!userId) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const quantity = Number(body?.quantity);
  const buyPrice = Number(body?.buyPrice);

  if (
    !Number.isInteger(itemId) ||
    itemId <= 0 ||
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    quantity > MAX_QUANTITY ||
    !Number.isFinite(buyPrice) ||
    buyPrice <= 0 ||
    buyPrice > MAX_PRICE
  ) {
    return NextResponse.json({ error: "Invalid flip parameters" }, { status: 400 });
  }

  const item = await prisma.item.findUnique({ where: { id: itemId }, select: { id: true } });
  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const flip = await prisma.flip.create({
    data: {
      userId,
      itemId,
      quantity,
      buyPrice: Math.round(buyPrice),
      notes: "Logged automatically from RuneLite",
    },
  });

  return NextResponse.json({ ok: true, id: flip.id });
}

export async function PATCH(req: NextRequest) {
  const userId = await getUserIdFromApiToken(req);
  if (!userId) return NextResponse.json({ error: "Invalid or missing API token" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = body?.id;
  const sellPrice = Number(body?.sellPrice);

  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Missing flip id" }, { status: 400 });
  }
  if (!Number.isFinite(sellPrice) || sellPrice <= 0 || sellPrice > MAX_PRICE) {
    return NextResponse.json({ error: "Invalid sell price" }, { status: 400 });
  }

  const result = await prisma.flip.updateMany({
    where: { id, userId, status: "open" },
    data: { sellPrice: Math.round(sellPrice), status: "closed", soldAt: new Date() },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Flip not found or already closed" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
