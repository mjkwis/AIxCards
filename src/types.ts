/**
 * Shared TypeScript Types for 10x-cards Application
 *
 * This file contains all DTO (Data Transfer Object) and Command Model types
 * used for API communication between frontend and backend.
 *
 * All types are derived from database entities defined in src/db/database.types.ts
 */

import type { Tables, Enums } from "./db/database.types";

// ============================================================================
// Database Entity Types (Re-exported for convenience)
// ============================================================================

/** Flashcard entity as stored in database */
export type FlashcardEntity = Tables<"flashcards">;

/** Generation request entity as stored in database */
export type GenerationRequestEntity = Tables<"generation_requests">;

/** Flashcard source enum: manual or ai_generated */
export type FlashcardSource = Enums<"flashcard_source_enum">;

/** Flashcard status enum: active, pending_review, or rejected */
export type FlashcardStatus = Enums<"flashcard_status_enum">;

/** Flashcard quality rating (0-5) for SM-2 spaced repetition algorithm */
export type FlashcardQuality = 0 | 1 | 2 | 3 | 4 | 5;

// ============================================================================
// Common DTOs
// ============================================================================

/**
 * Pagination metadata for list responses
 */
export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Authentication DTOs
// ============================================================================

/**
 * Command to register a new user
 * POST /api/auth/register
 */
export interface RegisterCommand {
  email: string;
  password: string;
}

/**
 * Command to authenticate an existing user
 * POST /api/auth/login
 */
export interface LoginCommand {
  email: string;
  password: string;
}

/**
 * User data returned from authentication endpoints
 * Simplified version of Supabase auth.users
 */
export interface UserDTO {
  id: string;
  email: string;
  created_at: string;
}

/**
 * Session data returned from authentication endpoints
 * Contains JWT tokens for authenticated requests
 */
export interface SessionDTO {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

/**
 * Response from successful authentication (register/login)
 */
export interface AuthResponse {
  user: UserDTO;
  session: SessionDTO;
}

// ============================================================================
// Generation Requests DTOs
// ============================================================================

/**
 * Command to create a new AI flashcard generation request
 * POST /api/generation-requests
 *
 * Derived from: TablesInsert<'generation_requests'>
 */
export interface CreateGenerationRequestCommand {
  /** Source text to generate flashcards from (1000-10000 characters) */
  source_text: string;
}

/**
 * Generation request DTO for API responses
 * Based on: GenerationRequestEntity
 */
export type GenerationRequestDTO = Pick<
  GenerationRequestEntity,
  "id" | "user_id" | "source_text" | "created_at" | "updated_at"
>;

/**
 * Generation request list item with flashcard count
 * Used in GET /api/generation-requests
 */
export interface GenerationRequestListItem extends GenerationRequestDTO {
  /** Number of flashcards generated from this request */
  flashcard_count: number;
}

/**
 * Response from creating a generation request
 * POST /api/generation-requests
 */
export interface CreateGenerationRequestResponse {
  generation_request: GenerationRequestDTO;
  flashcards: FlashcardDTO[];
}

/**
 * Response from listing generation requests
 * GET /api/generation-requests
 */
export interface GenerationRequestListResponse {
  generation_requests: GenerationRequestListItem[];
  pagination: Pagination;
}

/**
 * Response from getting a specific generation request
 * GET /api/generation-requests/:id
 */
export interface GenerationRequestDetailResponse {
  generation_request: GenerationRequestDTO;
  flashcards: FlashcardDTO[];
}

// ============================================================================
// Flashcards DTOs
// ============================================================================

/**
 * Command to create a manual flashcard
 * POST /api/flashcards
 *
 * Derived from: TablesInsert<'flashcards'> but simplified for manual creation
 */
export interface CreateFlashcardCommand {
  /** Question or front side of the flashcard */
  front: string;
  /** Answer or back side of the flashcard */
  back: string;
}

/**
 * Command to update an existing flashcard
 * PATCH /api/flashcards/:id
 *
 * Derived from: TablesUpdate<'flashcards'> but restricted to safe fields
 */
export interface UpdateFlashcardCommand {
  /** Updated question text */
  front?: string;
  /** Updated answer text */
  back?: string;
  /** Updated status */
  status?: FlashcardStatus;
}

/**
 * Flashcard DTO for API responses
 * Based on: FlashcardEntity
 *
 * This is the full flashcard representation with all fields.
 *
 * Default values for different states:
 * - Manual flashcards (status: 'active'):
 *   - next_review_at: current timestamp (due immediately)
 *   - interval: 0
 *   - ease_factor: 2.5
 *
 * - AI-generated flashcards (status: 'pending_review'):
 *   - next_review_at: null (not yet scheduled)
 *   - interval: 0
 *   - ease_factor: 2.5
 *
 * - Rejected flashcards (status: 'rejected'):
 *   - next_review_at: null (not scheduled)
 */
export type FlashcardDTO = Pick<
  FlashcardEntity,
  | "id"
  | "user_id"
  | "generation_request_id"
  | "front"
  | "back"
  | "source"
  | "status"
  | "next_review_at"
  | "interval"
  | "ease_factor"
  | "created_at"
  | "updated_at"
>;

/**
 * Response from creating or retrieving a single flashcard
 * POST /api/flashcards, GET /api/flashcards/:id, PATCH /api/flashcards/:id
 */
export interface FlashcardResponse {
  flashcard: FlashcardDTO;
}

/**
 * Response from listing flashcards
 * GET /api/flashcards
 */
export interface FlashcardsListResponse {
  flashcards: FlashcardDTO[];
  pagination: Pagination;
}

/**
 * Command to batch approve multiple flashcards
 * POST /api/flashcards/batch-approve
 */
export interface BatchApproveCommand {
  /** Array of flashcard IDs to approve */
  flashcard_ids: string[];
}

/**
 * Failed approval item in batch operation
 */
export interface BatchApprovalFailure {
  /** Flashcard ID that failed */
  id: string;
  /** Reason for failure */
  reason: string;
}

/**
 * Response from batch approve operation
 * POST /api/flashcards/batch-approve
 */
export interface BatchApproveResponse {
  /** Successfully approved flashcard IDs */
  approved: string[];
  /** Failed approvals with reasons */
  failed: BatchApprovalFailure[];
}

// ============================================================================
// Study Session DTOs
// ============================================================================

/**
 * Study session metadata
 */
export interface StudySessionInfo {
  /** Total number of flashcards due for review */
  flashcards_due: number;
  /** Number of flashcards included in this session response */
  flashcards_in_session: number;
}

/**
 * Response from getting current study session
 * GET /api/study-sessions/current
 */
export interface StudySessionResponse {
  session: StudySessionInfo;
  flashcards: FlashcardDTO[];
}

/**
 * Command to submit a flashcard review
 * POST /api/study-sessions/review
 *
 * Quality values (SM-2 algorithm):
 * - 0: Complete blackout
 * - 1: Incorrect response; correct one remembered
 * - 2: Incorrect response; correct one seemed easy to recall
 * - 3: Correct response recalled with serious difficulty
 * - 4: Correct response after hesitation
 * - 5: Perfect response
 */
export interface ReviewFlashcardCommand {
  /** ID of the flashcard being reviewed */
  flashcard_id: string;
  /** Quality rating (0-5) */
  quality: FlashcardQuality;
}

/**
 * Response from submitting a flashcard review
 * POST /api/study-sessions/review
 */
export type ReviewFlashcardResponse = FlashcardResponse;

// ============================================================================
// Statistics DTOs
// ============================================================================

/**
 * Overview statistics for the user
 * GET /api/statistics/overview
 */
export interface StatisticsOverview {
  /** Total number of flashcards (all statuses) */
  total_flashcards: number;
  /** Number of active flashcards */
  active_flashcards: number;
  /** Number of flashcards pending review */
  pending_review_flashcards: number;
  /** Number of rejected flashcards */
  rejected_flashcards: number;
  /** Number of manually created flashcards */
  manual_flashcards: number;
  /** Number of AI-generated flashcards */
  ai_generated_flashcards: number;
  /** AI acceptance rate (0.0 - 1.0) */
  ai_acceptance_rate: number;
  /** Number of flashcards due today */
  flashcards_due_today: number;
  /** Total number of generation requests */
  total_generation_requests: number;
  /** Total number of reviews completed */
  total_reviews_completed: number;
}

/**
 * Response from getting overview statistics
 * GET /api/statistics/overview
 */
export interface StatisticsOverviewResponse {
  statistics: StatisticsOverview;
}

/**
 * Recent generation request data point
 */
export interface RecentRequest {
  /** Date of the requests (YYYY-MM-DD) */
  date: string;
  /** Number of generation requests on this date */
  requests: number;
  /** Number of flashcards generated on this date */
  flashcards_generated: number;
  /** Number of flashcards approved from this date */
  flashcards_approved: number;
}

/**
 * Detailed generation statistics
 * GET /api/statistics/generation
 */
export interface GenerationStatistics {
  /** Total number of AI-generated flashcards */
  total_generated: number;
  /** Total number of approved AI flashcards */
  total_approved: number;
  /** Total number of rejected AI flashcards */
  total_rejected: number;
  /** Approval rate (0.0 - 1.0) */
  approval_rate: number;
  /** Average number of flashcards per generation request */
  average_flashcards_per_request: number;
  /** Recent generation request history */
  recent_requests: RecentRequest[];
}

/**
 * Response from getting generation statistics
 * GET /api/statistics/generation
 */
export interface GenerationStatisticsResponse {
  statistics: GenerationStatistics;
}

// ============================================================================
// Query Parameter Types
// ============================================================================

/**
 * Query parameters for listing generation requests
 * GET /api/generation-requests
 */
export interface GenerationRequestListQuery {
  page?: number;
  limit?: number;
  sort?: "created_at" | "updated_at";
  order?: "asc" | "desc";
}

/**
 * Query parameters for listing flashcards
 * GET /api/flashcards
 */
export interface FlashcardsListQuery {
  page?: number;
  limit?: number;
  status?: FlashcardStatus;
  source?: FlashcardSource;
  sort?: "created_at" | "updated_at" | "next_review_at";
  order?: "asc" | "desc";
}

/**
 * Query parameters for study session
 * GET /api/study-sessions/current
 */
export interface StudySessionQuery {
  /** Maximum number of flashcards to return (default: 20, max: 50) */
  limit?: number;
}

// ============================================================================
// Type Guards and Utilities
// ============================================================================

/**
 * Type guard to check if a value is a valid FlashcardStatus
 */
export function isFlashcardStatus(value: unknown): value is FlashcardStatus {
  return typeof value === "string" && ["active", "pending_review", "rejected"].includes(value);
}

/**
 * Type guard to check if a value is a valid FlashcardSource
 */
export function isFlashcardSource(value: unknown): value is FlashcardSource {
  return typeof value === "string" && ["manual", "ai_generated"].includes(value);
}

/**
 * Type guard to check if a quality rating is valid (0-5)
 */
export function isValidQuality(value: unknown): value is FlashcardQuality {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
}
