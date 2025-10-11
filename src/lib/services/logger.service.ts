/**
 * Structured logging service
 * 
 * Provides consistent logging across the application with context
 * and different severity levels.
 */

/**
 * Logger class for structured logging
 * 
 * Usage:
 * ```ts
 * const logger = new Logger("MyService");
 * logger.info("Operation started", { userId: "123" });
 * logger.error("Operation failed", error, { userId: "123" });
 * ```
 */
export class Logger {
  private context: string;

  /**
   * Creates a new logger instance
   * 
   * @param context - Context name (e.g., service name, endpoint name)
   */
  constructor(context: string) {
    this.context = context;
  }

  /**
   * Logs informational message
   * For normal operations and successful completions
   * 
   * @param message - Log message
   * @param data - Optional additional data
   */
  info(message: string, data?: unknown): void {
    console.log(`[${this.context}] INFO: ${message}`, data || "");
  }

  /**
   * Logs warning message
   * For potentially problematic situations that aren't errors
   * 
   * @param message - Log message
   * @param data - Optional additional data
   */
  warning(message: string, data?: unknown): void {
    console.warn(`[${this.context}] WARNING: ${message}`, data || "");
  }

  /**
   * Logs error message
   * For errors that are handled but should be tracked
   * 
   * @param message - Log message
   * @param error - Error object
   * @param data - Optional additional context data
   */
  error(message: string, error: Error, data?: unknown): void {
    console.error(`[${this.context}] ERROR: ${message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...(data ? (data as object) : {}),
    });
  }

  /**
   * Logs critical error message
   * For critical errors that require immediate attention
   * In production, this should trigger alerts to monitoring services
   * 
   * @param message - Log message
   * @param error - Error object
   * @param data - Optional additional context data
   */
  critical(message: string, error: Error, data?: unknown): void {
    console.error(`[${this.context}] CRITICAL: ${message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...(data ? (data as object) : {}),
    });
    
    // TODO: In production, send alert to external monitoring service (Sentry, etc.)
  }
}

