import "server-only";

/**
 * Per-client request budget held in the instance's own memory.
 *
 * Deliberately not Firestore-backed. A persistent counter costs a read and a
 * write on every request, so under the flood it exists to blunt it would add
 * load to the very quota it protects. This rejects before any Firestore read,
 * SMTP connection or carrier API call happens, and costs nothing to run.
 *
 * It is a speed bump, not a wall: it resets on a cold start and each serverless
 * instance counts separately, so a distributed flood still gets through. The
 * authoritative limit belongs at the edge.
 * What it does buy is that one script hammering one endpoint stops paying for
 * order transactions and Nova Poshta calls after its first few requests.
 */

type Bucket = { count: number; resetAt: number };

/** Bounded so a client rotating addresses cannot grow this without limit. */
const maxTracked = 5_000;
const buckets = new Map<string, Bucket>();

/**
 * Vercel puts the client address first in `x-forwarded-for`. An absent header
 * means we cannot attribute the request, and every such request then shares one
 * bucket rather than escaping the limit entirely.
 */
export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip")?.trim() || "unattributed";
}

function evict(now: number) {
  for (const [key, bucket] of buckets)
    if (bucket.resetAt <= now) buckets.delete(key);
  // Still full after dropping the expired ones: fail open rather than grow.
  if (buckets.size > maxTracked) buckets.clear();
}

/**
 * Spends one request from `key`'s budget. Returns the seconds a caller should
 * wait when the budget is gone, or `null` while it still has room.
 */
export function spendRequest(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
) {
  const now = Date.now();
  if (buckets.size >= maxTracked) evict(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }
  bucket.count++;
  if (bucket.count <= limit) return null;
  return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
}

/** Only for tests: the counter is process-wide and outlives a single case. */
export function resetRequestBudgets() {
  buckets.clear();
}
