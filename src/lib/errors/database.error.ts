/**
 * Custom error class for database related errors
 *
 * Thrown when Supabase database operations fail
 */
export class DatabaseError extends Error {
  /**
   * Creates a database error
   *
   * @param message - User-friendly error message
   * @param originalError - Original error from Supabase or PostgreSQL
   */
  constructor(
    message: string,
    public originalError: unknown
  ) {
    super(message);
    this.name = "DatabaseError";

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }
}
