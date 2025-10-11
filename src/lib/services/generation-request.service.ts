/**
 * Generation Request Service
 * 
 * Handles creation of generation requests and associated flashcards
 * in the database with proper error handling and cleanup.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { GenerationRequestDTO, FlashcardDTO, CreateGenerationRequestResponse } from "../../types";
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
  private mapGenerationRequestToDTO(entity: Database["public"]["Tables"]["generation_requests"]["Row"]): GenerationRequestDTO {
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
}

