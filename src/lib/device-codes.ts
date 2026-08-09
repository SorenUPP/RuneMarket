import { randomBytes } from "crypto";

/**
 * Device-flow codes used by the RuneLite plugin to connect without the
 * user copy-pasting a token. The plugin opens the user's browser to
 * `/connect?code=...`; once the logged-in user clicks "Approve" there,
 * the plugin (which has been polling in the background) exchanges the
 * same code for a real API token.
 *
 * The code is intentionally long and random rather than a short
 * human-typed one — it's never typed by hand, only carried in a URL and
 * polled by the plugin, so there's no UX cost to giving it enough
 * entropy that it can't be guessed during its lifetime.
 */

export const DEVICE_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const DEVICE_CODE_POLL_INTERVAL_SECONDS = 3;

export function generateDeviceCode(): string {
  return randomBytes(20).toString("base64url"); // ~27 chars, URL-safe
}

export function deviceCodeExpiry(): Date {
  return new Date(Date.now() + DEVICE_CODE_TTL_MS);
}
