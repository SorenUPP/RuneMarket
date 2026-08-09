import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateApiToken } from "@/lib/api-tokens";

const MAX_TOKENS_PER_USER = 5;

/**
 * Third step of the device flow. Polled by the plugin every few seconds
 * (see pollIntervalSeconds from /api/device/start) with no auth of its
 * own — the code itself, high-entropy and single-use, is the credential
 * here. Mirrors the token limit already enforced in POST /api/tokens.
 *
 * Responses:
 *   { status: "pending" }              - not approved yet, keep polling
 *   { status: "expired" }              - code timed out, plugin should restart the flow
 *   { status: "approved", token: ... } - real API token, save it and stop polling
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  const deviceCode = await prisma.deviceCode.findUnique({ where: { code } });

  if (!deviceCode) {
    return NextResponse.json({ status: "expired" });
  }
  if (deviceCode.expiresAt < new Date() && deviceCode.status !== "approved") {
    return NextResponse.json({ status: "expired" });
  }
  if (deviceCode.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }
  if (deviceCode.status === "consumed") {
    // Already exchanged once (e.g. a duplicate poll in flight) — don't hand out a second token.
    return NextResponse.json({ status: "expired" });
  }

  // status === "approved" -> mint a real token, same as the manual flow in POST /api/tokens.
  const userId = deviceCode.userId!;

  const activeCount = await prisma.apiToken.count({
    where: { userId, revokedAt: null },
  });
  if (activeCount >= MAX_TOKENS_PER_USER) {
    await prisma.deviceCode.update({ where: { code }, data: { status: "consumed" } });
    return NextResponse.json(
      { status: "error", error: `You already have ${MAX_TOKENS_PER_USER} active tokens. Revoke one on your profile page first.` },
      { status: 400 }
    );
  }

  const { raw, hash } = generateApiToken();

  await prisma.$transaction([
    prisma.apiToken.create({
      data: { userId, tokenHash: hash, label: "RuneLite plugin (device flow)" },
    }),
    prisma.deviceCode.update({ where: { code }, data: { status: "consumed" } }),
  ]);

  return NextResponse.json({ status: "approved", token: raw });
}
