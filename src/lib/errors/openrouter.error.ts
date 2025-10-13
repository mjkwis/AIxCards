/**
 * Custom error classes for OpenRouter service
 *
 * These errors represent different failure scenarios when
 * communicating with the OpenRouter API.
 */

/**
 * Base OpenRouter error class
 */
export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode = 500
  ) {
    super(message);
    this.name = "OpenRouterError";

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OpenRouterError);
    }
  }
}

/**
 * Configuration error (missing API key, invalid config)
 */
export class OpenRouterConfigError extends OpenRouterError {
  constructor(message: string) {
    super(message, "OPENROUTER_CONFIG_ERROR", 500);
    this.name = "OpenRouterConfigError";
  }
}

/**
 * Authentication error (401, 403)
 */
export class OpenRouterAuthError extends OpenRouterError {
  constructor(message: string, statusCode: number) {
    super(message, "OPENROUTER_AUTH_ERROR", statusCode);
    this.name = "OpenRouterAuthError";
  }
}

/**
 * Request validation error (400)
 */
export class OpenRouterValidationError extends OpenRouterError {
  constructor(
    message: string,
    public readonly validationErrors?: unknown
  ) {
    super(message, "OPENROUTER_VALIDATION_ERROR", 400);
    this.name = "OpenRouterValidationError";
  }
}

/**
 * Rate limit error (429)
 */
export class OpenRouterRateLimitError extends OpenRouterError {
  constructor(
    message: string,
    public readonly resetAt?: Date
  ) {
    super(message, "OPENROUTER_RATE_LIMIT_ERROR", 429);
    this.name = "OpenRouterRateLimitError";
  }
}

/**
 * Server error (500-599)
 */
export class OpenRouterServerError extends OpenRouterError {
  constructor(message: string, statusCode: number) {
    super(message, "OPENROUTER_SERVER_ERROR", statusCode);
    this.name = "OpenRouterServerError";
  }
}

/**
 * Timeout error
 */
export class OpenRouterTimeoutError extends OpenRouterError {
  constructor(public readonly timeoutMs: number) {
    super(`Request timed out after ${timeoutMs}ms`, "OPENROUTER_TIMEOUT_ERROR", 408);
    this.name = "OpenRouterTimeoutError";
  }
}

/**
 * Invalid response error (parsing failures)
 */
export class OpenRouterInvalidResponseError extends OpenRouterError {
  constructor(
    message: string,
    public readonly rawResponse?: unknown
  ) {
    super(message, "OPENROUTER_INVALID_RESPONSE_ERROR", 502);
    this.name = "OpenRouterInvalidResponseError";
  }
}
