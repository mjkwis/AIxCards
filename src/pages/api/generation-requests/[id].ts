/**
 * Generation Request Detail API Endpoint
 *
 * GET /api/generation-requests/:id
 * Gets a specific generation request with all flashcards
 *
 * DELETE /api/generation-requests/:id
 * Deletes a generation request (soft CASCADE - flashcards remain)
 *
 * Authentication: Required (JWT Bearer token)
 * Ownership: User can only access/delete their own generation requests
 */

import type { APIContext } from "astro";
import { errorResponse } from "../../../lib/helpers/error-response";
import { GenerationRequestService } from "../../../lib/services/generation-request.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const getLogger = new Logger("GET /api/generation-requests/:id");
const deleteLogger = new Logger("DELETE /api/generation-requests/:id");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * GET handler for retrieving a specific generation request
 *
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Params: id (UUID of generation request)
 *
 * Response:
 * - 200: Success with generation_request and flashcards
 * - 401: Authentication required or invalid
 * - 404: Generation request not found or doesn't belong to user
 * - 500: Internal server error
 *
 * @param context - Astro API context with locals and params
 * @returns Response with GenerationRequestDetailResponse or ErrorResponse
 */
export async function GET(context: APIContext): Promise<Response> {
  try {
    // 1. Extract context data
    const supabase = context.locals.supabase;
    const user = context.locals.user;
    const requestId = context.params.id;

    // Sanity check - middleware should have validated user
    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // Validate request ID parameter
    if (!requestId) {
      return errorResponse(400, "VALIDATION_ERROR", "Generation request ID is required");
    }

    getLogger.info("Getting generation request", {
      userId: user.id,
      requestId,
    });

    // 2. Get generation request from service
    let result;
    try {
      const generationRequestService = new GenerationRequestService(supabase);
      result = await generationRequestService.getById(user.id, requestId);
    } catch (error) {
      if (error instanceof DatabaseError) {
        // Could be not found or actual database error
        // For simplicity, treat all as 404 (RLS ensures user can only see their own)
        getLogger.warning("Generation request not found or access denied", {
          userId: user.id,
          requestId,
        });
        return errorResponse(404, "NOT_FOUND", "Generation request not found");
      }
      throw error;
    }

    getLogger.info("Successfully retrieved generation request", {
      userId: user.id,
      requestId: result.generation_request.id,
      flashcardsCount: result.flashcards.length,
    });

    // 3. Return success response with 200 OK
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
      requestId: context.params.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  }
}

/**
 * DELETE handler for deleting a generation request
 *
 * Behavior:
 * - Deletes the generation_request record
 * - Flashcards are NOT deleted (soft CASCADE)
 * - Flashcards' generation_request_id is set to NULL
 * - RLS ensures user can only delete their own requests
 *
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Params: id (UUID of generation request)
 *
 * Response:
 * - 204: Success (no content)
 * - 401: Authentication required or invalid
 * - 404: Generation request not found or doesn't belong to user
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
    const requestId = context.params.id;

    // Sanity check - middleware should have validated user
    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // Validate request ID parameter
    if (!requestId) {
      return errorResponse(400, "VALIDATION_ERROR", "Generation request ID is required");
    }

    deleteLogger.info("Deleting generation request", {
      userId: user.id,
      requestId,
    });

    // 2. Delete generation request through service
    try {
      const generationRequestService = new GenerationRequestService(supabase);
      await generationRequestService.delete(user.id, requestId);
    } catch (error) {
      if (error instanceof DatabaseError) {
        // Could be not found or actual database error
        // For simplicity, treat all as 404 (RLS ensures user can only delete their own)
        deleteLogger.warning("Generation request not found or access denied", {
          userId: user.id,
          requestId,
        });
        return errorResponse(404, "NOT_FOUND", "Generation request not found");
      }
      throw error;
    }

    deleteLogger.info("Successfully deleted generation request", {
      userId: user.id,
      requestId,
    });

    // 3. Return success response with 204 No Content
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    // Catch-all for unexpected errors
    deleteLogger.critical("Unexpected error in DELETE handler", error as Error, {
      userId: context.locals.user?.id,
      requestId: context.params.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  }
}
