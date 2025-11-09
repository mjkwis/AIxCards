/**
 * Flashcards API Endpoint
 *
 * POST /api/flashcards
 * Creates a new manual flashcard
 *
 * GET /api/flashcards
 * Lists flashcards with pagination and filtering
 *
 * Authentication: Required (JWT Bearer token)
 */

import type { APIContext } from "astro";
import { CreateFlashcardSchema, FlashcardsListQuerySchema } from "../../../lib/validation/flashcards";
import { errorResponse } from "../../../lib/helpers/error-response";
import { FlashcardService } from "../../../lib/services/flashcard.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const postLogger = new Logger("POST /api/flashcards");
const getLogger = new Logger("GET /api/flashcards");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * POST handler for creating manual flashcards
 *
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Body: { front: string, back: string }
 *
 * Response:
 * - 201: Success with created flashcard
 * - 400: Validation error
 * - 401: Authentication required or invalid
 * - 500: Internal server error
 *
 * Manual flashcards are created with:
 * - source: "manual"
 * - status: "active" (no review needed)
 * - next_review_at: NOW (due immediately)
 * - interval: 0, ease_factor: 2.5 (SM-2 defaults)
 *
 * @param context - Astro API context with locals set by middleware
 * @returns Response with FlashcardResponse or ErrorResponse
 */
export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Extract context data (set by middleware)
    const supabase = context.locals.supabase;
    const user = context.locals.user;

    // Sanity check - middleware should have validated this
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
    const validationResult = CreateFlashcardSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        errors: validationResult.error.errors,
      });
    }

    const { front, back } = validationResult.data;

    postLogger.info("Creating manual flashcard", {
      userId: user.id,
      frontLength: front.length,
      backLength: back.length,
    });

    // 4. Create flashcard through service
    let flashcard;
    try {
      const flashcardService = new FlashcardService(supabase);
      flashcard = await flashcardService.create(user.id, { front, back });
    } catch (error) {
      postLogger.error("Caught error in flashcard creation", error, {
        userId: user.id,
        errorType: typeof error,
        errorName: error?.constructor?.name,
        errorMessage: (error as { message?: string })?.message,
        isDatabaseError: error instanceof DatabaseError,
      });

      if (error instanceof DatabaseError) {
        // For debugging, always show the actual error message
        const errorMessage = error.message || "Failed to create flashcard (DatabaseError)";
        return errorResponse(500, "INTERNAL_ERROR", errorMessage);
      }

      // Handle other types of errors
      const errorMessage = (error as { message?: string })?.message || "Failed to create flashcard (unknown error)";
      return errorResponse(500, "INTERNAL_ERROR", errorMessage);
    }

    postLogger.info("Successfully created flashcard", {
      userId: user.id,
      flashcardId: flashcard.id,
    });

    // 5. Return success response with 201 Created
    return new Response(JSON.stringify({ flashcard }), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Catch-all for unexpected errors
    postLogger.critical("Unexpected error in POST handler", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  }
}

/**
 * GET handler for listing flashcards
 *
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Query: ?page=1&limit=20&status=active&source=manual&sort=created_at&order=desc
 *
 * Response:
 * - 200: Success with flashcards list and pagination
 * - 400: Invalid query parameters
 * - 401: Authentication required or invalid
 * - 500: Internal server error
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by status (optional: active, pending_review, rejected)
 * - source: Filter by source (optional: manual, ai_generated)
 * - sort: Sort field (default: created_at)
 * - order: Sort order (default: desc)
 *
 * @param context - Astro API context with locals set by middleware
 * @returns Response with FlashcardsListResponse or ErrorResponse
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    // 1. Extract context data (set by middleware)
    const supabase = context.locals.supabase;
    const user = context.locals.user;

    // Sanity check - middleware should have validated this
    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // 2. Parse and validate query parameters
    const url = new URL(context.request.url);
    const queryParams = {
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
      status: url.searchParams.get("status"),
      source: url.searchParams.get("source"),
      sort: url.searchParams.get("sort"),
      order: url.searchParams.get("order"),
    };

    const validationResult = FlashcardsListQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      getLogger.error("Query validation failed", new Error(firstError.message), {
        queryParams,
        errors: validationResult.error.errors,
      });
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        errors: validationResult.error.errors,
      });
    }

    const { page, limit, status, source, sort, order } = validationResult.data;

    getLogger.info("Listing flashcards", {
      userId: user.id,
      page,
      limit,
      status,
      source,
      sort,
      order,
    });

    // 3. Get flashcards from service
    let result;
    try {
      const flashcardService = new FlashcardService(supabase);
      result = await flashcardService.list(user.id, page, limit, status, source, sort, order);
    } catch (error) {
      if (error instanceof DatabaseError) {
        getLogger.error("Database error", error, { userId: user.id });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to retrieve flashcards");
      }
      throw error;
    }

    getLogger.info("Successfully retrieved flashcards", {
      userId: user.id,
      count: result.flashcards.length,
      total: result.pagination.total,
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
    getLogger.critical("Unexpected error in GET handler", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  }
}
