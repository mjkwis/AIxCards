/**
 * POST /api/auth/logout
 *
 * Log out the current user
 *
 * This endpoint invalidates the user's current session and clears
 * authentication tokens. It follows the "always succeeds" philosophy -
 * even if token invalidation fails on the server, cookies are cleared
 * client-side to ensure the user is logged out.
 *
 * Features:
 * - Session invalidation through Supabase Auth
 * - Refresh token cookie removal
 * - Graceful error handling
 * - Always succeeds philosophy (returns 204 even on some failures)
 *
 * Security:
 * - Protected endpoint (requires valid JWT token)
 * - No rate limiting (users can log out as many times as needed)
 * - Clears httpOnly cookies to prevent token reuse
 */

import type { APIRoute } from "astro";
import { AuthService } from "../../../lib/services/auth.service";
import { errorResponse } from "../../../lib/helpers/error-response";

/**
 * POST handler for user logout
 *
 * Request:
 * - Headers: Authorization: Bearer {access_token}
 * - Body: None
 *
 * Success Response (204 No Content):
 * - No body
 * - Set-Cookie header clears refresh token
 *
 * Error Responses:
 * - 401: Missing or invalid authentication token (handled by middleware)
 * - 500: Internal server error (rare, usually still succeeds with cookie clearing)
 *
 * Note: This endpoint is protected by middleware which validates the JWT token.
 * If the token is invalid or missing, the middleware returns 401 before this handler runs.
 */
export const POST: APIRoute = async ({ locals }) => {
  try {
    // Note: If we reach here, middleware has already verified the user is authenticated
    // and locals.user is populated with the authenticated user's data

    // 1. Invalidate session through AuthService
    const authService = new AuthService(locals.supabase);

    try {
      await authService.logout();
    } catch (error) {
      // Log the error but don't fail the request
      // We still want to clear the client-side cookie even if server logout fails
      console.error("Logout error (continuing anyway):", error);
    }

    // 2. Create response with 204 No Content
    const response = new Response(null, {
      status: 204,
    });

    // 3. Clear the refresh token cookie
    // Setting Max-Age=0 immediately expires the cookie
    // This ensures the user is logged out client-side even if server logout failed
    const isProduction = import.meta.env.PROD;

    const cookieHeader = [
      `sb-refresh-token=`,
      `Max-Age=0`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      isProduction ? `Secure` : "",
    ]
      .filter(Boolean)
      .join("; ");

    response.headers.set("Set-Cookie", cookieHeader);

    return response;
  } catch (error) {
    // Catch-all for unexpected errors
    // Even in case of error, we try to clear the cookie
    console.error("Unexpected error in logout endpoint:", error);

    // Create error response but still clear the cookie
    const errorResponseObj = errorResponse(500, "INTERNAL_ERROR", "Logout failed. Please try again.");

    // Clear cookie even on error
    const isProduction = import.meta.env.PROD;
    const cookieHeader = [
      `sb-refresh-token=`,
      `Max-Age=0`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      isProduction ? `Secure` : "",
    ]
      .filter(Boolean)
      .join("; ");

    errorResponseObj.headers.set("Set-Cookie", cookieHeader);

    return errorResponseObj;
  }
};
