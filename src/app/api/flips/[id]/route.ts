import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

// Close an open flip by recording a sell price.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const { sellPrice } = await req.json();

  if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
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
