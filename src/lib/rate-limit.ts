import { connectDB } from "@/lib/db";
import { RateLimit } from "@/models/rate-limit";

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

// In-memory fallback cache if database is disconnected or transitioning
const memoryStore = new Map<string, RateLimitRecord>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetSeconds: number;
}

/**
 * Distributed, multi-instance production rate-limiter backed by MongoDB with TTL indexing.
 * Falls back safely to an in-memory sliding window store if the database is unavailable.
 */
export async function checkRateLimit(
  key: string,
  maxAttempts = 5,
  windowSeconds = 15 * 60
): Promise<RateLimitResult> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  try {
    await connectDB();

    // Find existing rate limit record
    const existing = await RateLimit.findOne({ key });

    if (!existing || existing.resetAt <= now) {
      // Start or reset window atomically
      await RateLimit.findOneAndUpdate(
        { key },
        { $set: { count: 1, resetAt } },
        { upsert: true, returnDocument: "after" }
      );

      return {
        success: true,
        remaining: maxAttempts - 1,
        resetSeconds: windowSeconds,
      };
    }

    if (existing.count >= maxAttempts) {
      const resetSeconds = Math.max(
        1,
        Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
      );
      return {
        success: false,
        remaining: 0,
        resetSeconds,
      };
    }

    // Increment attempt counter atomically
    const updated = await RateLimit.findOneAndUpdate(
      { key, count: { $lt: maxAttempts } },
      { $inc: { count: 1 } },
      { returnDocument: "after" }
    );

    const currentCount = updated ? updated.count : existing.count + 1;
    const remaining = Math.max(0, maxAttempts - currentCount);
    const resetSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000)
    );

    return {
      success: currentCount <= maxAttempts,
      remaining,
      resetSeconds,
    };
  } catch (err) {
    // Graceful fallback to local in-memory limiter to prevent service outage
    console.warn("[RateLimit] Database limiter fallback triggered:", err instanceof Error ? err.message : err);
    return checkInMemoryRateLimit(key, maxAttempts, windowSeconds);
  }
}

function checkInMemoryRateLimit(
  key: string,
  maxAttempts: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);

  if (!existing || now > existing.resetAt) {
    memoryStore.set(key, {
      attempts: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return {
      success: true,
      remaining: maxAttempts - 1,
      resetSeconds: windowSeconds,
    };
  }

  if (existing.attempts >= maxAttempts) {
    const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return {
      success: false,
      remaining: 0,
      resetSeconds,
    };
  }

  existing.attempts += 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return {
    success: true,
    remaining: maxAttempts - existing.attempts,
    resetSeconds,
  };
}

/**
 * Resets the rate limit for a given key upon successful authentication.
 */
export async function resetRateLimit(key: string): Promise<void> {
  memoryStore.delete(key);
  try {
    await connectDB();
    await RateLimit.deleteOne({ key });
  } catch {
    // Non-fatal if reset cleanup fails
  }
}
