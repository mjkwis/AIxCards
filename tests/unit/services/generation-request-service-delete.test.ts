import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenerationRequestService } from "../../../src/lib/services/generation-request.service";
import { DatabaseError } from "../../../src/lib/errors/database.error";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/db/database.types";

/**
 * Unit tests for GenerationRequestService.delete() method
 *
 * Tests cover:
 * - Successful deletion
 * - Database errors  
 * - RLS ownership verification
 * - CASCADE behavior (ON DELETE SET NULL)
 * - Proper error handling and logging
 */

// Mock the logger
vi.mock("../../../src/lib/services/logger.service", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  })),
}));

describe("GenerationRequestService.delete()", () => {
  let mockSupabase: SupabaseClient<Database>;
  let service: GenerationRequestService;
  let mockQuery: any;

  // Helper to create success mock
  const createSuccessMock = () => {
    mockQuery = {
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve),
    };
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue(mockQuery),
      }),
    } as unknown as SupabaseClient<Database>;
    service = new GenerationRequestService(mockSupabase);
  };

  // Helper to create error mock
  const createErrorMock = (error: any) => {
    mockQuery = {
      eq: vi.fn().mockReturnThis(),
      then: (resolve: any) => Promise.resolve({ data: null, error }).then(resolve),
    };
    mockSupabase = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue(mockQuery),
      }),
    } as unknown as SupabaseClient<Database>;
    service = new GenerationRequestService(mockSupabase);
  };

  beforeEach(() => {
    // Reset all mocks and create default success mock
    vi.clearAllMocks();
    createSuccessMock();
  });

  describe("Success scenarios", () => {
    it("should successfully delete generation request", async () => {
      // Arrange
      const userId = "test-user-id";
      const requestId = "test-request-id";

      // Act
      await service.delete(userId, requestId);

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledWith("generation_requests");
      expect(mockQuery.eq).toHaveBeenCalledWith("id", requestId);
      expect(mockQuery.eq).toHaveBeenCalledWith("user_id", userId);
    });

    it("should resolve without returning a value", async () => {
      // Act
      const result = await service.delete("user-id", "request-id");

      // Assert
      expect(result).toBeUndefined();
    });
  });

  describe("Database error scenarios", () => {
    it("should throw DatabaseError when deletion fails", async () => {
      // Arrange
      const dbError = {
        code: "DB_ERROR",
        message: "Database connection failed",
      };
      createErrorMock(dbError);

      // Act & Assert
      await expect(service.delete("user-id", "request-id")).rejects.toThrow(DatabaseError);
      await expect(service.delete("user-id", "request-id")).rejects.toThrow(
        "Failed to delete generation request"
      );
    });

    it("should include original error in DatabaseError", async () => {
      // Arrange
      const originalError = {
        code: "PGRST301",
        message: "JWT expired",
      };
      createErrorMock(originalError);

      // Act & Assert
      try {
        await service.delete("user-id", "request-id");
        expect.fail("Should have thrown DatabaseError");
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseError);
        expect((error as DatabaseError).originalError).toEqual(originalError);
      }
    });

    it("should throw DatabaseError for network errors", async () => {
      // Arrange
      const networkError = {
        code: "NETWORK_ERROR",
        message: "Failed to connect",
      };
      createErrorMock(networkError);

      // Act & Assert
      await expect(service.delete("user-id", "request-id")).rejects.toThrow(DatabaseError);
    });

    it("should throw DatabaseError for permission errors", async () => {
      // Arrange
      const permissionError = {
        code: "42501",
        message: "Permission denied",
      };
      createErrorMock(permissionError);

      // Act & Assert
      await expect(service.delete("user-id", "request-id")).rejects.toThrow(DatabaseError);
    });
  });

  describe("Not found scenarios", () => {
    it("should throw DatabaseError when generation request not found", async () => {
      // Arrange - Supabase returns PGRST116 when no rows matched
      const notFoundError = {
        code: "PGRST116",
        message: "No rows found",
      };
      createErrorMock(notFoundError);

      // Act & Assert
      await expect(service.delete("user-id", "non-existent-id")).rejects.toThrow(DatabaseError);
    });

    it("should throw DatabaseError when request belongs to different user (RLS)", async () => {
      // Arrange - RLS makes it appear as if the record doesn't exist
      const rlsError = {
        code: "PGRST116",
        message: "No rows found",
      };
      createErrorMock(rlsError);

      // Act & Assert
      await expect(service.delete("wrong-user-id", "request-id")).rejects.toThrow(DatabaseError);
    });
  });

  describe("Unexpected error scenarios", () => {
    it("should handle unexpected errors during query execution", async () => {
      // Arrange
      // Create a mock that throws during eq() call
      const errorMock = {
        eq: vi.fn().mockImplementation(() => {
          throw new Error("Unexpected error during query");
        }),
      };

      mockSupabase = {
        from: vi.fn().mockReturnValue({
          delete: vi.fn().mockReturnValue(errorMock),
        }),
      } as unknown as SupabaseClient<Database>;

      service = new GenerationRequestService(mockSupabase);

      // Act & Assert
      await expect(service.delete("user-id", "request-id")).rejects.toThrow(DatabaseError);
      await expect(service.delete("user-id", "request-id")).rejects.toThrow("Unexpected database error");
    });
  });

  describe("CASCADE behavior (ON DELETE SET NULL)", () => {
    it("should delete generation request (flashcards remain)", async () => {
      // This test documents expected CASCADE behavior:
      // 1. Generation request is deleted
      // 2. Flashcards are NOT deleted
      // 3. Flashcards' generation_request_id is set to NULL
      //
      // The CASCADE behavior is enforced by the database schema:
      // ALTER TABLE flashcards
      // ADD CONSTRAINT flashcards_generation_request_id_fkey
      // FOREIGN KEY (generation_request_id)
      // REFERENCES generation_requests(id)
      // ON DELETE SET NULL;

      // Act
      await service.delete("user-id", "request-id");

      // Assert
      // The service only handles the deletion of the generation_request
      // The database automatically handles setting flashcards.generation_request_id to NULL
      expect(mockSupabase.from).toHaveBeenCalledWith("generation_requests");

      // Note: We do NOT expect a separate call to update flashcards
      // because the database handles it automatically via CASCADE
    });

    it("should not make separate calls to update flashcards", async () => {
      // Act
      await service.delete("user-id", "request-id");

      // Assert
      // Verify we only access generation_requests table, not flashcards
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
      expect(mockSupabase.from).toHaveBeenCalledWith("generation_requests");
      expect(mockSupabase.from).not.toHaveBeenCalledWith("flashcards");
    });
  });

  describe("Parameter handling", () => {
    it("should handle UUID format for request ID", async () => {
      // Arrange
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";

      // Act
      await service.delete("user-id", validUuid);

      // Assert
      expect(mockQuery.eq).toHaveBeenCalledWith("id", validUuid);
    });

    it("should handle special characters in IDs", async () => {
      // Arrange
      const userId = "user-with-special-chars-!@#$%";
      const requestId = "request-with-special-chars-^&*()";

      // Act
      await service.delete(userId, requestId);

      // Assert
      expect(mockQuery.eq).toHaveBeenCalledWith("user_id", userId);
      expect(mockQuery.eq).toHaveBeenCalledWith("id", requestId);
    });

    it("should handle very long IDs", async () => {
      // Arrange
      const longUserId = "user-" + "a".repeat(1000);
      const longRequestId = "request-" + "b".repeat(1000);

      // Act
      await service.delete(longUserId, longRequestId);

      // Assert
      expect(mockQuery.eq).toHaveBeenCalledWith("user_id", longUserId);
      expect(mockQuery.eq).toHaveBeenCalledWith("id", longRequestId);
    });
  });

  describe("Concurrent operations", () => {
    it("should handle multiple concurrent deletes", async () => {
      // Arrange
      const deletePromises = [
        service.delete("user-1", "request-1"),
        service.delete("user-2", "request-2"),
        service.delete("user-3", "request-3"),
      ];

      // Act
      await Promise.all(deletePromises);

      // Assert
      expect(mockSupabase.from).toHaveBeenCalledTimes(3);
      expect(mockQuery.eq).toHaveBeenCalledTimes(6); // 2 calls per delete (id and user_id)
    });

    it("should handle mixed success and failure in concurrent deletes", async () => {
      // Arrange
      let callCount = 0;
      const originalThen = mockQuery.then;
      
      mockQuery.then = (resolve: any) => {
        callCount++;
        if (callCount === 1) {
          // First delete succeeds
          return Promise.resolve({ data: null, error: null }).then(resolve);
        } else {
          // Subsequent deletes fail
          return Promise.resolve({
            data: null,
            error: { code: "ERROR", message: "Failed" },
          }).then(resolve);
        }
      };

      const deletePromises = [
        service.delete("user-1", "request-1"),
        service.delete("user-2", "request-2"),
        service.delete("user-3", "request-3"),
      ];

      // Act
      const results = await Promise.allSettled(deletePromises);

      // Assert
      expect(results[0].status).toBe("fulfilled");
      expect(results[1].status).toBe("rejected");
      expect(results[2].status).toBe("rejected");
      
      // Restore
      mockQuery.then = originalThen;
    });
  });
});
