/**
 * Rate Limiter for Marketplace API Calls
 * Prevents 429 errors by throttling requests to marketplaces
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 5, windowMs: 1000 }) {
    this.config = config;
  }

  /**
   * Check if a request can be made for a given key (e.g., shop connection)
   */
  canMakeRequest(key: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];

    // Remove timestamps outside the current window
    const validTimestamps = timestamps.filter(
      timestamp => now - timestamp < this.config.windowMs
    );

    // Check if we're under the limit
    if (validTimestamps.length < this.config.maxRequests) {
      validTimestamps.push(now);
      this.requests.set(key, validTimestamps);
      return true;
    }

    return false;
  }

  /**
   * Get time until next request can be made
   */
  getTimeUntilNextRequest(key: string): number {
    const timestamps = this.requests.get(key);
    if (!timestamps || timestamps.length === 0) return 0;

    const oldestTimestamp = timestamps[0];
    const now = Date.now();
    const timeSinceOldest = now - oldestTimestamp;

    if (timeSinceOldest >= this.config.windowMs) return 0;

    return this.config.windowMs - timeSinceOldest;
  }

  /**
   * Reset rate limit for a specific key
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.requests.clear();
  }
}

// Singleton instance for marketplace API rate limiting
export const marketplaceRateLimiter = new RateLimiter({
  maxRequests: 5, // 5 requests per second
  windowMs: 1000
});

export default RateLimiter;