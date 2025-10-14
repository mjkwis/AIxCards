/**
 * Astro Middleware
 *
 * Handles:
 * - Supabase client initialization with SSR support (getAll/setAll pattern)
 * - Authentication for dashboard pages (SSR cookie-based)
 * - Authentication for API routes (JWT Bearer token)
 * - Rate limiting for specific endpoints
 * - Adding rate limit headers to responses
 */

import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerInstance } from "../db/supabase.client";
import { errorResponse } from "../lib/helpers/error-response";
import { rateLimitService } from "../lib/services/rate-limit.service";
import { RateLimitError } from "../lib/errors/rate-limit.error";

/**
 * Public API endpoints that don't require Bearer token authentication
 * All other /api/* routes require valid JWT token in Authorization header
 */
const PUBLIC_API_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/password/reset",
  "/api/auth/password/update",
];

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Initialize Supabase client with SSR support
  // Uses getAll/setAll pattern as required by @supabase/ssr
  const supabase = createSupabaseServerInstance({
    cookies: context.cookies,
    headers: context.request.headers,
  });

  context.locals.supabase = supabase;

  // 2. Check authentication for dashboard pages (SSR cookie-based)
  const isDashboardPage = context.url.pathname.startsWith("/dashboard");

  if (isDashboardPage) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      // Redirect to login with return URL
      const redirectUrl = `/login?redirect=${encodeURIComponent(context.url.pathname)}`;
      return context.redirect(redirectUrl);
    }

    // Store authenticated user in context for dashboard pages
    context.locals.user = {
      id: session.user.id,
      email: session.user.email ?? "",
      created_at: session.user.created_at,
    };
  }

  // 3. Check if this is an API route that requires authentication
  const isApiRoute = context.url.pathname.startsWith("/api/");
  const isPublicApiPath = PUBLIC_API_PATHS.includes(context.url.pathname);

  // Debug logging
  if (isApiRoute) {
    console.log(`[Middleware] API Route: ${context.url.pathname}, isPublic: ${isPublicApiPath}`);
  }

  if (isApiRoute && !isPublicApiPath) {
    // Extract and validate JWT token from Authorization header
    const authHeader = context.request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication token is required");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return errorResponse(401, "AUTH_REQUIRED", "Invalid or expired authentication token");
    }

    // Store authenticated user in context
    context.locals.user = {
      id: user.id,
      email: user.email ?? "",
      created_at: user.created_at,
    };

    // 4. Rate limiting for generation-requests endpoint
    if (context.url.pathname === "/api/generation-requests" && context.request.method === "POST") {
      try {
        await rateLimitService.check(user.id, "generation-requests");

        // Store rate limit info for response headers
        context.locals.rateLimitRemaining = rateLimitService.getRemaining(user.id, "generation-requests");
        const resetAt = rateLimitService.getResetAt(user.id, "generation-requests");
        context.locals.rateLimitReset = resetAt ?? undefined;
      } catch (error) {
        if (error instanceof RateLimitError) {
          return errorResponse(
            429,
            "RATE_LIMIT_EXCEEDED",
            "Generation request limit exceeded. Please try again later.",
            {
              limit: 10,
              reset_at: error.resetAt.toISOString(),
            }
          );
        }
        throw error;
      }
    }
  }

  // 5. Continue to endpoint
  const response = await next();

  // 6. Add rate limit headers to response (if available)
  if (context.locals.rateLimitRemaining !== undefined) {
    response.headers.set("X-RateLimit-Limit", "10");
    response.headers.set("X-RateLimit-Remaining", context.locals.rateLimitRemaining.toString());

    if (context.locals.rateLimitReset) {
      // Convert to Unix timestamp (seconds since epoch)
      response.headers.set("X-RateLimit-Reset", Math.floor(context.locals.rateLimitReset.getTime() / 1000).toString());
    }
  }

  return response;
});
