/**
 * Validation schemas for study sessions endpoints
 *
 * This module defines Zod schemas for validating input data
 * for study session API endpoints, including the SM-2 algorithm
 * quality ratings.
 */

import { z } from "zod";

/**
 * Schema for study session query parameters
 * GET /api/study-sessions/current
 *
 * Validates:
 * - limit: Maximum number of flashcards to return (default: 20, max: 50)
 */
export const StudySessionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/**
 * Schema for reviewing a flashcard
 * POST /api/study-sessions/review
 *
 * Validates:
 * - flashcard_id: UUID of the flashcard being reviewed
 * - quality: SM-2 quality rating (0-5)
 *
 * Quality rating scale (SM-2 algorithm):
 * - 0: Complete blackout (total failure)
 * - 1: Incorrect response; correct answer remembered
 * - 2: Incorrect response; correct answer seemed easy to recall
 * - 3: Correct response recalled with serious difficulty
 * - 4: Correct response after some hesitation
 * - 5: Perfect response (immediate recall)
 *
 * Quality < 3 indicates failure and resets the interval to 0 (review today).
 * Quality >= 3 indicates success and increases the review interval.
 */
export const ReviewFlashcardSchema = z.object({
  flashcard_id: z.string({ required_error: "Flashcard ID is required" }).uuid("Invalid flashcard ID format"),
  quality: z
    .number({ required_error: "Quality rating is required" })
    .int("Quality must be an integer")
    .min(0, "Quality must be at least 0")
    .max(5, "Quality must be at most 5"),
});

/**
 * Type inference from Zod schemas
 */
export type StudySessionQueryInput = z.infer<typeof StudySessionQuerySchema>;
export type ReviewFlashcardInput = z.infer<typeof ReviewFlashcardSchema>;
