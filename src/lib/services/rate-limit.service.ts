/**
 * Rate Limiting Service
 * 
 * Implements rate limiting for API endpoints to prevent abuse.
 * 
 * CURRENT IMPLEMENTATION: In-memory store (Map)
 * - Simple and sufficient for MVP
 * - Resets on server restart
 * 
 * PRODUCTION RECOMMENDATION: Migrate to Redis
 * - Persistent across server restarts
 * - Works in multi-instance deployments
 * - Better performance at scale
 */

import { RateLimitError } from "../errors/rate-limit.error";

/**
 * Rate limit entry stored for each user+endpoint combination
 */
interface RateLimitEntry {
  /** Number of requests made in current window */
  count: number;
  /** Timestamp when the rate limit window resets */
  resetAt: Date;
}

/**
 * In-memory store for rate limit tracking
 * Key format: "endpoint:userId"
 * 
 * Note: This will reset on server restart. For production,
 * consider using Redis or another persistent store.
 */
const store = new Map<string, RateLimitEntry>();

/**
 * Rate Limiting Service
 * 
 * Tracks and enforces rate limits per user per endpoint
 */
export class RateLimitService {
  private limit: number;
  private windowMs: number;

  /**
   * Creates a new rate limit service
   * 
   * @param limit - Maximum number of requests allowed (default: 10)
   * @param windowMs - Time window in milliseconds (default: 3600000 = 1 hour)
   */
  constructor(limit: number = 10, windowMs: number = 3600000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /**
   * Checks if a request should be allowed or rate limited
   * 
   * @param userId - ID of the user making the request
   * @param endpoint - Endpoint identifier (e.g., "generation-requests")
   * @throws RateLimitError if rate limit is exceeded
   */
  async check(userId: string, endpoint: string): Promise<void> {
    const key = `${endpoint}:${userId}`;
    const now = new Date();

    const entry = store.get(key);

    // No entry or expired - create new entry
    if (!entry || entry.resetAt < now) {
      store.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + this.windowMs),
      });
      return;
    }

    // Entry exists and not expired - check limit
    if (entry.count >= this.limit) {
      throw new RateLimitError(entry.resetAt);
    }

    // Increment counter
    entry.count++;
    store.set(key, entry);
  }

  /**
   * Gets the number of remaining requests for a user
   * 
   * @param userId - ID of the user
   * @param endpoint - Endpoint identifier
   * @returns Number of requests remaining in current window
   */
  getRemaining(userId: string, endpoint: string): number {
    const key = `${endpoint}:${userId}`;
    const entry = store.get(key);

    // No entry or expired - full limit available
    if (!entry || entry.resetAt < new Date()) {
      return this.limit;
    }

    return Math.max(0, this.limit - entry.count);
  }

  /**
   * Gets the timestamp when the rate limit will reset
   * 
   * @param userId - ID of the user
   * @param endpoint - Endpoint identifier
   * @returns Date when limit resets, or null if no active limit
   */
  getResetAt(userId: string, endpoint: string): Date | null {
    const key = `${endpoint}:${userId}`;
    const entry = store.get(key);

    // No entry or expired
    if (!entry || entry.resetAt < new Date()) {
      return null;
    }

    return entry.resetAt;
  }

  /**
   * Clears rate limit data for a specific user and endpoint
   * Useful for testing or administrative actions
   * 
   * @param userId - ID of the user
   * @param endpoint - Endpoint identifier
   */
  clear(userId: string, endpoint: string): void {
    const key = `${endpoint}:${userId}`;
    store.delete(key);
  }

  /**
   * Clears all rate limit data
   * Useful for testing or server maintenance
   */
  clearAll(): void {
    store.clear();
  }
}

/**
 * Singleton instance of Rate Limit Service
 * Configured for generation requests: 10 requests per hour
 */
export const rateLimitService = new RateLimitService(10, 3600000);

