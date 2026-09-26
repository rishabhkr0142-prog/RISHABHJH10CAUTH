/**
 * Production-ready Sliding-Window Rate Limiter for Seller API
 *
 * Prevents abusive or accidental floods without interfering
 * with normal Discord bot usage.
 */

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory sliding window store (keyed by identifier, e.g. sellerKeyId or IP)
const store = new Map<string, RateLimitRecord>();

// Clean up stale records periodically every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupStaleEntries(windowMs: number) {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  const threshold = now - windowMs;
  for (const [key, record] of store.entries()) {
    record.timestamps = record.timestamps.filter((ts) => ts > threshold);
    if (record.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

export interface RateLimitOptions {
  limit?: number;     // Maximum requests per window (default: 60)
  windowMs?: number;  // Window duration in ms (default: 60,000 ms = 1 minute)
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
}

/**
 * Checks and records a request against the rate limit window.
 *
 * @param identifier Unique key (e.g. sellerKeyId or client IP)
 * @param options Limit and window duration
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60 * 1000;
  const now = Date.now();
  const windowStart = now - windowMs;

  cleanupStaleEntries(windowMs);

  let record = store.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    store.set(identifier, record);
  }

  // Keep only timestamps within the active sliding window
  record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

  const currentCount = record.timestamps.length;
  const oldestTimestamp = record.timestamps[0] || now;
  const resetSeconds = Math.max(1, Math.ceil((oldestTimestamp + windowMs - now) / 1000));

  if (currentCount >= limit) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds
    };
  }

  // Record this request timestamp
  record.timestamps.push(now);

  return {
    allowed: true,
    limit,
    remaining: Math.max(0, limit - record.timestamps.length),
    resetSeconds
  };
}
