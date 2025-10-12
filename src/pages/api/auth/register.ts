/**
 * POST /api/auth/register
 * 
 * Register a new user account
 * 
 * This endpoint allows new users to create an account by providing
 * an email and password. Upon successful registration, the user
 * receives JWT tokens for immediate authentication.
 * 
 * Features:
 * - Email format and normalization validation
 * - Strong password requirements
 * - Rate limiting (5 requests per hour per IP)
 * - Duplicate email detection
 * - Automatic session creation
 * 
 * Security:
 * - Public endpoint (no authentication required)
 * - Rate limited to prevent abuse
 * - Passwords are hashed by Supabase Auth (bcrypt)
 * - httpOnly cookies for refresh tokens
 */

import type { APIRoute } from "astro";
import { RegisterSchema } from "../../../lib/validation/auth";
import { AuthService, EmailAlreadyRegisteredError, AuthServiceError } from "../../../lib/services/auth.service";
import { errorResponse } from "../../../lib/helpers/error-response";
import { RateLimitService } from "../../../lib/services/rate-limit.service";
import { RateLimitError } from "../../../lib/errors/rate-limit.error";
import type { AuthResponse } from "../../../types";

// Rate limiter for registration: 5 requests per hour per IP
const registerRateLimiter = new RateLimitService(5, 3600000); // 1 hour in milliseconds

/**
 * POST handler for user registration
 * 
 * Request Body:
 * - email: string (valid email format, max 255 chars)
 * - password: string (min 8 chars, uppercase, lowercase, number)
 * 
 * Success Response (201 Created):
 * - user: UserDTO (id, email, created_at)
 * - session: SessionDTO (access_token, refresh_token, expires_at)
 * 
 * Error Responses:
 * - 400: Validation error (invalid email/password format)
 * - 409: Email already registered
 * - 429: Rate limit exceeded (too many registration attempts)
 * - 500: Internal server error
 */
export const POST: APIRoute = async ({ request, locals, clientAddress }) => {
  try {
    // 1. Get client IP for rate limiting
    const clientIp = clientAddress || "unknown";

    // 2. Check rate limit (5 registrations per hour per IP)
    try {
      await registerRateLimiter.check(clientIp, "auth:register");
    } catch (error) {
      if (error instanceof RateLimitError) {
        return errorResponse(
          429,
          "RATE_LIMIT_EXCEEDED",
          "Too many registration attempts. Please try again later.",
          {
            limit: 5,
            reset_at: error.resetAt.toISOString(),
          }
        );
      }
      throw error;
    }

    // 3. Parse and validate request body
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

    const validation = RegisterSchema.safeParse(body);
    
    if (!validation.success) {
      // Extract validation errors
      const errors = validation.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));

      return errorResponse(
        400,
        "VALIDATION_ERROR",
        "Invalid registration data",
        { validation_errors: errors }
      );
    }

    const { email, password } = validation.data;

    // 4. Register user through AuthService
    const authService = new AuthService(locals.supabase);
    
    let authResult: AuthResponse;
    try {
      authResult = await authService.register(email, password);
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) {
        return errorResponse(
          409,
          "EMAIL_ALREADY_REGISTERED",
          "An account with this email address already exists"
        );
      }

      if (error instanceof AuthServiceError) {
        // Log the error for debugging
        console.error("Registration error:", error.code, error.details);
        
        return errorResponse(
          500,
          "REGISTRATION_FAILED",
          "Failed to create account. Please try again later."
        );
      }

      throw error;
    }

    // 5. Set refresh token as httpOnly cookie for security
    // This prevents XSS attacks from stealing the refresh token
    const refreshToken = authResult.session.refresh_token;
    
    // Calculate cookie expiry (7 days)
    const cookieMaxAge = 60 * 60 * 24 * 7; // 7 days in seconds

    // Note: In production, ensure 'secure' is true (HTTPS only)
    // For localhost development, secure should be false
    const isProduction = import.meta.env.PROD;

    // Set the refresh token cookie
    // This will be used for token refresh without exposing it to JavaScript
    const response = new Response(
      JSON.stringify(authResult),
      {
        status: 201,
        headers: {
          "Content-Type": "application/json",
          // Add rate limit headers
          "X-RateLimit-Limit": "5",
          "X-RateLimit-Remaining": registerRateLimiter.getRemaining(clientIp, "auth:register").toString(),
          "X-RateLimit-Reset": registerRateLimiter.getResetAt(clientIp, "auth:register")
            ? Math.floor(registerRateLimiter.getResetAt(clientIp, "auth:register")!.getTime() / 1000).toString()
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
    console.error("Unexpected error in registration endpoint:", error);
    
    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
};

