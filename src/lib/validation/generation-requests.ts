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

/**
 * Schema for listing generation requests
 * GET /api/generation-requests
 * 
 * Validates query parameters:
 * - page: Page number (default: 1, min: 1)
 * - limit: Items per page (default: 20, min: 1, max: 100)
 * - sort: Sort field (default: 'created_at', options: 'created_at' | 'updated_at')
 * - order: Sort order (default: 'desc', options: 'asc' | 'desc')
 * 
 * Note: Uses z.coerce to automatically convert string query params to numbers
 */
export const GenerationRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['created_at', 'updated_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Type inference for list query parameters
 */
export type GenerationRequestListQueryInput = z.infer<typeof GenerationRequestListQuerySchema>;

