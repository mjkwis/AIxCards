/**
 * Flashcard Detail API Endpoint
 * 
 * GET /api/flashcards/:id
 * Gets a specific flashcard
 * 
 * PATCH /api/flashcards/:id
 * Updates a flashcard
 * 
 * DELETE /api/flashcards/:id
 * Deletes a flashcard permanently
 * 
 * Authentication: Required (JWT Bearer token)
 * Ownership: User can only access/modify their own flashcards
 */

import type { APIContext } from "astro";
import { UpdateFlashcardSchema } from "../../../lib/validation/flashcards";
import { errorResponse } from "../../../lib/helpers/error-response";
import { FlashcardService } from "../../../lib/services/flashcard.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const getLogger = new Logger("GET /api/flashcards/:id");
const patchLogger = new Logger("PATCH /api/flashcards/:id");
const deleteLogger = new Logger("DELETE /api/flashcards/:id");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * GET handler for retrieving a specific flashcard
 * 
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Params: id (UUID of flashcard)
 * 
 * Response:
 * - 200: Success with flashcard
 * - 401: Authentication required or invalid
 * - 404: Flashcard not found or doesn't belong to user
 * - 500: Internal server error
 * 
 * @param context - Astro API context with locals and params
 * @returns Response with FlashcardResponse or ErrorResponse
 */
export async function GET(context: APIContext): Promise<Response> {
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

    getLogger.info("Getting flashcard", {
      userId: user.id,
      flashcardId,
    });

    // 2. Get flashcard from service
    let flashcard;
    try {
      const flashcardService = new FlashcardService(supabase);
      flashcard = await flashcardService.getById(user.id, flashcardId);
    } catch (error) {
      if (error instanceof DatabaseError) {
        getLogger.warning("Flashcard not found or access denied", {
          userId: user.id,
          flashcardId,
        });
        return errorResponse(404, "NOT_FOUND", "Flashcard not found");
      }
      throw error;
    }

    getLogger.info("Successfully retrieved flashcard", {
      userId: user.id,
      flashcardId: flashcard.id,
    });

    // 3. Return success response with 200 OK
    return new Response(
      JSON.stringify({ flashcard }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    // Catch-all for unexpected errors
    getLogger.critical("Unexpected error in GET handler", error as Error, {
      userId: context.locals.user?.id,
      flashcardId: context.params.id,
    });

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
}

/**
 * PATCH handler for updating a flashcard
 * 
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Params: id (UUID of flashcard)
 * - Body: { front?: string, back?: string, status?: string }
 * 
 * Response:
 * - 200: Success with updated flashcard
 * - 400: Validation error
 * - 401: Authentication required or invalid
 * - 404: Flashcard not found or doesn't belong to user
 * - 500: Internal server error
 * 
 * At least one field must be provided for update.
 * 
 * @param context - Astro API context with locals and params
 * @returns Response with FlashcardResponse or ErrorResponse
 */
export async function PATCH(context: APIContext): Promise<Response> {
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

    // 2. Parse request body
    let requestBody: unknown;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON in request body");
    }

    // 3. Validate input with Zod schema
    const validationResult = UpdateFlashcardSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        errors: validationResult.error.errors,
      });
    }

    patchLogger.info("Updating flashcard", {
      userId: user.id,
      flashcardId,
      updates: Object.keys(validationResult.data),
    });

    // 4. Update flashcard through service
    let flashcard;
    try {
      const flashcardService = new FlashcardService(supabase);
      flashcard = await flashcardService.update(user.id, flashcardId, validationResult.data);
    } catch (error) {
      if (error instanceof DatabaseError) {
        patchLogger.warning("Failed to update flashcard", {
          userId: user.id,
          flashcardId,
        });
        return errorResponse(404, "NOT_FOUND", "Flashcard not found");
      }
      throw error;
    }

    patchLogger.info("Successfully updated flashcard", {
      userId: user.id,
      flashcardId: flashcard.id,
    });

    // 5. Return success response with 200 OK
    return new Response(
      JSON.stringify({ flashcard }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    // Catch-all for unexpected errors
    patchLogger.critical("Unexpected error in PATCH handler", error as Error, {
      userId: context.locals.user?.id,
      flashcardId: context.params.id,
    });

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
}

/**
 * DELETE handler for deleting a flashcard
 * 
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Params: id (UUID of flashcard)
 * 
 * Response:
 * - 204: Success (no content)
 * - 401: Authentication required or invalid
 * - 404: Flashcard not found or doesn't belong to user
 * - 500: Internal server error
 * 
 * @param context - Astro API context with locals and params
 * @returns Response (204 No Content or ErrorResponse)
 */
export async function DELETE(context: APIContext): Promise<Response> {
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

    deleteLogger.info("Deleting flashcard", {
      userId: user.id,
      flashcardId,
    });

    // 2. Delete flashcard through service
    try {
      const flashcardService = new FlashcardService(supabase);
      await flashcardService.delete(user.id, flashcardId);
    } catch (error) {
      if (error instanceof DatabaseError) {
        deleteLogger.warning("Flashcard not found or access denied", {
          userId: user.id,
          flashcardId,
        });
        return errorResponse(404, "NOT_FOUND", "Flashcard not found");
      }
      throw error;
    }

    deleteLogger.info("Successfully deleted flashcard", {
      userId: user.id,
      flashcardId,
    });

    // 3. Return success response with 204 No Content
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    // Catch-all for unexpected errors
    deleteLogger.critical("Unexpected error in DELETE handler", error as Error, {
      userId: context.locals.user?.id,
      flashcardId: context.params.id,
    });

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
}

