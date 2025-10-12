/**
 * Statistics Service
 * 
 * Handles calculation of various statistics for the dashboard and analytics:
 * - Overview statistics (total flashcards, active, due, etc.)
 * - Generation statistics (AI performance, approval rates, etc.)
 * 
 * This service performs aggregation queries to provide insights into
 * user's learning progress and AI flashcard generation effectiveness.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  StatisticsOverview,
  GenerationStatistics,
  RecentRequest,
} from "../../types";
import { DatabaseError } from "../errors/database.error";
import { Logger } from "./logger.service";

const logger = new Logger("StatisticsService");

/**
 * Statistics Service
 * 
 * Provides various statistical calculations and aggregations
 * for user dashboard and analytics.
 */
export class StatisticsService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Gets overview statistics for the user's dashboard
   * 
   * Calculates:
   * - Total flashcards and breakdowns by status
   * - Manual vs AI-generated flashcards
   * - AI acceptance rate
   * - Flashcards due today
   * - Total generation requests
   * 
   * Uses parallel queries for better performance.
   * 
   * @param userId - ID of the user
   * @returns Overview statistics
   * @throws DatabaseError if database operations fail
   */
  async getOverview(userId: string): Promise<StatisticsOverview> {
    try {
      logger.info("Calculating overview statistics", { userId });

      // Execute all count queries in parallel for performance
      const [
        totalFlashcards,
        activeFlashcards,
        pendingReviewFlashcards,
        rejectedFlashcards,
        manualFlashcards,
        aiGeneratedFlashcards,
        aiApprovedFlashcards,
        flashcardsDueToday,
        totalGenerationRequests,
      ] = await Promise.all([
        this.countFlashcards(userId),
        this.countFlashcards(userId, { status: "active" }),
        this.countFlashcards(userId, { status: "pending_review" }),
        this.countFlashcards(userId, { status: "rejected" }),
        this.countFlashcards(userId, { source: "manual" }),
        this.countFlashcards(userId, { source: "ai_generated" }),
        this.countFlashcards(userId, { source: "ai_generated", status: "active" }),
        this.countDueFlashcards(userId),
        this.countGenerationRequests(userId),
      ]);

      // Calculate AI acceptance rate
      // Only count flashcards that have been evaluated (active or rejected)
      // Exclude pending_review from the calculation
      const aiProcessedFlashcards = aiApprovedFlashcards + rejectedFlashcards;
      const aiAcceptanceRate = aiProcessedFlashcards > 0 
        ? aiApprovedFlashcards / aiProcessedFlashcards 
        : 0;

      // Note: total_reviews_completed would require a review_history table
      // For now, we set it to 0 as a placeholder
      const totalReviewsCompleted = 0;

      const statistics: StatisticsOverview = {
        total_flashcards: totalFlashcards,
        active_flashcards: activeFlashcards,
        pending_review_flashcards: pendingReviewFlashcards,
        rejected_flashcards: rejectedFlashcards,
        manual_flashcards: manualFlashcards,
        ai_generated_flashcards: aiGeneratedFlashcards,
        ai_acceptance_rate: Math.round(aiAcceptanceRate * 100) / 100, // Round to 2 decimal places
        flashcards_due_today: flashcardsDueToday,
        total_generation_requests: totalGenerationRequests,
        total_reviews_completed: totalReviewsCompleted,
      };

      logger.info("Overview statistics calculated", { userId, statistics });

      return statistics;
    } catch (error) {
      logger.error("Unexpected error in getOverview", error as Error);
      throw new DatabaseError("Failed to calculate overview statistics", error);
    }
  }

  /**
   * Gets detailed generation statistics (AI performance metrics)
   * 
   * Calculates:
   * - Total AI-generated flashcards
   * - Approved and rejected counts
   * - Approval rate
   * - Average flashcards per generation request
   * - Recent requests history (last 30 days)
   * 
   * @param userId - ID of the user
   * @returns Generation statistics
   * @throws DatabaseError if database operations fail
   */
  async getGenerationStatistics(userId: string): Promise<GenerationStatistics> {
    try {
      logger.info("Calculating generation statistics", { userId });

      // Count AI flashcards by status
      const [totalGenerated, totalApproved, totalRejected, totalRequests] = await Promise.all([
        this.countFlashcards(userId, { source: "ai_generated" }),
        this.countFlashcards(userId, { source: "ai_generated", status: "active" }),
        this.countFlashcards(userId, { source: "ai_generated", status: "rejected" }),
        this.countGenerationRequests(userId),
      ]);

      // Calculate approval rate (excluding pending_review)
      const evaluated = totalApproved + totalRejected;
      const approvalRate = evaluated > 0 ? totalApproved / evaluated : 0;

      // Calculate average flashcards per request
      const averageFlashcardsPerRequest = totalRequests > 0 
        ? totalGenerated / totalRequests 
        : 0;

      // Get recent requests history (last 30 days)
      const recentRequests = await this.getRecentRequestsHistory(userId, 30);

      const statistics: GenerationStatistics = {
        total_generated: totalGenerated,
        total_approved: totalApproved,
        total_rejected: totalRejected,
        approval_rate: Math.round(approvalRate * 100) / 100,
        average_flashcards_per_request: Math.round(averageFlashcardsPerRequest * 10) / 10,
        recent_requests: recentRequests,
      };

      logger.info("Generation statistics calculated", { userId, statistics });

      return statistics;
    } catch (error) {
      logger.error("Unexpected error in getGenerationStatistics", error as Error);
      throw new DatabaseError("Failed to calculate generation statistics", error);
    }
  }

  /**
   * Counts flashcards with optional filters
   * 
   * @param userId - ID of the user
   * @param filters - Optional status and/or source filters
   * @returns Count of matching flashcards
   * @private
   */
  private async countFlashcards(
    userId: string,
    filters?: { status?: string; source?: string }
  ): Promise<number> {
    try {
      let query = this.supabase
        .from("flashcards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.source) {
        query = query.eq("source", filters.source);
      }

      const { count, error } = await query;

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error("Error counting flashcards", error as Error, { userId, filters });
      throw new DatabaseError("Failed to count flashcards", error);
    }
  }

  /**
   * Counts flashcards that are due for review today
   * 
   * @param userId - ID of the user
   * @returns Count of due flashcards
   * @private
   */
  private async countDueFlashcards(userId: string): Promise<number> {
    try {
      const now = new Date().toISOString();

      const { count, error } = await this.supabase
        .from("flashcards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active")
        .lte("next_review_at", now);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error("Error counting due flashcards", error as Error, { userId });
      throw new DatabaseError("Failed to count due flashcards", error);
    }
  }

  /**
   * Counts total generation requests for the user
   * 
   * @param userId - ID of the user
   * @returns Count of generation requests
   * @private
   */
  private async countGenerationRequests(userId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from("generation_requests")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      logger.error("Error counting generation requests", error as Error, { userId });
      throw new DatabaseError("Failed to count generation requests", error);
    }
  }

  /**
   * Gets recent generation requests history with daily aggregation
   * 
   * Returns data for the last N days with:
   * - Number of generation requests per day
   * - Total flashcards generated per day
   * - Total flashcards approved per day
   * 
   * @param userId - ID of the user
   * @param days - Number of days to look back (default: 30)
   * @returns Array of recent request data points
   * @private
   */
  private async getRecentRequestsHistory(userId: string, days: number = 30): Promise<RecentRequest[]> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const startDateStr = startDate.toISOString().split("T")[0]; // YYYY-MM-DD

      // Get all generation requests from the last N days with their flashcards
      const { data: requests, error } = await this.supabase
        .from("generation_requests")
        .select(`
          id,
          created_at,
          flashcards (
            id,
            status
          )
        `)
        .eq("user_id", userId)
        .gte("created_at", startDateStr)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      // Group by date and aggregate
      const dailyMap = new Map<string, RecentRequest>();

      for (const request of requests || []) {
        const date = request.created_at.split("T")[0]; // Extract YYYY-MM-DD

        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            requests: 0,
            flashcards_generated: 0,
            flashcards_approved: 0,
          });
        }

        const dayData = dailyMap.get(date)!;
        dayData.requests += 1;

        // Count flashcards
        const flashcards = Array.isArray(request.flashcards) ? request.flashcards : [];
        dayData.flashcards_generated += flashcards.length;
        dayData.flashcards_approved += flashcards.filter((fc: any) => fc.status === "active").length;
      }

      // Convert map to array and sort by date descending
      const recentRequests = Array.from(dailyMap.values())
        .sort((a, b) => b.date.localeCompare(a.date));

      return recentRequests;
    } catch (error) {
      logger.error("Error getting recent requests history", error as Error, { userId, days });
      throw new DatabaseError("Failed to get recent requests history", error);
    }
  }
}

