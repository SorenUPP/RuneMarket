import { prisma } from "@/lib/db";
import { extractBearerToken, hashApiToken } from "@/lib/api-tokens";

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
