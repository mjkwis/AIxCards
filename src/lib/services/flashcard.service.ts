/**
 * Flashcard Service
 * 
 * Handles all flashcard-related operations:
 * - CRUD operations (create, read, update, delete)
 * - Flashcard approval/rejection workflow
 * - Batch approval operations
 * - List with pagination and filtering
 * 
 * This service manages both manual and AI-generated flashcards,
 * with proper state management for the review workflow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  FlashcardDTO,
  FlashcardResponse,
  FlashcardsListResponse,
  Pagination,
  BatchApproveResponse,
  BatchApprovalFailure,
  CreateFlashcardCommand,
  UpdateFlashcardCommand,
} from "../../types";
import { DatabaseError } from "../errors/database.error";
import { Logger } from "./logger.service";

const logger = new Logger("FlashcardService");

/**
 * Service class for managing flashcards
 * 
 * Handles database operations for flashcard CRUD operations,
 * approval workflows, and batch operations.
 */
export class FlashcardService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Creates a new manual flashcard
   * 
   * Manual flashcards are created directly by users and:
   * - Have source: "manual"
   * - Have status: "active" (no review needed)
   * - Have next_review_at: NOW (due immediately for first study session)
   * - Have interval: 0, ease_factor: 2.5 (SM-2 defaults)
   * 
   * @param userId - ID of the user creating the flashcard
   * @param command - Flashcard data (front, back)
   * @returns Created flashcard DTO
   * @throws DatabaseError if database operations fail
   */
  async create(userId: string, command: CreateFlashcardCommand): Promise<FlashcardDTO> {
    try {
      logger.info("Creating manual flashcard", { userId });

      const { data, error } = await this.supabase
        .from("flashcards")
        .insert({
          user_id: userId,
          generation_request_id: null,
          front: command.front,
          back: command.back,
          source: "manual",
          status: "active",
          next_review_at: new Date().toISOString(),
          interval: 0,
          ease_factor: 2.5,
        })
        .select()
        .single();

      if (error || !data) {
        logger.error("Failed to create flashcard", error as Error);
        throw new DatabaseError("Failed to create flashcard", error);
      }

      logger.info("Successfully created flashcard", { flashcardId: data.id });
      return this.mapToDTO(data);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in create", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Lists flashcards for a user with pagination and filtering
   * 
   * Features:
   * - Pagination (page, limit)
   * - Filtering (status, source)
   * - Sorting (created_at, updated_at, next_review_at)
   * - RLS ensures user can only see their own flashcards
   * 
   * @param userId - ID of the user
   * @param page - Page number (1-indexed)
   * @param limit - Items per page
   * @param status - Optional status filter
   * @param source - Optional source filter
   * @param sort - Sort field
   * @param order - Sort order (asc/desc)
   * @returns List of flashcards with pagination metadata
   * @throws DatabaseError if database operations fail
   */
  async list(
    userId: string,
    page: number,
    limit: number,
    status?: "active" | "pending_review" | "rejected",
    source?: "manual" | "ai_generated",
    sort: "created_at" | "updated_at" | "next_review_at" = "created_at",
    order: "asc" | "desc" = "desc"
  ): Promise<FlashcardsListResponse> {
    try {
      logger.info("Listing flashcards", { userId, page, limit, status, source, sort, order });

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build query with filters
      let countQuery = this.supabase
        .from("flashcards")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (status) {
        countQuery = countQuery.eq("status", status);
      }
      if (source) {
        countQuery = countQuery.eq("source", source);
      }

      // Get total count
      const { count, error: countError } = await countQuery;

      if (countError) {
        logger.error("Failed to count flashcards", countError as Error);
        throw new DatabaseError("Failed to count flashcards", countError);
      }

      const total = count || 0;
      const total_pages = Math.ceil(total / limit);

      // Build data query with same filters
      let dataQuery = this.supabase
        .from("flashcards")
        .select()
        .eq("user_id", userId);

      if (status) {
        dataQuery = dataQuery.eq("status", status);
      }
      if (source) {
        dataQuery = dataQuery.eq("source", source);
      }

      // Apply sorting and pagination
      const { data: flashcards, error: dataError } = await dataQuery
        .order(sort, { ascending: order === "asc" })
        .range(offset, offset + limit - 1);

      if (dataError) {
        logger.error("Failed to list flashcards", dataError as Error);
        throw new DatabaseError("Failed to list flashcards", dataError);
      }

      const pagination: Pagination = {
        page,
        limit,
        total,
        total_pages,
      };

      return {
        flashcards: (flashcards || []).map((fc) => this.mapToDTO(fc)),
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
   * Gets a specific flashcard by ID
   * 
   * Features:
   * - Fetches single flashcard
   * - RLS ensures user can only see their own flashcards
   * 
   * @param userId - ID of the user (for ownership verification)
   * @param flashcardId - ID of the flashcard
   * @returns Flashcard DTO
   * @throws DatabaseError if not found or database error
   */
  async getById(userId: string, flashcardId: string): Promise<FlashcardDTO> {
    try {
      logger.info("Getting flashcard", { userId, flashcardId });

      const { data, error } = await this.supabase
        .from("flashcards")
        .select()
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .single();

      if (error || !data) {
        logger.warning("Flashcard not found", { userId, flashcardId });
        throw new DatabaseError("Flashcard not found", error);
      }

      return this.mapToDTO(data);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in getById", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Updates a flashcard
   * 
   * Allows updating:
   * - front: Question text
   * - back: Answer text
   * - status: Flashcard status
   * 
   * Note: Cannot update source, SM-2 fields, or generation_request_id
   * 
   * @param userId - ID of the user (for ownership verification)
   * @param flashcardId - ID of the flashcard to update
   * @param command - Update data
   * @returns Updated flashcard DTO
   * @throws DatabaseError if not found or database error
   */
  async update(
    userId: string,
    flashcardId: string,
    command: UpdateFlashcardCommand
  ): Promise<FlashcardDTO> {
    try {
      logger.info("Updating flashcard", { userId, flashcardId, command });

      const { data, error } = await this.supabase
        .from("flashcards")
        .update(command)
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error || !data) {
        logger.warning("Failed to update flashcard", { userId, flashcardId });
        throw new DatabaseError("Failed to update flashcard", error);
      }

      logger.info("Successfully updated flashcard", { flashcardId: data.id });
      return this.mapToDTO(data);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in update", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Deletes a flashcard permanently
   * 
   * @param userId - ID of the user (for ownership verification)
   * @param flashcardId - ID of the flashcard to delete
   * @throws DatabaseError if not found or database error
   */
  async delete(userId: string, flashcardId: string): Promise<void> {
    try {
      logger.info("Deleting flashcard", { userId, flashcardId });

      const { error } = await this.supabase
        .from("flashcards")
        .delete()
        .eq("id", flashcardId)
        .eq("user_id", userId);

      if (error) {
        logger.error("Failed to delete flashcard", error as Error);
        throw new DatabaseError("Failed to delete flashcard", error);
      }

      logger.info("Successfully deleted flashcard", { flashcardId });
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in delete", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Approves an AI-generated flashcard
   * 
   * Changes status from 'pending_review' to 'active' and sets next_review_at to NOW.
   * Only works on flashcards with status 'pending_review'.
   * 
   * @param userId - ID of the user (for ownership verification)
   * @param flashcardId - ID of the flashcard to approve
   * @returns Approved flashcard DTO
   * @throws DatabaseError if not found, wrong status, or database error
   */
  async approve(userId: string, flashcardId: string): Promise<FlashcardDTO> {
    try {
      logger.info("Approving flashcard", { userId, flashcardId });

      // First verify the flashcard exists and is in pending_review status
      const { data: current, error: fetchError } = await this.supabase
        .from("flashcards")
        .select()
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !current) {
        logger.warning("Flashcard not found", { userId, flashcardId });
        throw new DatabaseError("Flashcard not found", fetchError);
      }

      if (current.status !== "pending_review") {
        logger.warning("Flashcard is not in pending_review status", {
          userId,
          flashcardId,
          currentStatus: current.status,
        });
        throw new DatabaseError("Flashcard is not in pending_review status");
      }

      // Update to active status with next_review_at set to NOW
      const { data, error } = await this.supabase
        .from("flashcards")
        .update({
          status: "active",
          next_review_at: new Date().toISOString(),
        })
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error || !data) {
        logger.error("Failed to approve flashcard", error as Error);
        throw new DatabaseError("Failed to approve flashcard", error);
      }

      logger.info("Successfully approved flashcard", { flashcardId: data.id });
      return this.mapToDTO(data);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in approve", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Rejects an AI-generated flashcard
   * 
   * Changes status from 'pending_review' to 'rejected' and sets next_review_at to NULL.
   * Only works on flashcards with status 'pending_review'.
   * 
   * @param userId - ID of the user (for ownership verification)
   * @param flashcardId - ID of the flashcard to reject
   * @returns Rejected flashcard DTO
   * @throws DatabaseError if not found, wrong status, or database error
   */
  async reject(userId: string, flashcardId: string): Promise<FlashcardDTO> {
    try {
      logger.info("Rejecting flashcard", { userId, flashcardId });

      // First verify the flashcard exists and is in pending_review status
      const { data: current, error: fetchError } = await this.supabase
        .from("flashcards")
        .select()
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .single();

      if (fetchError || !current) {
        logger.warning("Flashcard not found", { userId, flashcardId });
        throw new DatabaseError("Flashcard not found", fetchError);
      }

      if (current.status !== "pending_review") {
        logger.warning("Flashcard is not in pending_review status", {
          userId,
          flashcardId,
          currentStatus: current.status,
        });
        throw new DatabaseError("Flashcard is not in pending_review status");
      }

      // Update to rejected status with next_review_at set to NULL
      const { data, error } = await this.supabase
        .from("flashcards")
        .update({
          status: "rejected",
          next_review_at: null,
        })
        .eq("id", flashcardId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error || !data) {
        logger.error("Failed to reject flashcard", error as Error);
        throw new DatabaseError("Failed to reject flashcard", error);
      }

      logger.info("Successfully rejected flashcard", { flashcardId: data.id });
      return this.mapToDTO(data);
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in reject", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  /**
   * Batch approves multiple flashcards
   * 
   * Approves up to 50 flashcards in a single operation.
   * Returns both successful and failed approvals.
   * 
   * @param userId - ID of the user (for ownership verification)
   * @param flashcardIds - Array of flashcard IDs to approve
   * @returns Batch approval result with approved and failed IDs
   */
  async batchApprove(userId: string, flashcardIds: string[]): Promise<BatchApproveResponse> {
    try {
      logger.info("Batch approving flashcards", { userId, count: flashcardIds.length });

      const approved: string[] = [];
      const failed: BatchApprovalFailure[] = [];

      // Process each flashcard individually
      // Note: Could be optimized with a single update query, but individual
      // processing allows for better error reporting per flashcard
      for (const flashcardId of flashcardIds) {
        try {
          await this.approve(userId, flashcardId);
          approved.push(flashcardId);
        } catch (error) {
          failed.push({
            id: flashcardId,
            reason: error instanceof DatabaseError 
              ? error.message 
              : "Flashcard not found or cannot be approved",
          });
        }
      }

      logger.info("Batch approve completed", {
        userId,
        total: flashcardIds.length,
        approved: approved.length,
        failed: failed.length,
      });

      return { approved, failed };
    } catch (error) {
      logger.error("Unexpected error in batchApprove", error as Error);
      throw new DatabaseError("Unexpected error in batch approval", error);
    }
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

