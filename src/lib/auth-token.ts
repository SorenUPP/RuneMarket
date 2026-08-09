import { prisma } from "@/lib/db";
import { extractBearerToken, hashApiToken } from "@/lib/api-tokens";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the Supabase user id behind a personal API token, for routes
 * called by external clients (e.g. the RuneLite plugin) that can't send
 * cookies. Returns null on any missing/invalid/expired token so callers
 * can respond with a plain 401 without leaking which part failed.
 */
export async function getUserIdFromApiToken(
  req: Request
): Promise<string | null> {
  const raw = extractBearerToken(req.headers.get("authorization"));
  if (!raw) return null;

  const tokenHash = hashApiToken(raw);

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!token || token.revokedAt) return null;

  // Best-effort last-used bump; don't block the request on it.
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return token.userId;
}

/**
 * Resolves the acting user for routes that need to serve both the
 * RuneLite plugin (Bearer API token, no cookies) and the website's own
 * UI (Supabase cookie session, no bearer token) — e.g. the manual
 * "Import existing holdings" panel on /portfolio, which hits the same
 * endpoint the plugin would use. Tries the API token first since it's
 * cheaper (single indexed lookup) before falling back to a session check.
 */
export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const apiTokenUserId = await getUserIdFromApiToken(req);
  if (apiTokenUserId) return apiTokenUserId;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
