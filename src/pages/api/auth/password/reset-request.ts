/**
 * POST /api/auth/password/reset-request
 *
 * Request password reset link via email
 *
 * Features:
 * - Email validation with Zod
 * - Rate limiting: 3 attempts per 15 minutes per IP+Email (in middleware)
 * - Always returns success to prevent email enumeration
 * - Uses Supabase Auth resetPasswordForEmail
 *
 * Security:
 * - Token valid for 15 minutes (configured in Supabase)
 * - One-time use token
 * - Rate limited per IP and email combination
 * - Doesn't reveal if email exists
 */

import type { APIContext } from "astro";
import { ResetPasswordRequestSchema } from "../../../../lib/validation/auth";
import { errorResponse } from "../../../../lib/helpers/error-response";
import { Logger } from "../../../../lib/services/logger.service";

const logger = new Logger("POST /api/auth/password/reset-request");

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Get Supabase client
    const supabase = context.locals.supabase;

    if (!supabase) {
      logger.error("Supabase client not available", new Error("No supabase"));
      return errorResponse(500, "INTERNAL_ERROR", "Service configuration error");
    }

    // 2. Parse request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch {
      logger.info("Invalid JSON in request body");
      return errorResponse(400, "VALIDATION_ERROR", "Invalid request format");
    }

    // 3. Validate with Zod
    const validationResult = ResetPasswordRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.info("Validation failed", {
        field: firstError.path.join("."),
        message: firstError.message,
      });

      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
      });
    }

    const { email } = validationResult.data;

    logger.info("Processing password reset request", { email });

    // 4. Get site URL for redirect
    const siteUrl = import.meta.env.SITE_URL || "http://localhost:3000";

    // 5. Call Supabase resetPasswordForEmail
    // IMPORTANT: This will ALWAYS return success, even if email doesn't exist
    // This prevents email enumeration attacks
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl}/update-password`,
    });

    // 6. Handle Supabase errors (but still return success to user)
    if (error) {
      logger.error("Supabase resetPasswordForEmail error", error as Error, { email });
      // Still return success to user for security
    } else {
      logger.info("Password reset email sent (if user exists)", { email });
    }

    // 7. Always return success (security: don't reveal if email exists)
    return new Response(
      JSON.stringify({
        success: true,
        message: "If the email exists in our system, we have sent a password reset link",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logger.critical("Unexpected error in password reset request", error as Error);
    return errorResponse(500, "INTERNAL_ERROR", "An error occurred. Please try again later.");
  }
}
