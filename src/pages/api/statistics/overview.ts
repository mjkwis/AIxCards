/**
 * GET /api/statistics/overview
 * 
 * Get overview statistics for the user's dashboard
 * 
 * This endpoint provides high-level statistics about the user's flashcards,
 * learning progress, and AI generation performance. It's designed to power
 * the main dashboard view.
 * 
 * Metrics included:
 * - Total flashcards and breakdowns by status (active, pending, rejected)
 * - Manual vs AI-generated flashcards
 * - AI acceptance rate
 * - Flashcards due today
 * - Total generation requests
 * - Total reviews completed (placeholder for future feature)
 * 
 * Authentication: Required (JWT Bearer token)
 * 
 * Performance: Queries are executed in parallel for optimal response time.
 * Consider caching this endpoint (5 minutes) in production.
 */

import type { APIContext } from "astro";
import { errorResponse } from "../../../lib/helpers/error-response";
import { StatisticsService } from "../../../lib/services/statistics.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("GET /api/statistics/overview");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * GET handler for overview statistics
 * 
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Query: None
 * 
 * Response:
 * - 200: Success with overview statistics
 * - 401: Authentication required or invalid
 * - 500: Internal server error
 * 
 * @param context - Astro API context with locals
 * @returns Response with StatisticsOverviewResponse or ErrorResponse
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

    logger.info("Getting overview statistics", {
      userId: user.id,
    });

    // 2. Get statistics from service
    let statistics;
    try {
      const statisticsService = new StatisticsService(supabase);
      statistics = await statisticsService.getOverview(user.id);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logger.error("Database error", error, { userId: user.id });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to retrieve statistics");
      }
      throw error;
    }

    logger.info("Successfully retrieved overview statistics", {
      userId: user.id,
      totalFlashcards: statistics.total_flashcards,
      activeFlashcards: statistics.active_flashcards,
    });

    // 3. Return success response with 200 OK
    return new Response(
      JSON.stringify({ statistics }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
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

