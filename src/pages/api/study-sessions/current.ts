/**
 * GET /api/study-sessions/current
 * 
 * Get current study session with flashcards due for review
 * 
 * This endpoint returns flashcards that are due for review based on the
 * spaced repetition schedule. Flashcards are returned in order of when
 * they became due (oldest first).
 * 
 * Features:
 * - Returns flashcards with status 'active' and next_review_at <= NOW
 * - Ordered by next_review_at ASC (prioritizes overdue flashcards)
 * - Configurable limit (default: 20, max: 50)
 * - Includes session metadata (total due, flashcards in response)
 * 
 * Authentication: Required (JWT Bearer token)
 */

import type { APIContext } from "astro";
import { StudySessionQuerySchema } from "../../../lib/validation/study-sessions";
import { errorResponse } from "../../../lib/helpers/error-response";
import { StudySessionService } from "../../../lib/services/study-session.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("GET /api/study-sessions/current");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * GET handler for retrieving current study session
 * 
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Query: ?limit=20 (optional)
 * 
 * Response:
 * - 200: Success with study session info and flashcards
 * - 400: Invalid query parameters
 * - 401: Authentication required or invalid
 * - 500: Internal server error
 * 
 * @param context - Astro API context with locals
 * @returns Response with StudySessionResponse or ErrorResponse
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    // 1. Extract context data
    const supabase = context.locals.supabase;
    const user = context.locals.user;

    // Sanity check - middleware should have validated user
    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // 2. Parse and validate query parameters
    const url = new URL(context.request.url);
    const queryParams = {
      limit: url.searchParams.get("limit"),
    };

    const validationResult = StudySessionQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        errors: validationResult.error.errors,
      });
    }

    const { limit } = validationResult.data;

    logger.info("Getting current study session", {
      userId: user.id,
      limit,
    });

    // 3. Get study session from service
    let result;
    try {
      const studySessionService = new StudySessionService(supabase);
      result = await studySessionService.getCurrentSession(user.id, limit);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logger.error("Database error", error, { userId: user.id });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to retrieve study session");
      }
      throw error;
    }

    logger.info("Successfully retrieved study session", {
      userId: user.id,
      totalDue: result.session.flashcards_due,
      flashcardsInSession: result.session.flashcards_in_session,
    });

    // 4. Return success response with 200 OK
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Catch-all for unexpected errors
    logger.critical("Unexpected error in GET handler", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
}

