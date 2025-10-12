/**
 * Custom error class for rate limit violations
 *
 * Thrown when a user exceeds the allowed number of requests
 */
export class RateLimitError extends Error {
  /**
   * Creates a rate limit error
   *
   * @param resetAt - Date when the rate limit will reset
   */
  constructor(public resetAt: Date) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RateLimitError);
    }
  }
}
