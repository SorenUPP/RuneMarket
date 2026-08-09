import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";
import { generateApiToken } from "@/lib/api-tokens";

const MAX_TOKENS_PER_USER = 5;

// List the signed-in user's API tokens (metadata only, never the raw value).
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json([], { status: 401 });

  const tokens = await prisma.apiToken.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      revokedAt: true,
    },
  });

  return NextResponse.json(tokens);
}

// Create a new API token for the signed-in user, e.g. to paste into the
// RuneLite plugin's config panel. The raw token is returned exactly once;
// only its hash is persisted, so it can never be shown again after this.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const activeCount = await prisma.apiToken.count({
    where: { userId: user.id, revokedAt: null },
  });
  if (activeCount >= MAX_TOKENS_PER_USER) {
    return NextResponse.json(
      { error: `You can have at most ${MAX_TOKENS_PER_USER} active tokens. Revoke one first.` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const label =
    typeof body?.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 60)
      : "RuneLite plugin";

  const { raw, hash } = generateApiToken();

  const token = await prisma.apiToken.create({
    data: { userId: user.id, tokenHash: hash, label },
  });

  return NextResponse.json({ id: token.id, label: token.label, token: raw });
}
