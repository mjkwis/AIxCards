/**
 * Generation Requests API Endpoint
 * 
 * POST /api/generation-requests
 * Creates a new AI flashcard generation request
 * 
 * Authentication: Required (JWT Bearer token)
 * Rate Limit: 10 requests per hour per user
 */

import type { APIContext } from "astro";
import { CreateGenerationRequestSchema } from "../../../lib/validation/generation-requests";
import { errorResponse } from "../../../lib/helpers/error-response";
import { aiService } from "../../../lib/services/ai.service";
import { GenerationRequestService } from "../../../lib/services/generation-request.service";
import { AIServiceError } from "../../../lib/errors/ai-service.error";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("POST /api/generation-requests");

/**
 * Disable prerendering for API routes
 * This ensures the endpoint runs on-demand with server-side logic
 */
export const prerender = false;

/**
 * POST handler for creating generation requests
 * 
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Body: { source_text: string } (1000-10000 characters)
 * 
 * Response:
 * - 201: Success with generation_request and flashcards
 * - 400: Validation error
 * - 401: Authentication required or invalid
 * - 422: AI service error
 * - 429: Rate limit exceeded
 * - 500: Internal server error
 * 
 * @param context - Astro API context with locals set by middleware
 * @returns Response with CreateGenerationRequestResponse or ErrorResponse
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
    } catch (error) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON in request body");
    }

    // 3. Validate input with Zod schema
    const validationResult = CreateGenerationRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join(".") || "source_text",
        errors: validationResult.error.errors,
      });
    }

    const { source_text } = validationResult.data;

    logger.info("Processing generation request", {
      userId: user.id,
      textLength: source_text.length,
    });

    // 4. Generate flashcards via AI service
    let flashcardsData;
    try {
      flashcardsData = await aiService.generateFlashcards(source_text);
    } catch (error) {
      if (error instanceof AIServiceError) {
        logger.warning("AI service error", { 
          error: error.message, 
          reason: error.reason 
        });
        return errorResponse(422, "AI_SERVICE_ERROR", error.message, {
          reason: error.reason,
        });
      }
      // Re-throw unexpected errors to be caught by outer catch block
      throw error;
    }

    // 5. Create generation request and flashcards in database
    let result;
    try {
      const generationRequestService = new GenerationRequestService(supabase);
      result = await generationRequestService.create(user.id, source_text, flashcardsData);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logger.error("Database error", error, { userId: user.id });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to save generation request");
      }
      // Re-throw unexpected errors to be caught by outer catch block
      throw error;
    }

    logger.info("Successfully created generation request", {
      userId: user.id,
      generationRequestId: result.generation_request.id,
      flashcardsCount: result.flashcards.length,
    });

    // 6. Return success response with 201 Created
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Catch-all for unexpected errors
    logger.critical("Unexpected error in POST handler", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again later."
    );
  }
}

