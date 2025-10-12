/**
 * Study Session Service
 *
 * Handles study session operations and implements the SM-2 (SuperMemo 2)
 * spaced repetition algorithm for flashcard scheduling.
 *
 * SM-2 Algorithm Overview:
 * - Quality ratings: 0-5 (0 = total failure, 5 = perfect recall)
 * - Quality < 3: Failure, reset interval to 0 (review today)
 * - Quality >= 3: Success, increase interval based on ease factor
 * - Ease factor adjusts based on quality (easier/harder over time)
 *
 * Interval progression (for successful reviews):
 * - First review: 1 day
 * - Second review: 6 days
 * - Subsequent reviews: previous_interval * ease_factor
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { FlashcardDTO, StudySessionResponse, StudySessionInfo } from "../../types";
import { DatabaseError } from "../errors/database.error";
import { Logger } from "./logger.service";

const logger = new Logger("StudySessionService");

/**
 * Result of SM-2 calculation
 */
interface SM2Result {
  interval: number;
  easeFactor: number;
  nextReviewAt: Date;
}

/**
 * Study Session Service
 *
 * Manages study sessions and implements the SM-2 spaced repetition algorithm
 */
export class StudySessionService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Gets current study session (flashcards due for review)
   *
   * Returns flashcards that:
   * - Have status 'active'
   * - Have next_review_at <= current time (due now or overdue)
   * - Are ordered by next_review_at ASC (oldest first)
   * - Are limited by the specified limit parameter
   *
   * @param userId - ID of the user
   * @param limit - Maximum number of flashcards to return (default: 20, max: 50)
   * @returns Study session info and list of due flashcards
   * @throws DatabaseError if database operations fail
   */
  async getCurrentSession(userId: string, limit = 20): Promise<StudySessionResponse> {
    try {
      logger.info("Getting current study session", { userId, limit });

      const now = new Date().toISOString();

      // Count total flashcards due for review
      const { count, error: countError } = await this.supabase
        .from("flashcards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "active")
        .lte("next_review_at", now);

      if (countError) {
        logger.error("Failed to count due flashcards", countError as Error);
        throw new DatabaseError("Failed to count due flashcards", countError);
      }

      const totalDue = count || 0;

      // Get flashcards for this session (limited)
      const { data: flashcards, error: flashcardsError } = await this.supabase
        .from("flashcards")
        .select()
        .eq("user_id", userId)
        .eq("status", "active")
        .lte("next_review_at", now)
        .order("next_review_at", { ascending: true })
        .limit(limit);

      if (flashcardsError) {
        logger.error("Failed to get flashcards", flashcardsError as Error);
        throw new DatabaseError("Failed to get flashcards", flashcardsError);
      }

      const flashcardsInSession = (flashcards || []).length;

      const session: StudySessionInfo = {
        flashcards_due: totalDue,
        flashcards_in_session: flashcardsInSession,
      };

      logger.info("Retrieved study session", {
        userId,
        totalDue,
        flashcardsInSession,
      });

      return {
        session,
        flashcards: (flashcards || []).map((fc) => this.mapToDTO(fc)),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in getCurrentSession", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Records a flashcard review and calculates next review date using SM-2
   *
   * The SM-2 algorithm:
   * 1. If quality < 3 (failure):
   *    - Reset interval to 0 (review today)
   *    - Keep ease factor unchanged
   *
   * 2. If quality >= 3 (success):
   *    - Calculate new interval:
   *      - If interval = 0: new interval = 1 day
   *      - If interval = 1: new interval = 6 days
   *      - Otherwise: new interval = interval * ease_factor
   *    - Adjust ease factor:
   *      - EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
   *      - Minimum EF = 1.3
   *
   * 3. Calculate next review date: current_date + interval
   *
   * @param userId - ID of the user (for ownership verification)
   * @param flashcardId - ID of the flashcard being reviewed
   * @param quality - Quality rating (0-5)
   * @returns Updated flashcard with new SM-2 values
   * @throws DatabaseError if flashcard not found or database error
   */
  async review(userId: string, flashcardId: string, quality: number): Promise<FlashcardDTO> {
    try {
      logger.info("Recording flashcard review", { userId, flashcardId, quality });

      // 1. Get current flashcard state
      const { data: flashcard, error: fetchError } = await this.supabase
        .from("flashcards")
        .select()
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !flashcard) {
        logger.warning("Flashcard not found", { userId, flashcardId });
        throw new DatabaseError("Flashcard not found", fetchError);
      }

      // 2. Calculate new SM-2 values
      const currentInterval = flashcard.interval || 0;
      const currentEaseFactor = flashcard.ease_factor || 2.5;

      const sm2Result = this.calculateSM2(currentInterval, currentEaseFactor, quality);

      logger.info("SM-2 calculation result", {
        flashcardId,
        quality,
        oldInterval: currentInterval,
        newInterval: sm2Result.interval,
        oldEaseFactor: currentEaseFactor,
        newEaseFactor: sm2Result.easeFactor,
      });

      // 3. Update flashcard with new values
      const { data: updatedFlashcard, error: updateError } = await this.supabase
        .from("flashcards")
        .update({
          interval: sm2Result.interval,
          ease_factor: sm2Result.easeFactor,
          next_review_at: sm2Result.nextReviewAt.toISOString(),
        })
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .select()
        .single();

      if (updateError || !updatedFlashcard) {
        logger.error("Failed to update flashcard", updateError as Error);
        throw new DatabaseError("Failed to update flashcard", updateError);
      }

      logger.info("Successfully recorded review", {
        userId,
        flashcardId,
        nextReview: sm2Result.nextReviewAt.toISOString(),
      });

      return this.mapToDTO(updatedFlashcard);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in review", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Calculates next review parameters using SM-2 algorithm
   *
   * @param currentInterval - Current interval in days
   * @param currentEaseFactor - Current ease factor (typically 1.3-2.5)
   * @param quality - Quality rating (0-5)
   * @returns New interval, ease factor, and next review date
   * @private
   */
  private calculateSM2(currentInterval: number, currentEaseFactor: number, quality: number): SM2Result {
    let newInterval: number;
    let newEaseFactor = currentEaseFactor;

    // Failed review (quality < 3)
    if (quality < 3) {
      // Reset interval to 0 (review today)
      newInterval = 0;
      // Ease factor remains unchanged on failure
    } else {
      // Successful review (quality >= 3)
      // Calculate new interval based on current interval
      if (currentInterval === 0) {
        // First successful review: 1 day
        newInterval = 1;
      } else if (currentInterval === 1) {
        // Second successful review: 6 days
        newInterval = 6;
      } else {
        // Subsequent reviews: multiply by ease factor
        newInterval = Math.round(currentInterval * currentEaseFactor);
      }

      // Calculate new ease factor
      // Formula: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
      const qualityFactor = 5 - quality;
      const adjustment = 0.1 - qualityFactor * (0.08 + qualityFactor * 0.02);
      newEaseFactor = currentEaseFactor + adjustment;

      // Ensure ease factor doesn't go below 1.3
      newEaseFactor = Math.max(1.3, newEaseFactor);
    }

    // Calculate next review date
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);

    return {
      interval: newInterval,
      easeFactor: Number(newEaseFactor.toFixed(2)), // Round to 2 decimal places
      nextReviewAt,
    };
  }

  /**
   * Maps database entity to FlashcardDTO
   *
   * @private
   */
  private mapToDTO(entity: Database["public"]["Tables"]["flashcards"]["Row"]): FlashcardDTO {
    return {
      id: entity.id,
      user_id: entity.user_id,
      generation_request_id: entity.generation_request_id,
      front: entity.front,
      back: entity.back,
      source: entity.source,
      status: entity.status,
      next_review_at: entity.next_review_at,
      interval: entity.interval,
      ease_factor: entity.ease_factor,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
