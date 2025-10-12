/**
 * Validation schemas for flashcards endpoints
 *
 * This module defines Zod schemas for validating input data
 * for flashcard API endpoints.
 */

import { z } from "zod";

/**
 * Schema for creating a new flashcard manually
 * POST /api/flashcards
 *
 * Validates:
 * - front: Question text (1-1000 characters)
 * - back: Answer text (1-2000 characters)
 * - Automatically trims whitespace from input
 */
export const CreateFlashcardSchema = z.object({
  front: z
    .string({ required_error: "Front text is required" })
    .min(1, "Front text cannot be empty")
    .max(1000, "Front text must not exceed 1000 characters")
    .trim(),
  back: z
    .string({ required_error: "Back text is required" })
    .min(1, "Back text cannot be empty")
    .max(2000, "Back text must not exceed 2000 characters")
    .trim(),
});

/**
 * Schema for updating a flashcard
 * PATCH /api/flashcards/:id
 *
 * All fields are optional, but at least one must be provided
 */
export const UpdateFlashcardSchema = z
  .object({
    front: z
      .string()
      .min(1, "Front text cannot be empty")
      .max(1000, "Front text must not exceed 1000 characters")
      .trim()
      .optional(),
    back: z
      .string()
      .min(1, "Back text cannot be empty")
      .max(2000, "Back text must not exceed 2000 characters")
      .trim()
      .optional(),
    status: z.enum(["active", "pending_review", "rejected"]).optional(),
  })
  .refine((data) => data.front !== undefined || data.back !== undefined || data.status !== undefined, {
    message: "At least one field (front, back, or status) must be provided",
  });

/**
 * Schema for listing flashcards
 * GET /api/flashcards
 *
 * Validates query parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 20, min: 1, max: 100)
 * - status: Filter by status (optional: 'active' | 'pending_review' | 'rejected')
 * - source: Filter by source (optional: 'manual' | 'ai_generated')
 * - sort: Sort field (default: 'created_at', options: 'created_at' | 'updated_at' | 'next_review_at')
 * - order: Sort order (default: 'desc', options: 'asc' | 'desc')
 *
 * Note: Uses z.coerce to automatically convert string query params to numbers
 */
export const FlashcardsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "pending_review", "rejected"]).optional(),
  source: z.enum(["manual", "ai_generated"]).optional(),
  sort: z.enum(["created_at", "updated_at", "next_review_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

/**
 * Schema for batch approving flashcards
 * POST /api/flashcards/batch-approve
 *
 * Validates:
 * - flashcard_ids: Array of UUIDs (1-50 items)
 */
export const BatchApproveSchema = z.object({
  flashcard_ids: z
    .array(z.string().uuid("Invalid flashcard ID format"))
    .min(1, "At least one flashcard ID is required")
    .max(50, "Cannot approve more than 50 flashcards at once"),
});

/**
 * Type inference from Zod schemas
 */
export type CreateFlashcardInput = z.infer<typeof CreateFlashcardSchema>;
export type UpdateFlashcardInput = z.infer<typeof UpdateFlashcardSchema>;
export type FlashcardsListQueryInput = z.infer<typeof FlashcardsListQuerySchema>;
export type BatchApproveInput = z.infer<typeof BatchApproveSchema>;
