interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Cleanup stale records periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetAt) {
        memoryStore.delete(key);
      }
    }
  }, 60 * 1000).unref();
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * In-memory sliding window rate limiter for security-sensitive endpoints (login, password reset).
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowSeconds = 15 * 60
): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || now > existing.resetAt) {
    const record: RateLimitRecord = {
      attempts: 1,
      resetAt: now + windowSeconds * 1000,
    };
    memoryStore.set(key, record);
    return {
      success: true,
      remaining: maxAttempts - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (existing.attempts >= maxAttempts) {
    const resetSeconds = Math.ceil((existing.resetAt - now) / 1000);
    return {
      success: false,
      remaining: 0,
      resetSeconds,
    };
  }

  existing.attempts += 1;
  const resetSeconds = Math.ceil((existing.resetAt - now) / 1000);
  return {
    success: true,
    remaining: maxAttempts - existing.attempts,
    resetSeconds,
  };
}

/**
 * Resets the rate limiter for a key upon successful authentication.
 */
export function resetRateLimit(key: string): void {
  memoryStore.delete(key);
}

