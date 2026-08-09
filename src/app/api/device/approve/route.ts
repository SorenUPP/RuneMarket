import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createClient } from "@/lib/supabase/server";

/**
 * Second step of the device flow. Called from the /connect page in the
 * user's browser after they click "Approve RuneLite" — this is a normal
 * cookie-authenticated request, so we know exactly which user is
 * approving. Marks the code as approved; the plugin picks it up on its
 * next poll and exchanges it for a real API token.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : null;
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const deviceCode = await prisma.deviceCode.findUnique({ where: { code } });

  if (!deviceCode || deviceCode.status !== "pending") {
    return NextResponse.json(
      { error: "This connection request is invalid or already used." },
      { status: 400 }
    );
  }
  if (deviceCode.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This connection request has expired. Go back to RuneLite and try again." },
      { status: 400 }
    );
  }

  await prisma.deviceCode.update({
    where: { code },
    data: { status: "approved", userId: user.id, approvedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
