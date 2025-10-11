/**
 * Custom error class for AI service related errors
 * 
 * Thrown when OpenRouter.ai API fails or returns invalid data
 */
export class AIServiceError extends Error {
  /**
   * Creates an AI service error
   * 
   * @param message - User-friendly error message
   * @param reason - Technical reason for the error (for logging)
   * @param statusCode - HTTP status code to return (default: 422)
   */
  constructor(
    message: string,
    public reason: string,
    public statusCode: number = 422
  ) {
    super(message);
    this.name = "AIServiceError";
    
    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AIServiceError);
    }
  }
}

