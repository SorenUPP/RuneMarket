import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  generateDeviceCode,
  deviceCodeExpiry,
  DEVICE_CODE_POLL_INTERVAL_SECONDS,
} from "@/lib/device-codes";

/**
 * First step of the plugin's "Connect to RuneMarket" device flow. Called
 * by the RuneLite plugin, not by the browser — no session required, since
 * the plugin has no cookies yet. Returns a code and the URL the plugin
 * should open in the user's default browser.
 */

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://runemarket.vercel.app";

export async function POST() {
  const code = generateDeviceCode();

  await prisma.deviceCode.create({
    data: {
      code,
      status: "pending",
      expiresAt: deviceCodeExpiry(),
    },
  });

  return NextResponse.json({
    code,
    connectUrl: `${APP_URL}/connect?code=${code}`,
    pollIntervalSeconds: DEVICE_CODE_POLL_INTERVAL_SECONDS,
  });
}
