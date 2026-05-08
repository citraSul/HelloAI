type Bucket = { count: number; resetAt: number };

const store = new Map<string, Bucket>();

const MAX_KEYS = 50_000;

function pruneIfNeeded() {
  if (store.size <= MAX_KEYS) return;
  const now = Date.now();
  for (const [k, b] of store) {
    if (now > b.resetAt) store.delete(k);
  }
}

/**
 * Fixed-window counter per key. In-memory only — sufficient for v1 single-instance / dev;
 * replace with Redis or edge rate limiting for horizontal scale.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryAfterSec: number } {
  pruneIfNeeded();
  const now = Date.now();
  let b = store.get(key);
  if (!b || now > b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    store.set(key, b);
  }
  if (b.count >= limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true };
}
