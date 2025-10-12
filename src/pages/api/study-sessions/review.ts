/**
 * POST /api/study-sessions/review
 *
 * Submit a flashcard review and calculate next review date using SM-2 algorithm
 *
 * This endpoint implements the SM-2 (SuperMemo 2) spaced repetition algorithm
 * to calculate when a flashcard should be reviewed next based on the user's
 * recall quality.
 *
 * SM-2 Algorithm:
 * - Quality 0-2 (failure): Reset interval to 0 (review today)
 * - Quality 3-5 (success): Increase interval based on ease factor
 * - Ease factor adjusts over time based on recall quality
 *
 * Interval progression (successful reviews):
 * - First review: 1 day
 * - Second review: 6 days
 * - Subsequent: previous_interval * ease_factor
 *
 * Authentication: Required (JWT Bearer token)
 */

import type { APIContext } from "astro";
import { ReviewFlashcardSchema } from "../../../lib/validation/study-sessions";
import { errorResponse } from "../../../lib/helpers/error-response";
import { StudySessionService } from "../../../lib/services/study-session.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("POST /api/study-sessions/review");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * POST handler for submitting a flashcard review
 *
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Body: { flashcard_id: string, quality: number (0-5) }
 *
 * Quality rating scale (SM-2):
 * - 0: Complete blackout (total failure)
 * - 1: Incorrect response; correct answer remembered
 * - 2: Incorrect response; correct answer seemed easy to recall
 * - 3: Correct response recalled with serious difficulty
 * - 4: Correct response after some hesitation
 * - 5: Perfect response (immediate recall)
 *
 * Response:
 * - 200: Success with updated flashcard (new interval, ease_factor, next_review_at)
 * - 400: Validation error
 * - 401: Authentication required or invalid
 * - 404: Flashcard not found or doesn't belong to user
 * - 500: Internal server error
 *
 * @param context - Astro API context with locals
 * @returns Response with FlashcardResponse or ErrorResponse
 */
export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Extract context data
    const supabase = context.locals.supabase;
    const user = context.locals.user;

    // Sanity check - middleware should have validated user
    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // 2. Parse request body
    let requestBody: unknown;
    try {
      requestBody = await context.request.json();
    } catch {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON in request body");
    }

    // 3. Validate input with Zod schema
    const validationResult = ReviewFlashcardSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        errors: validationResult.error.errors,
      });
    }

    const { flashcard_id, quality } = validationResult.data;

    logger.info("Submitting flashcard review", {
      userId: user.id,
      flashcardId: flashcard_id,
      quality,
    });

    // 4. Process review through service (SM-2 algorithm)
    let flashcard;
    try {
      const studySessionService = new StudySessionService(supabase);
      flashcard = await studySessionService.review(user.id, flashcard_id, quality);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logger.warning("Flashcard not found or access denied", {
          userId: user.id,
          flashcardId: flashcard_id,
        });
        return errorResponse(404, "NOT_FOUND", "Flashcard not found");
      }
      throw error;
    }

    logger.info("Successfully processed review", {
      userId: user.id,
      flashcardId: flashcard.id,
      newInterval: flashcard.interval,
      newEaseFactor: flashcard.ease_factor,
      nextReviewAt: flashcard.next_review_at,
    });

    // 5. Return success response with 200 OK
    return new Response(JSON.stringify({ flashcard }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Catch-all for unexpected errors
    logger.critical("Unexpected error in POST handler", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  }
}
