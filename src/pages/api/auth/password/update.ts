/**
 * POST /api/auth/password/update
 *
 * Update password after clicking reset link
 *
 * Features:
 * - Password validation with Zod (strength requirements)
 * - Requires valid reset token (from email link)
 * - Updates password via Supabase Auth
 * - Invalidates all sessions after password change
 *
 * Security:
 * - Token automatically verified by Supabase
 * - Token is one-time use (invalidated after use)
 * - All sessions logged out after password change
 * - Strong password requirements enforced
 *
 * Flow:
 * 1. User clicks reset link with token in URL
 * 2. Supabase automatically exchanges token for session
 * 3. User submits new password
 * 4. Password is updated
 * 5. All sessions are invalidated
 * 6. User is redirected to login
 */

import type { APIContext } from "astro";
import { UpdatePasswordSchema } from "../../../../lib/validation/auth";
import { errorResponse } from "../../../../lib/helpers/error-response";
import { Logger } from "../../../../lib/services/logger.service";
import { supabaseAdmin } from "../../../../db/supabase-admin.client";

const logger = new Logger("POST /api/auth/password/update");

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Get Supabase client
    const supabase = context.locals.supabase;

    if (!supabase) {
      logger.error("Supabase client not available", new Error("No supabase"));
      return errorResponse(500, "INTERNAL_ERROR", "Service configuration error");
    }

    // 2. Check if user is authenticated (from reset token)
    let user = null;
    let isDevMockUser = false;

    // In development mode, check for mock token first
    if (import.meta.env.DEV) {
      try {
        // Try to get user from Supabase first
        const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

        if (supabaseUser && !authError) {
          user = supabaseUser;
          console.log("🔧 UPDATE DEBUG: Using real Supabase user:", user.email);
        } else {
          // Extract email from referer URL (it has the #access_token with email param)
          console.log("🔧 UPDATE DEBUG: No Supabase session, looking for mock token");
          
          const referer = context.request.headers.get("referer") || "";
          console.log("🔧 UPDATE DEBUG: Referer:", referer);
          
          // Try to extract email from URL hash (e.g., #access_token=...&email=...)
          let mockEmail = 'test@example.com'; // default fallback
          
          if (referer.includes('#')) {
            const hashPart = referer.split('#')[1] || '';
            const params = new URLSearchParams(hashPart);
            const emailFromHash = params.get('email');
            
            if (emailFromHash) {
              mockEmail = decodeURIComponent(emailFromHash);
              console.log("🔧 UPDATE DEBUG: Extracted email from hash:", mockEmail);
            }
          }
          
          // Find user by email using admin client
          const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
          
          if (listError) {
            console.log("🔧 UPDATE DEBUG: Failed to list users:", listError);
            return errorResponse(500, "INTERNAL_ERROR", "Failed to verify user");
          }
          
          const foundUser = users?.find(u => u.email === mockEmail);
          
          if (!foundUser) {
            console.log("🔧 UPDATE DEBUG: User not found for email:", mockEmail);
            return errorResponse(404, "NOT_FOUND", `No user found with email: ${mockEmail}`);
          }
          
          user = foundUser;
          isDevMockUser = true;
          console.log("🔧 UPDATE DEBUG: Using admin-found user:", user.email, user.id);
        }
      } catch (error) {
        console.log("🔧 UPDATE DEBUG: Error in auth check:", error);
        return errorResponse(500, "INTERNAL_ERROR", "Failed to authenticate user");
      }
    } else {
      // Production mode - require proper authentication
      const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser();

      if (authError || !supabaseUser) {
        logger.warning("Unauthorized password update attempt", { error: authError?.message });
        return errorResponse(401, "UNAUTHORIZED", "Reset link has expired or is invalid");
      }

      user = supabaseUser;
    }

    // 3. Parse request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      logger.info("Invalid JSON in request body");
      return errorResponse(400, "VALIDATION_ERROR", "Invalid request format");
    }

    // 4. Validate with Zod
    const validationResult = UpdatePasswordSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.info("Validation failed", {
        userId: user.id,
        field: firstError.path.join("."),
        message: firstError.message,
      });

      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
      });
    }

    const { password } = validationResult.data;

    logger.info("Processing password update", { userId: user.id, email: user.email });

    // 5. Update password - use admin API in DEV for mock users
    if (import.meta.env.DEV && isDevMockUser) {
      console.log("🔧 UPDATE DEBUG: Updating password via Admin API for mock user");
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password }
      );

      if (updateError) {
        logger.error("Failed to update password (admin)", updateError as Error, {
          userId: user.id,
          email: user.email,
        });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to update password");
      }

      console.log("🔧 UPDATE DEBUG: Password updated successfully via Admin API");
      console.log("🔧 UPDATE DEBUG: User:", user.email, "can now login with new password");
    } else {
      // Use standard API when user has active session (both DEV and PROD)
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        logger.error("Failed to update password", updateError as Error, {
          userId: user.id,
          email: user.email,
        });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to update password");
      }

      if (import.meta.env.DEV) {
        console.log("🔧 UPDATE DEBUG: Password updated successfully via standard API");
        console.log("🔧 UPDATE DEBUG: User:", user.email);
      }

      // Sign out all sessions for security (only when user has session)
      await supabase.auth.signOut({ scope: "global" });
      logger.info("All sessions invalidated after password change", { 
        userId: user.id,
        isDevMode: import.meta.env.DEV 
      });
    }

    logger.info("Password updated successfully", {
      userId: user.id,
      email: user.email,
      isDevMode: import.meta.env.DEV,
    });

    // 7. Return success
    return new Response(
      JSON.stringify({
        success: true,
        message: "Password has been successfully updated",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logger.critical("Unexpected error in password update", error as Error);
    return errorResponse(500, "INTERNAL_ERROR", "An error occurred. Please try again later.");
  }
}

