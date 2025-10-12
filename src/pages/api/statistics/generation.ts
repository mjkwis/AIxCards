/**
 * GET /api/statistics/generation
 * 
 * Get detailed statistics about AI flashcard generation
 * 
 * This endpoint provides in-depth metrics about the AI flashcard generation
 * performance, including approval rates, averages, and historical data.
 * It's designed to help users understand how well the AI is performing.
 * 
 * Metrics included:
 * - Total AI-generated flashcards
 * - Total approved and rejected
 * - Approval rate (approved / evaluated)
 * - Average flashcards per generation request
 * - Recent requests history (last 30 days with daily breakdown)
 * 
 * Authentication: Required (JWT Bearer token)
 * 
 * Performance: Uses aggregation queries and may be cached in production.
 */

import type { APIContext } from "astro";
import { errorResponse } from "../../../lib/helpers/error-response";
import { StatisticsService } from "../../../lib/services/statistics.service";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("GET /api/statistics/generation");

/**
 * Disable prerendering for API routes
 */
export const prerender = false;

/**
 * GET handler for generation statistics
 * 
 * Request:
 * - Headers: Authorization: Bearer {token}
 * - Query: None
 * 
 * Response:
 * - 200: Success with generation statistics
 * - 401: Authentication required or invalid
 * - 500: Internal server error
 * 
 * @param context - Astro API context with locals
 * @returns Response with GenerationStatisticsResponse or ErrorResponse
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

    logger.info("Getting generation statistics", {
      userId: user.id,
    });

    // 2. Get statistics from service
    let statistics;
    try {
      const statisticsService = new StatisticsService(supabase);
      statistics = await statisticsService.getGenerationStatistics(user.id);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logger.error("Database error", error, { userId: user.id });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to retrieve generation statistics");
      }
      throw error;
    }

    logger.info("Successfully retrieved generation statistics", {
      userId: user.id,
      totalGenerated: statistics.total_generated,
      approvalRate: statistics.approval_rate,
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

