/**
 * POST /api/flashcards/:id/reject
 *
 * Reject an AI-generated flashcard
 *
 * This endpoint changes the status of a flashcard from 'pending_review' to 'rejected'
 * and removes it from the review schedule by setting next_review_at to NULL.
 *
 * Workflow:
 * - Only works on flashcards with status 'pending_review'
 * - Changes status to 'rejected'
 * - Sets next_review_at to NULL (not scheduled)
 * - Flashcard remains in database for statistics
 *
 * Authentication: Required (JWT Bearer token)
 * Ownership: User can only reject their own flashcards
 */

import type { APIContext } from "astro";
import { errorResponse } from "../../../../lib/helpers/error-response";
import { FlashcardService } from "../../../../lib/services/flashcard.service";
import { DatabaseError } from "../../../../lib/errors/database.error";
import { Logger } from "../../../../lib/services/logger.service";

const logger = new Logger("POST /api/flashcards/:id/reject");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * POST handler for rejecting a flashcard
 *
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Params: id (UUID of flashcard)
 * - Body: None
 *
 * Response:
 * - 200: Success with rejected flashcard
 * - 400: Flashcard is not in pending_review status
 * - 401: Authentication required or invalid
 * - 404: Flashcard not found or doesn't belong to user
 * - 500: Internal server error
 *
 * @param context - Astro API context with locals and params
 * @returns Response with FlashcardResponse or ErrorResponse
 */
export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Extract context data
    const supabase = context.locals.supabase;
    const user = context.locals.user;
    const flashcardId = context.params.id;

    // Sanity check - middleware should have validated user
    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // Validate flashcard ID parameter
    if (!flashcardId) {
      return errorResponse(400, "VALIDATION_ERROR", "Flashcard ID is required");
    }

    logger.info("Rejecting flashcard", {
      userId: user.id,
      flashcardId,
    });

    // 2. Reject flashcard through service
    let flashcard;
    try {
      const flashcardService = new FlashcardService(supabase);
      flashcard = await flashcardService.reject(user.id, flashcardId);
    } catch (error) {
      if (error instanceof DatabaseError) {
        // Check if error message indicates wrong status
        if (error.message.includes("not in pending_review status")) {
          logger.warning("Flashcard is not in pending_review status", {
            userId: user.id,
            flashcardId,
          });
          return errorResponse(400, "INVALID_STATUS", "Flashcard is not in pending_review status");
        }

        // Otherwise, it's a not found error
        logger.warning("Flashcard not found or access denied", {
          userId: user.id,
          flashcardId,
        });
        return errorResponse(404, "NOT_FOUND", "Flashcard not found");
      }
      throw error;
    }

    logger.info("Successfully rejected flashcard", {
      userId: user.id,
      flashcardId: flashcard.id,
    });

    // 3. Return success response with 200 OK
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
      flashcardId: context.params.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  }
}
