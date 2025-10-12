/**
 * Generation Request Service
 *
 * Handles creation of generation requests and associated flashcards
 * in the database with proper error handling and cleanup.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  GenerationRequestDTO,
  FlashcardDTO,
  CreateGenerationRequestResponse,
  GenerationRequestListItem,
  GenerationRequestListResponse,
  GenerationRequestDetailResponse,
  Pagination,
} from "../../types";
import { DatabaseError } from "../errors/database.error";
import { Logger } from "./logger.service";

const logger = new Logger("GenerationRequestService");

/**
 * Flashcard data structure from AI service
 */
export interface FlashcardData {
  front: string;
  back: string;
}

/**
 * Service class for managing generation requests
 *
 * Handles database operations for creating generation requests
 * and bulk inserting associated flashcards.
 */
export class GenerationRequestService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Creates a new generation request with flashcards
   *
   * Process:
   * 1. Insert generation_request record
   * 2. Bulk insert flashcards with default values
   * 3. Return DTOs for both entities
   * 4. Cleanup on error
   *
   * Default values for AI-generated flashcards:
   * - source: "ai_generated"
   * - status: "pending_review" (requires user approval)
   * - next_review_at: null (not yet scheduled for review)
   * - interval: 0 (days until next review)
   * - ease_factor: 2.5 (SM-2 algorithm default)
   *
   * @param userId - ID of the user creating the request
   * @param sourceText - Source text used for generation
   * @param flashcardsData - Array of flashcard data from AI service
   * @returns Response object with generation request and flashcards DTOs
   * @throws DatabaseError if database operations fail
   */
  async create(
    userId: string,
    sourceText: string,
    flashcardsData: FlashcardData[]
  ): Promise<CreateGenerationRequestResponse> {
    try {
      logger.info("Creating generation request", {
        userId,
        flashcardsCount: flashcardsData.length,
      });

      // Step 1: Insert generation_request
      const { data: generationRequest, error: grError } = await this.supabase
        .from("generation_requests")
        .insert({
          user_id: userId,
          source_text: sourceText,
        })
        .select()
        .single();

      if (grError || !generationRequest) {
        logger.error("Failed to create generation request", grError as Error);
        throw new DatabaseError("Failed to create generation request", grError);
      }

      // Step 2: Bulk insert flashcards
      // Default values for AI-generated flashcards:
      // - source: "ai_generated"
      // - status: "pending_review" (requires user approval)
      // - next_review_at: null (not yet scheduled for review)
      // - interval: 0 (days until next review)
      // - ease_factor: 2.5 (SM-2 algorithm default)
      const flashcardsToInsert = flashcardsData.map((fc) => ({
        user_id: userId,
        generation_request_id: generationRequest.id,
        front: fc.front.trim(),
        back: fc.back.trim(),
        source: "ai_generated" as const,
        status: "pending_review" as const,
        interval: 0,
        ease_factor: 2.5,
        // next_review_at is null by default (not specified in insert)
      }));

      const { data: flashcards, error: fcError } = await this.supabase
        .from("flashcards")
        .insert(flashcardsToInsert)
        .select();

      if (fcError || !flashcards) {
        logger.error("Failed to create flashcards", fcError as Error);

        // Cleanup: delete generation_request if flashcards failed
        await this.supabase.from("generation_requests").delete().eq("id", generationRequest.id);

        throw new DatabaseError("Failed to create flashcards", fcError);
      }

      logger.info("Successfully created generation request and flashcards", {
        generationRequestId: generationRequest.id,
        flashcardsCount: flashcards.length,
      });

      // Step 3: Map to DTOs and return
      return {
        generation_request: this.mapGenerationRequestToDTO(generationRequest),
        flashcards: flashcards.map((fc) => this.mapFlashcardToDTO(fc)),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in create", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Maps database entity to GenerationRequestDTO
   *
   * @param entity - Database entity from generation_requests table
   * @returns DTO for API response
   */
  private mapGenerationRequestToDTO(
    entity: Database["public"]["Tables"]["generation_requests"]["Row"]
  ): GenerationRequestDTO {
    return {
      id: entity.id,
      user_id: entity.user_id,
      source_text: entity.source_text,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  /**
   * Maps database entity to FlashcardDTO
   *
   * @param entity - Database entity from flashcards table
   * @returns DTO for API response
   */
  private mapFlashcardToDTO(entity: Database["public"]["Tables"]["flashcards"]["Row"]): FlashcardDTO {
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

  /**
   * Lists generation requests for a user with pagination
   *
   * Features:
   * - Pagination (page, limit)
   * - Sorting (created_at, updated_at)
   * - Flashcard count per request
   * - RLS ensures user can only see their own requests
   *
   * @param userId - ID of the user
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @param sort - Sort field
   * @param order - Sort order (asc/desc)
   * @returns List of generation requests with pagination metadata
   * @throws DatabaseError if database operations fail
   */
  async list(
    userId: string,
    page: number,
    limit: number,
    sort: "created_at" | "updated_at",
    order: "asc" | "desc"
  ): Promise<GenerationRequestListResponse> {
    try {
      logger.info("Listing generation requests", { userId, page, limit, sort, order });

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Get total count for pagination
      const { count, error: countError } = await this.supabase
        .from("generation_requests")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (countError) {
        logger.error("Failed to count generation requests", countError as Error);
        throw new DatabaseError("Failed to count generation requests", countError);
      }

      const total = count || 0;
      const total_pages = Math.ceil(total / limit);

      // Get generation requests with flashcard count
      // Using a LEFT JOIN to count flashcards per generation request
      const { data: requests, error: requestsError } = await this.supabase
        .from("generation_requests")
        .select(
          `
          *,
          flashcards(count)
        `
        )
        .eq("user_id", userId)
        .order(sort, { ascending: order === "asc" })
        .range(offset, offset + limit - 1);

      if (requestsError) {
        logger.error("Failed to list generation requests", requestsError as Error);
        throw new DatabaseError("Failed to list generation requests", requestsError);
      }

      // Map to list items with flashcard count
      const generation_requests: GenerationRequestListItem[] = (requests || []).map((req) => {
        // flashcards can be either an array or an aggregate object with count
        let flashcard_count = 0;
        if (Array.isArray(req.flashcards)) {
          flashcard_count = req.flashcards.length;
        } else if (req.flashcards && typeof req.flashcards === "object" && "count" in req.flashcards) {
          flashcard_count = (req.flashcards as { count: number }).count || 0;
        }

        return {
          id: req.id,
          user_id: req.user_id,
          source_text: req.source_text,
          flashcard_count,
          created_at: req.created_at,
          updated_at: req.updated_at,
        };
      });

      const pagination: Pagination = {
        page,
        limit,
        total,
        total_pages,
      };

      return {
        generation_requests,
        pagination,
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in list", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Gets a specific generation request with all flashcards
   *
   * Features:
   * - Fetches single generation request
   * - Includes all associated flashcards
   * - RLS ensures user can only see their own requests
   *
   * @param userId - ID of the user (for ownership verification)
   * @param requestId - ID of the generation request
   * @returns Generation request with flashcards
   * @throws DatabaseError if not found or database error
   */
  async getById(userId: string, requestId: string): Promise<GenerationRequestDetailResponse> {
    try {
      logger.info("Getting generation request", { userId, requestId });

      // Get generation request
      const { data: request, error: requestError } = await this.supabase
        .from("generation_requests")
        .select()
        .eq("id", requestId)
        .eq("user_id", userId)
        .single();

      if (requestError || !request) {
        logger.warning("Generation request not found", { userId, requestId });
        throw new DatabaseError("Generation request not found", requestError);
      }

      // Get associated flashcards
      const { data: flashcards, error: flashcardsError } = await this.supabase
        .from("flashcards")
        .select()
        .eq("generation_request_id", requestId)
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (flashcardsError) {
        logger.error("Failed to get flashcards", flashcardsError as Error);
        throw new DatabaseError("Failed to get flashcards", flashcardsError);
      }

      return {
        generation_request: this.mapGenerationRequestToDTO(request),
        flashcards: (flashcards || []).map((fc) => this.mapFlashcardToDTO(fc)),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in getById", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Deletes a generation request
   *
   * Behavior:
   * - Deletes the generation_request record
   * - Flashcards are NOT deleted (soft CASCADE)
   * - Flashcards' generation_request_id is set to NULL
   * - RLS ensures user can only delete their own requests
   *
   * @param userId - ID of the user (for ownership verification)
   * @param requestId - ID of the generation request to delete
   * @throws DatabaseError if not found or database error
   */
  async delete(userId: string, requestId: string): Promise<void> {
    try {
      logger.info("Deleting generation request", { userId, requestId });

      // Delete generation request
      // Database will automatically set flashcards.generation_request_id to NULL
      const { error } = await this.supabase
        .from("generation_requests")
        .delete()
        .eq("id", requestId)
        .eq("user_id", userId);

      if (error) {
        logger.error("Failed to delete generation request", error as Error);
        throw new DatabaseError("Failed to delete generation request", error);
      }

      logger.info("Successfully deleted generation request", { userId, requestId });
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in delete", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }
}
