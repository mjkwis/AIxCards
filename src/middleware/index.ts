/**
 * Astro Middleware
 *
 * Handles:
 * - Supabase client initialization with SSR support
 * - Authentication for API routes (JWT validation)
 * - Rate limiting for specific endpoints
 * - Adding rate limit headers to responses
 */

import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../db/database.types";
import { errorResponse } from "../lib/helpers/error-response";
import { rateLimitService } from "../lib/services/rate-limit.service";
import { RateLimitError } from "../lib/errors/rate-limit.error";

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Initialize Supabase client with SSR support
  // This creates a client that properly handles cookies for server-side rendering
  const supabase = createServerClient<Database>(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY, {
    cookies: {
      get: (key) => context.cookies.get(key)?.value,
      set: (key, value, options) => {
        context.cookies.set(key, value, options);
      },
      remove: (key, options) => {
        context.cookies.delete(key, options);
      },
    },
  });

  context.locals.supabase = supabase;

  // 2. Check if this is an API route that requires authentication
  const isApiRoute = context.url.pathname.startsWith("/api/");
  const isAuthRoute = context.url.pathname.startsWith("/api/auth/");

  if (isApiRoute && !isAuthRoute) {
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
      email: user.email,
    };

    // 3. Rate limiting for generation-requests endpoint
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

  // 4. Continue to endpoint
  const response = await next();

  // 5. Add rate limit headers to response (if available)
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
