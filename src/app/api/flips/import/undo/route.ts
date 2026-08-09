import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth-token";
import { checkRateLimit } from "@/lib/rate-limit";
import { IMPORT_NOTES_PREFIX, BATCH_ID_PATTERN } from "@/lib/import-validation";

// Re-exported for existing/test call sites.
export { BATCH_ID_PATTERN };

/**
 * Undoes a single "Import existing holdings" batch in one action, so a
 * bad backfill (wrong item, fat-fingered qty, whole thing was a mistake)
 * doesn't require deleting rows one at a time in the UI.
 *
 * Deliberately scoped to `status: "open"` — if the user already closed
 * one of the imported rows (i.e. actually sold that item and recorded a
 * result), that's now real trading history, not just an import artifact,
 * so undo leaves it alone rather than silently deleting a completed
 * trade.
 */

const UNDO_RATE_LIMIT = 10;
const UNDO_RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(`flips-import-undo:${userId}`, UNDO_RATE_LIMIT, UNDO_RATE_WINDOW_MS);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests, please slow down." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const batchId = typeof body?.batchId === "string" ? body.batchId : null;

  if (!batchId || !BATCH_ID_PATTERN.test(batchId)) {
    return NextResponse.json({ error: "Invalid batch id" }, { status: 400 });
  }

  const result = await prisma.flip.deleteMany({
    where: {
      userId,
      status: "open",
      notes: { startsWith: IMPORT_NOTES_PREFIX, contains: `(batch:${batchId})` },
    },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "Nothing to undo — this batch was already closed, deleted, or doesn't belong to you." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, removed: result.count });
}
