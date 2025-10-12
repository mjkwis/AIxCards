/**
 * POST /api/flashcards/batch-approve
 *
 * Batch approve multiple AI-generated flashcards
 *
 * This endpoint allows approving up to 50 flashcards in a single operation.
 * It returns both successful and failed approvals, allowing for partial success.
 *
 * Features:
 * - Approves multiple flashcards at once (max 50)
 * - Each flashcard: pending_review → active, next_review_at = NOW
 * - Returns detailed results: approved IDs and failed with reasons
 * - Partial success: some can succeed while others fail
 *
 * Use case:
 * - Quickly approve multiple AI-generated flashcards after review
 * - Bulk operations on generation request results
 *
 * Authentication: Required (JWT Bearer token)
 * Ownership: User can only approve their own flashcards
 */

import type { APIContext } from "astro";
import { BatchApproveSchema } from "../../../lib/validation/flashcards";
import { errorResponse } from "../../../lib/helpers/error-response";
import { FlashcardService } from "../../../lib/services/flashcard.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("POST /api/flashcards/batch-approve");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * POST handler for batch approving flashcards
 *
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Body: { flashcard_ids: string[] } (1-50 UUIDs)
 *
 * Response:
 * - 200: Success with approved and failed lists
 * - 400: Validation error (invalid IDs, too many, etc.)
 * - 401: Authentication required or invalid
 * - 500: Internal server error
 *
 * Success response format:
 * {
 *   "approved": ["id1", "id2", ...],
 *   "failed": [
 *     { "id": "id3", "reason": "Not in pending_review status" },
 *     { "id": "id4", "reason": "Flashcard not found" }
 *   ]
 * }
 *
 * Note: Returns 200 even if some/all approvals fail.
 * Check the approved/failed arrays to determine success per flashcard.
 *
 * @param context - Astro API context with locals
 * @returns Response with BatchApproveResponse or ErrorResponse
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
    const validationResult = BatchApproveSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        errors: validationResult.error.errors,
      });
    }

    const { flashcard_ids } = validationResult.data;

    logger.info("Batch approving flashcards", {
      userId: user.id,
      count: flashcard_ids.length,
    });

    // 4. Batch approve through service
    let result;
    try {
      const flashcardService = new FlashcardService(supabase);
      result = await flashcardService.batchApprove(user.id, flashcard_ids);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logger.error("Database error during batch approve", error, { userId: user.id });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to batch approve flashcards");
      }
      throw error;
    }

    logger.info("Batch approve completed", {
      userId: user.id,
      total: flashcard_ids.length,
      approved: result.approved.length,
      failed: result.failed.length,
    });

    // 5. Return success response with 200 OK
    // Note: Returns 200 even if some/all approvals failed
    // Client should check approved/failed arrays
    return new Response(JSON.stringify(result), {
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
