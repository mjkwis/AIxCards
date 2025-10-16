/**
 * POST /api/auth/password/mock-reset
 *
 * DEVELOPMENT ONLY - Mock password reset endpoint
 *
 * This endpoint generates a password reset token WITHOUT sending an email.
 * Useful for testing the password reset flow in development mode.
 *
 * SECURITY WARNING: This endpoint should ONLY exist in development mode.
 * It's disabled in production.
 *
 * Usage:
 * 1. POST to this endpoint with user email
 * 2. Get back a reset link with token OR be redirected in DEV
 * 3. Visit the link to set new password
 *
 * Example JSON:
 * curl -X POST http://localhost:3000/api/auth/password/mock-reset \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"user@example.com"}'
 *
 * Example Redirect (DEV convenience):
 * curl -L -X POST "http://localhost:3000/api/auth/password/mock-reset?redirect=1" \
 *   -H "Content-Type: application/json" \
 *   -d '{"email":"user@example.com"}'
 */

import type { APIContext } from "astro";
import { errorResponse } from "../../../../lib/helpers/error-response";
import { Logger } from "../../../../lib/services/logger.service";
import { ResetPasswordRequestSchema } from "../../../../lib/validation/auth";

const logger = new Logger("POST /api/auth/password/mock-reset");

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  // Only allow in development mode
  if (!import.meta.env.DEV) {
    logger.warning("Mock reset endpoint called in production");
    return errorResponse(404, "NOT_FOUND", "Endpoint not found");
  }

  console.log("🔧 MOCK RESET DEBUG: Endpoint called");

  try {
    // 1. Get Supabase client
    const supabase = context.locals.supabase;
    console.log("🔧 MOCK RESET DEBUG: Supabase client available:", !!supabase);

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
    console.log("🔧 MOCK RESET DEBUG: Request body:", requestBody);
    const validationResult = ResetPasswordRequestSchema.safeParse(requestBody);
    console.log("🔧 MOCK RESET DEBUG: Validation result:", validationResult.success);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      console.log("🔧 MOCK RESET DEBUG: Validation failed:", firstError);
      logger.info("Validation failed", {
        field: firstError.path.join("."),
        message: firstError.message,
      });

      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
      });
    }

    const { email } = validationResult.data;
    console.log("🔧 MOCK RESET DEBUG: Email extracted:", email);

    logger.info("Generating mock password reset link", { email });

    // 4. Generate mock reset link WITHOUT Supabase admin API
    // Create a simple mock token for development testing
    const redirectUrl = `${import.meta.env.SITE_URL || "http://localhost:3000"}/update-password`;

    // Generate a mock access token (simple base64 encoded string)
    const mockToken = Buffer.from(
      JSON.stringify({
        email,
        type: "recovery",
        exp: Math.floor(Date.now() / 1000) + 3600, // expires in 1 hour
        iat: Math.floor(Date.now() / 1000),
      })
    ).toString("base64");

    // Construct the mock action link
    const actionLink = `${redirectUrl}#access_token=${mockToken}&type=recovery&email=${encodeURIComponent(email)}`;

    console.log("🔧 MOCK RESET DEBUG: Generated mock link", {
      email,
      redirectUrl,
      tokenLength: mockToken.length,
    });

    console.log("🔧 MOCK RESET DEBUG: Link generated successfully", {
      email,
      linkLength: actionLink.length,
      linkPreview: actionLink.substring(0, 100) + "...",
    });

    logger.info("Mock reset link generated successfully", {
      email,
      linkLength: actionLink.length,
    });

    // 4a. Auto-redirect in DEV when requested via ?redirect=1 or Accept: text/html
    const reqUrl = new URL(context.request.url);
    const wantsRedirect =
      reqUrl.searchParams.get("redirect") === "1" ||
      (context.request.headers.get("Accept") || "").includes("text/html");

    if (wantsRedirect) {
      console.log("🔧 MOCK RESET DEBUG: Performing redirect to action link");
      return Response.redirect(actionLink, 302);
    }

    // 5. Return the reset link (in development only!)
    console.log("🔧 MOCK RESET DEBUG: Returning success response");
    return new Response(
      JSON.stringify({
        success: true,
        message: "Mock reset link generated (development only)",
        resetLink: actionLink,
        instructions: "Copy the link and paste it in your browser address bar",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    logger.critical("Unexpected error in mock password reset", error as Error);
    return errorResponse(500, "INTERNAL_ERROR", "An error occurred. Please try again later.");
  }
}
