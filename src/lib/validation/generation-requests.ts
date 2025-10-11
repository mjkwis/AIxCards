/**
 * Validation schemas for generation requests endpoints
 * 
 * This module defines Zod schemas for validating input data
 * for generation request API endpoints.
 */

import { z } from "zod";

/**
 * Schema for creating a new generation request
 * POST /api/generation-requests
 * 
 * Validates:
 * - source_text: Required string between 1000-10000 characters
 * - Automatically trims whitespace from input
 */
export const CreateGenerationRequestSchema = z.object({
  source_text: z
    .string({ required_error: "Source text is required" })
    .min(1000, "Source text must be at least 1000 characters")
    .max(10000, "Source text must not exceed 10000 characters")
    .trim(),
});

/**
 * Type inference from Zod schema
 * Represents validated input data for creating a generation request
 */
export type CreateGenerationRequestInput = z.infer<typeof CreateGenerationRequestSchema>;

