import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { IMPORT_NOTES_PREFIX } from "@/lib/import-validation";

const MAX_QUANTITY = 2_000_000_000;
const MAX_PRICE = 2_147_483_647;

/**
 * PATCH does double duty, distinguished by which fields are sent:
 *   - { sellPrice }                  -> closes an open flip (unchanged behavior)
 *   - { buyPrice? , quantity? }      -> edits an open flip in place, without closing it
 *
 * The edit path exists ONLY for rows created via "Import existing
 * holdings" (see /api/flips/import), where buyPrice starts out as a
 * rough estimate — the user needs a way to correct it later without
 * deleting and re-importing the row. It is deliberately scoped to rows
 * tagged with IMPORT_NOTES_PREFIX so it can't be used to silently rewrite
 * the buyPrice/quantity of a flip that was logged live by the RuneLite
 * plugin (that data reflects an actual GE offer and shouldn't be
 * editable from the UI). If in-place editing of live-synced flips is
 * ever wanted, it should be a separate, explicit decision — not a side
 * effect of this route.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (body?.sellPrice !== undefined) {
    const sellPrice = Number(body.sellPrice);

    if (!Number.isFinite(sellPrice) || sellPrice <= 0 || sellPrice > MAX_PRICE) {
      return NextResponse.json({ error: "Invalid sell price" }, { status: 400 });
    }

    const result = await prisma.flip.updateMany({
      where: { id, userId: user.id, status: "open" },
      data: { sellPrice: Math.round(sellPrice), status: "closed", soldAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Flip not found or already closed" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  }

  // Edit-only path: at least one of buyPrice/quantity must be present and valid.
  const data: { buyPrice?: number; quantity?: number } = {};

  if (body?.buyPrice !== undefined) {
    const buyPrice = Number(body.buyPrice);
    if (!Number.isFinite(buyPrice) || buyPrice <= 0 || buyPrice > MAX_PRICE) {
      return NextResponse.json({ error: "Invalid buy price" }, { status: 400 });
    }
    data.buyPrice = Math.round(buyPrice);
  }

  if (body?.quantity !== undefined) {
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }
    data.quantity = quantity;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const result = await prisma.flip.updateMany({
    where: {
      id,
      userId: user.id,
      status: "open",
      notes: { startsWith: IMPORT_NOTES_PREFIX },
    },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Flip not found, already closed, or not editable (only imported rows can be edited in place)" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  await prisma.flip.deleteMany({ where: { id, userId: user.id } });

  return NextResponse.json({ ok: true });
}

