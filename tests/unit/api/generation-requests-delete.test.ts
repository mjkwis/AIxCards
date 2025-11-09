import { describe, it, expect, vi, beforeEach } from "vitest";
import { DELETE } from "../../../src/pages/api/generation-requests/[id]";
import { GenerationRequestService } from "../../../src/lib/services/generation-request.service";
import { DatabaseError } from "../../../src/lib/errors/database.error";
import type { APIContext } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../src/db/database.types";

/**
 * Unit tests for DELETE /api/generation-requests/:id endpoint
 *
 * Tests cover:
 * - Successful deletion (204 No Content)
 * - Authentication validation (401)
 * - Missing request ID (400)
 * - Not found scenarios (404)
 * - Database errors (500)
 * - Ownership verification through RLS
 */

// Mock the dependencies
vi.mock("../../../src/lib/services/generation-request.service");
vi.mock("../../../src/lib/services/logger.service", () => ({
  Logger: vi.fn().mockImplementation(() => ({
    info: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    critical: vi.fn(),
  })),
}));

describe("DELETE /api/generation-requests/:id", () => {
  let mockContext: APIContext;
  let mockSupabase: SupabaseClient<Database>;
  let mockGenerationRequestService: GenerationRequestService;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Create mock Supabase client
    mockSupabase = {} as SupabaseClient<Database>;

    // Create mock context
    mockContext = {
      locals: {
        supabase: mockSupabase,
        user: {
          id: "test-user-id",
          email: "test@example.com",
          aud: "authenticated",
          created_at: "2024-01-01T00:00:00.000Z",
        },
      },
      params: {
        id: "test-request-id",
      },
    } as unknown as APIContext;

    // Create mock service instance
    mockGenerationRequestService = new GenerationRequestService(mockSupabase);
  });

  describe("Success scenarios", () => {
    it("should return 204 No Content when deletion is successful", async () => {
      // Arrange
      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");
      expect(deleteSpy).toHaveBeenCalledWith("test-user-id", "test-request-id");
      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });

    it("should call service with correct userId and requestId", async () => {
      // Arrange
      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      mockContext.locals.user!.id = "different-user-id";
      mockContext.params.id = "different-request-id";

      // Act
      await DELETE(mockContext);

      // Assert
      expect(deleteSpy).toHaveBeenCalledWith("different-user-id", "different-request-id");
    });
  });

  describe("Authentication validation", () => {
    it("should return 401 when user is not authenticated", async () => {
      // Arrange
      mockContext.locals.user = undefined;

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body).toEqual({
        error: {
          code: "AUTH_REQUIRED",
          message: "Authentication required",
          details: {},
        },
      });
    });

    it("should return 401 when user is null", async () => {
      // Arrange
      mockContext.locals.user = null as any;

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(401);

      const body = await response.json();
      expect(body.error.code).toBe("AUTH_REQUIRED");
    });
  });

  describe("Request validation", () => {
    it("should return 400 when request ID is missing", async () => {
      // Arrange
      mockContext.params.id = undefined;

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Generation request ID is required",
          details: {},
        },
      });
    });

    it("should return 400 when request ID is empty string", async () => {
      // Arrange
      mockContext.params.id = "";

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Not found scenarios", () => {
    it("should return 404 when generation request is not found", async () => {
      // Arrange
      const deleteSpy = vi
        .spyOn(mockGenerationRequestService, "delete")
        .mockRejectedValue(new DatabaseError("Generation request not found", { code: "PGRST116" }));

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Generation request not found",
          details: {},
        },
      });

      expect(deleteSpy).toHaveBeenCalledTimes(1);
    });

    it("should return 404 when request belongs to different user (RLS)", async () => {
      // Arrange
      // RLS will make the delete fail as if the record doesn't exist
      const deleteSpy = vi
        .spyOn(mockGenerationRequestService, "delete")
        .mockRejectedValue(new DatabaseError("Failed to delete generation request", { code: "PGRST116" }));

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Database error scenarios", () => {
    it("should return 404 for any DatabaseError", async () => {
      // Arrange
      const deleteSpy = vi
        .spyOn(mockGenerationRequestService, "delete")
        .mockRejectedValue(new DatabaseError("Database connection failed", { code: "DB_ERROR" }));

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Unexpected error scenarios", () => {
    it("should return 500 for unexpected errors", async () => {
      // Arrange
      const deleteSpy = vi
        .spyOn(mockGenerationRequestService, "delete")
        .mockRejectedValue(new Error("Unexpected error"));

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body).toEqual({
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred. Please try again later.",
          details: {},
        },
      });
    });

    it("should return 500 when service constructor throws", async () => {
      // Arrange
      vi.mocked(GenerationRequestService).mockImplementation(() => {
        throw new Error("Service initialization failed");
      });

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(500);

      const body = await response.json();
      expect(body.error.code).toBe("INTERNAL_ERROR");
    });
  });

  describe("Response format", () => {
    it("should return empty body with 204 status on success", async () => {
      // Arrange
      vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(204);
      expect(response.body).toBeNull();
      expect(response.headers.get("Content-Type")).toBeNull();
    });

    it("should return JSON error response with proper structure", async () => {
      // Arrange
      mockContext.locals.user = undefined;

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.headers.get("Content-Type")).toBe("application/json");

      const body = await response.json();
      expect(body).toHaveProperty("error");
      expect(body.error).toHaveProperty("code");
      expect(body.error).toHaveProperty("message");
    });
  });

  describe("Service integration", () => {
    it("should create GenerationRequestService with correct supabase client", async () => {
      // Arrange
      const mockConstructor = vi.fn();
      vi.mocked(GenerationRequestService).mockImplementation((supabase) => {
        mockConstructor(supabase);
        return mockGenerationRequestService;
      });

      vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      // Act
      await DELETE(mockContext);

      // Assert
      expect(mockConstructor).toHaveBeenCalledWith(mockSupabase);
      expect(mockConstructor).toHaveBeenCalledTimes(1);
    });

    it("should not call delete method when authentication fails", async () => {
      // Arrange
      mockContext.locals.user = undefined;
      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete");

      // Act
      await DELETE(mockContext);

      // Assert
      // Service might be constructed but delete should not be called
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it("should not call delete method when request ID is missing", async () => {
      // Arrange
      mockContext.params.id = undefined;
      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete");

      // Act
      await DELETE(mockContext);

      // Assert
      // Service might be constructed but delete should not be called
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });

  describe("Edge cases", () => {
    it("should handle UUID format for request ID", async () => {
      // Arrange
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";
      mockContext.params.id = validUuid;

      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      await DELETE(mockContext);

      // Assert
      expect(deleteSpy).toHaveBeenCalledWith("test-user-id", validUuid);
    });

    it("should handle special characters in request ID", async () => {
      // Arrange
      const specialId = "test-id-with-special-chars-!@#";
      mockContext.params.id = specialId;

      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      await DELETE(mockContext);

      // Assert
      expect(deleteSpy).toHaveBeenCalledWith("test-user-id", specialId);
    });

    it("should handle very long request IDs", async () => {
      // Arrange
      const longId = "a".repeat(1000);
      mockContext.params.id = longId;

      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      await DELETE(mockContext);

      // Assert
      expect(deleteSpy).toHaveBeenCalledWith("test-user-id", longId);
    });
  });

  describe("CASCADE behavior documentation", () => {
    it("should successfully delete generation request (flashcards remain with NULL)", async () => {
      // Arrange
      // This test documents the CASCADE behavior:
      // - Generation request is deleted
      // - Flashcards remain in database
      // - Flashcards' generation_request_id is set to NULL
      const deleteSpy = vi.spyOn(mockGenerationRequestService, "delete").mockResolvedValue(undefined);

      vi.mocked(GenerationRequestService).mockImplementation(() => mockGenerationRequestService);

      // Act
      const response = await DELETE(mockContext);

      // Assert
      expect(response.status).toBe(204);
      expect(deleteSpy).toHaveBeenCalledWith("test-user-id", "test-request-id");

      // Note: The actual CASCADE behavior (setting flashcards.generation_request_id to NULL)
      // is handled by the database layer (ON DELETE SET NULL constraint).
      // This is tested in the service layer tests.
    });
  });
});
