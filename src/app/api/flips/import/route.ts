import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth-token";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  MAX_ITEMS_PER_IMPORT,
  IMPORT_NOTES_PREFIX,
  buildImportNotes,
  parseLine,
  type ImportLine,
} from "@/lib/import-validation";

// Re-exported so existing call sites (other routes, tests) importing
// these from this route module keep working.
export { IMPORT_NOTES_PREFIX, buildImportNotes, parseLine };

/**
 * One-time backfill endpoint used to seed the portfolio with items the
 * player already held before they started tracking. Device approval only
 * binds a user to a fresh API token (see /api/device/poll) — it never
 * touches the player's current bank/inventory. Without this route, items
 * already held before connecting would never appear in the portfolio,
 * since /api/flips/sync only logs GE offers that complete *after* the
 * plugin is connected.
 *
 * Each imported row is created as an open flip with an estimated
 * buyPrice (real acquisition price is unknown for pre-existing holdings).
 * The `notes` field carries both a human-readable tag (so the UI can show
 * the "Imported" badge) and a batch id, so a whole import can be undone
 * in one action via POST /api/flips/import/undo without needing a schema
 * migration to add a dedicated batchId column.
 *
 * Supports two callers, via the shared getUserIdFromRequest helper:
 *   - The RuneLite plugin, authenticated with a personal API token
 *     (Bearer header), same as /api/flips/sync.
 *   - The website's own "Import existing holdings" UI on /portfolio,
 *     authenticated with the normal Supabase cookie session — so a user
 *     can backfill manually without needing the plugin at all.
 */

// A user backfilling their bank has no reason to call this more than a
// handful of times in a row; this mainly guards against a buggy/hammering
// client (plugin retry loop) or a stolen token being used to spam writes.
const IMPORT_RATE_LIMIT = 10;
const IMPORT_RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`flips-import:${userId}`, IMPORT_RATE_LIMIT, IMPORT_RATE_WINDOW_MS);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many import requests, please slow down." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const rawItems = body?.items;

  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }
  if (rawItems.length > MAX_ITEMS_PER_IMPORT) {
    return NextResponse.json(
      { error: `Too many items in one import (max ${MAX_ITEMS_PER_IMPORT})` },
      { status: 400 }
    );
  }

  const parsed = rawItems.map(parseLine);
  if (parsed.some((line) => line === null)) {
    return NextResponse.json({ error: "Invalid item entry in import" }, { status: 400 });
  }
  const lines = parsed as ImportLine[];

  // Skip items that don't exist in our catalog rather than failing the
  // whole import — a stale/unrecognized item shouldn't block everything
  // else the player is holding.
  const itemIds = [...new Set(lines.map((l) => l.itemId))];
  const knownItems = await prisma.item.findMany({
    where: { id: { in: itemIds } },
    select: { id: true },
  });
  const knownIds = new Set(knownItems.map((i) => i.id));
  const importable = lines.filter((l) => knownIds.has(l.itemId));

  if (importable.length === 0) {
    return NextResponse.json({ error: "None of the provided items were recognized" }, { status: 400 });
  }

  // Avoid re-importing the same holdings if the plugin retries or the
  // user reconnects — only skip items that already have an open,
  // previously-imported flip for this user.
  const existingImported = await prisma.flip.findMany({
    where: { userId, status: "open", notes: { startsWith: IMPORT_NOTES_PREFIX } },
    select: { itemId: true },
  });
  const alreadyImported = new Set(existingImported.map((f) => f.itemId));
  const toCreate = importable.filter((l) => !alreadyImported.has(l.itemId));

  if (toCreate.length === 0) {
    return NextResponse.json({
      ok: true,
      imported: 0,
      skipped: importable.length,
      unrecognized: lines.length - importable.length,
      batchId: null,
    });
  }

  // One batch id per call, embedded in every row's notes, so the whole
  // import can be undone together (see /api/flips/import/undo).
  const batchId = randomBytes(8).toString("hex");
  const notes = buildImportNotes(batchId);

  const result = await prisma.flip.createMany({
    data: toCreate.map((l) => ({
      userId,
      itemId: l.itemId,
      quantity: l.quantity,
      buyPrice: Math.round(l.estimatedPrice),
      notes,
    })),
  });

  return NextResponse.json({
    ok: true,
    imported: result.count,
    skipped: importable.length - toCreate.length,
    unrecognized: lines.length - importable.length,
    batchId,
  });
}
