/**
 * POST /api/auth/login
 * 
 * Authenticate an existing user
 * 
 * This endpoint allows existing users to log in by providing
 * their email and password. Upon successful authentication, the user
 * receives JWT tokens for accessing protected resources.
 * 
 * Features:
 * - Email format validation and normalization
 * - Credential verification through Supabase Auth
 * - Rate limiting (10 requests per 15 minutes per IP+email combo)
 * - Generic error messages (prevents email enumeration)
 * - Automatic session creation
 * 
 * Security:
 * - Public endpoint (no authentication required)
 * - Aggressive rate limiting to prevent brute force attacks
 * - Generic error messages (don't reveal if email exists)
 * - httpOnly cookies for refresh tokens
 * - Credentials verified by Supabase Auth (bcrypt)
 */

import type { APIRoute } from "astro";
import { LoginSchema } from "../../../lib/validation/auth";
import { AuthService, InvalidCredentialsError, AuthServiceError } from "../../../lib/services/auth.service";
import { errorResponse } from "../../../lib/helpers/error-response";
import { RateLimitService } from "../../../lib/services/rate-limit.service";
import { RateLimitError } from "../../../lib/errors/rate-limit.error";
import type { AuthResponse } from "../../../types";

// Rate limiter for login: 10 requests per 15 minutes per IP+email combination
// This aggressive rate limiting helps prevent brute force attacks
const loginRateLimiter = new RateLimitService(10, 900000); // 15 minutes in milliseconds

/**
 * POST handler for user login
 * 
 * Request Body:
 * - email: string (valid email format)
 * - password: string (non-empty, no strength validation)
 * 
 * Success Response (200 OK):
 * - user: UserDTO (id, email, created_at)
 * - session: SessionDTO (access_token, refresh_token, expires_at)
 * 
 * Error Responses:
 * - 400: Validation error (invalid email format or empty password)
 * - 401: Invalid credentials (generic message for security)
 * - 429: Rate limit exceeded (too many login attempts)
 * - 500: Internal server error
 * 
 * Security Notes:
 * - Rate limiting is per IP+email to prevent distributed brute force
 * - Error messages are generic to prevent email enumeration
 * - Failed login attempts don't reveal if email exists
 */
export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    // 1. Parse and validate request body first (before rate limiting)
    // This prevents wasting rate limit quota on malformed requests
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(
        400,
        "INVALID_JSON",
        "Request body must be valid JSON"
      );
    }

    const validation = LoginSchema.safeParse(body);
    
    if (!validation.success) {
      // Extract validation errors
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid login data",
        { validation_errors: errors }
      );
    }

    const { email, password } = validation.data;

    // 2. Check rate limit (10 attempts per 15 minutes per IP+email)
    // Using IP+email combination makes it harder to attack specific accounts
    const clientIp = clientAddress || "unknown";
    const rateLimitKey = `${clientIp}:${email}`;

    try {
      await loginRateLimiter.check(rateLimitKey, "auth:login");
    } catch (error) {
      if (error instanceof RateLimitError) {
        return errorResponse(
          429,
          "RATE_LIMIT_EXCEEDED",
          "Too many login attempts. Please try again later.",
          {
            limit: 10,
            reset_at: error.resetAt.toISOString(),
          }
        );
      }
      throw error;
    }

    // 3. Authenticate user through AuthService
    const authService = new AuthService(locals.supabase);
    
    let authResult: AuthResponse;
    try {
      authResult = await authService.login(email, password);
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        // Generic error message for security
        // Don't reveal whether email exists or password is wrong
        return errorResponse(
          401,
          "INVALID_CREDENTIALS",
          "Invalid email or password"
        );
      }

      if (error instanceof AuthServiceError) {
        // Log the error for debugging (but don't expose to user)
        console.error("Login error:", error.code, error.details);
        
        return errorResponse(
          500,
          "LOGIN_FAILED",
          "Failed to log in. Please try again later."
        );
      }

      throw error;
    }

    // 4. Set refresh token as httpOnly cookie for security
    // This prevents XSS attacks from stealing the refresh token
    const refreshToken = authResult.session.refresh_token;
    
    // Calculate cookie expiry (7 days)
    const cookieMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds

    // Note: In production, ensure 'secure' is true (HTTPS only)
    // For localhost development, secure should be false
    const isProduction = import.meta.env.PROD;

    // Create response with auth data
    const response = new Response(
      JSON.stringify(authResult),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          // Add rate limit headers for transparency
          "X-RateLimit-Limit": "10",
          "X-RateLimit-Remaining": loginRateLimiter.getRemaining(rateLimitKey, "auth:login").toString(),
          "X-RateLimit-Reset": loginRateLimiter.getResetAt(rateLimitKey, "auth:login")
            ? Math.floor(loginRateLimiter.getResetAt(rateLimitKey, "auth:login")!.getTime() / 1000).toString()
            : "",
        },
      }
    );

    // Set refresh token cookie
    // httpOnly: true - prevents JavaScript access (XSS protection)
    // secure: true (production) - only sent over HTTPS
    // sameSite: 'lax' - CSRF protection while allowing normal navigation
    // path: '/' - available for all routes
    const cookieHeader = [
      `sb-refresh-token=${refreshToken}`,
      `Max-Age=${cookieMaxAge}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      isProduction ? `Secure` : '',
    ].filter(Boolean).join('; ');

    response.headers.append('Set-Cookie', cookieHeader);

    return response;

  } catch (error) {
    // Catch-all for unexpected errors
    console.error("Unexpected error in login endpoint:", error);
    
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
};

