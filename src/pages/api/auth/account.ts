/**
 * DELETE /api/auth/account
 * 
 * Delete the current user's account and all associated data
 * 
 * This endpoint permanently deletes the user's account from the system,
 * including all flashcards and generation requests. This operation:
 * - Cannot be undone
 * - Complies with GDPR/RODO "right to be forgotten"
 * - Uses CASCADE deletion for related data
 * - Invalidates all user sessions
 * 
 * Features:
 * - User identity verification through JWT
 * - Permanent deletion of user account
 * - CASCADE deletion of flashcards and generation requests
 * - Session invalidation
 * - Cookie cleanup
 * 
 * Security:
 * - Protected endpoint (requires valid JWT token)
 * - Uses service role client for admin privileges
 * - Verifies user identity before deletion
 * - Irreversible operation
 * 
 * GDPR/RODO Compliance:
 * - Implements "right to be forgotten"
 * - Deletes all personal data
 * - Logs deletion for audit trail
 */

import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../db/supabase-admin.client";
import { errorResponse } from "../../../lib/helpers/error-response";

/**
 * DELETE handler for account deletion
 * 
 * Request:
 * - Headers: Authorization: Bearer {access_token}
 * - Body: None (user_id extracted from JWT by middleware)
 * 
 * Success Response (204 No Content):
 * - No body
 * - Set-Cookie header clears refresh token
 * 
 * Error Responses:
 * - 401: Missing or invalid authentication token (handled by middleware)
 * - 500: Internal server error (deletion failed)
 * 
 * Database CASCADE behavior:
 * - Deleting user from auth.users triggers:
 *   - ON DELETE CASCADE: flashcards table
 *   - ON DELETE CASCADE: generation_requests table
 * 
 * Note: This endpoint is protected by middleware which validates the JWT token.
 * The user object is available in locals.user with the authenticated user's ID.
 */
export const DELETE: APIRoute = async ({ locals }) => {
  try {
    // 1. Get authenticated user ID from middleware
    // Middleware has already verified the JWT token and populated locals.user
    if (!locals.user?.id) {
      return errorResponse(
        401,
        "AUTH_REQUIRED",
        "Valid authentication token is required"
      );
    }

    const userId = locals.user.id;

    // 2. Delete user account using service role client
    // This requires admin privileges to delete users from auth.users
    // The service role client bypasses RLS and can perform admin operations
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (error) {
        console.error("Failed to delete user account:", error);
        return errorResponse(
          500,
          "DELETION_FAILED",
          "Failed to delete account. Please try again later."
        );
      }

      // Log successful deletion for audit trail
      console.info("User account deleted successfully:", { userId });
    } catch (error) {
      console.error("Unexpected error during account deletion:", error);
      return errorResponse(
        500,
        "INTERNAL_ERROR",
        "An unexpected error occurred while deleting your account."
      );
    }

    // 3. Create response with 204 No Content
    const response = new Response(null, {
      status: 204,
    });

    // 4. Clear the refresh token cookie
    // Even though the user is deleted, we clean up the cookie
    const isProduction = import.meta.env.PROD;
    
    const cookieHeader = [
      `sb-refresh-token=`,
      `Max-Age=0`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      isProduction ? `Secure` : '',
    ].filter(Boolean).join('; ');

    response.headers.set('Set-Cookie', cookieHeader);

    return response;

  } catch (error) {
    // Catch-all for unexpected errors
    console.error("Unexpected error in account deletion endpoint:", error);
    
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
};

