/**
 * Helper function for creating standardized error responses
 *
 * Creates a Response object with proper JSON error structure
 * following the ErrorResponse DTO format
 */

import type { ErrorResponse } from "../../types";

/**
 * Creates a standardized error response
 *
 * @param status - HTTP status code (400, 401, 404, 422, 429, 500, etc.)
 * @param code - Error code identifier (e.g., "VALIDATION_ERROR", "AUTH_REQUIRED")
 * @param message - User-friendly error message
 * @param details - Optional additional details about the error
 * @returns Response object with JSON error body
 *
 * @example
 * ```ts
 * return errorResponse(400, "VALIDATION_ERROR", "Invalid input", {
 *   field: "source_text",
 *   received_length: 500
 * });
 * ```
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {}
): Response {
  const body: ErrorResponse = {
    error: {
      code,
      message,
      details,
    },
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
