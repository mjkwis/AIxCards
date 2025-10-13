/**
 * AI Service for generating flashcards from text
 *
 * Uses OpenRouter service for LLM-powered flashcard generation
 */

import { AIServiceError } from "../errors/ai-service.error";
import { Logger } from "./logger.service";
import { openRouterService, type JsonSchema } from "./openrouter.service";
import { OpenRouterError, OpenRouterAuthError, OpenRouterRateLimitError } from "../errors/openrouter.error";

const logger = new Logger("AIService");

/**
 * Flashcard data structure returned by AI
 */
export interface FlashcardData {
  front: string;
  back: string;
}

/**
 * AI Service class for flashcard generation
 *
 * Provides high-level interface for generating educational flashcards
 * using LLM via OpenRouter service
 */
export class AIService {
  constructor() {
    // Service uses singleton openRouterService
  }

  /**
   * Generates flashcards from source text
   *
   * Uses OpenRouter LLM to generate educational flashcards with structured output
   *
   * @param sourceText - Source text to generate flashcards from (1000-10000 chars)
   * @returns Array of flashcard data with front and back
   * @throws AIServiceError if generation fails
   */
  async generateFlashcards(sourceText: string): Promise<FlashcardData[]> {
    logger.info("Generating flashcards via AI", {
      textLength: sourceText.length,
    });

    try {
      // Define response schema for structured output
      const schema: JsonSchema<{ flashcards: FlashcardData[] }> = {
        name: "flashcards_response",
        description: "Array of educational flashcards",
        schema: {
          type: "object",
          properties: {
            flashcards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  front: {
                    type: "string",
                    description: "Question or front side of the flashcard",
                  },
                  back: {
                    type: "string",
                    description: "Answer or back side of the flashcard",
                  },
                },
                required: ["front", "back"],
                additionalProperties: false,
              },
              minItems: 5,
              maxItems: 15,
            },
          },
          required: ["flashcards"],
          additionalProperties: false,
        },
        strict: true,
      };

      // Generate flashcards using OpenRouter
      const result = await openRouterService.generateStructured(
        this.buildSystemMessage(),
        this.buildUserMessage(sourceText),
        schema
      );

      logger.info("Successfully generated flashcards", {
        count: result.flashcards.length,
      });

      return result.flashcards;
    } catch (error) {
      // Handle OpenRouter-specific errors
      if (error instanceof OpenRouterAuthError) {
        throw new AIServiceError(
          "AI service authentication failed",
          "Invalid or missing OPENROUTER_API_KEY. Please check your configuration.",
          error.statusCode
        );
      }

      if (error instanceof OpenRouterRateLimitError) {
        throw new AIServiceError(
          "AI service rate limit exceeded",
          "Too many requests. Please try again later.",
          error.statusCode
        );
      }

      if (error instanceof OpenRouterError) {
        throw new AIServiceError("Failed to generate flashcards", error.message, error.statusCode);
      }

      logger.error("Unexpected error in generateFlashcards", error as Error);
      throw new AIServiceError(
        "Unable to generate flashcards",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Builds system message for LLM
   *
   * Defines the role and behavior of the AI assistant
   */
  private buildSystemMessage(): string {
    return `You are an expert educational assistant specializing in creating high-quality flashcards for spaced repetition learning.

Your task is to:
- Extract key concepts from the provided text
- Create clear, focused questions for the front of each card
- Provide concise, accurate answers for the back
- Generate between 5 and 15 flashcards depending on content richness
- Ensure flashcards are suitable for spaced repetition learning`;
  }

  /**
   * Builds user message for LLM
   *
   * Provides the source text and instructions for flashcard generation
   */
  private buildUserMessage(sourceText: string): string {
    return `Generate educational flashcards from the following text. Each flashcard should focus on a single concept and be suitable for spaced repetition learning.

Text to analyze:
---
${sourceText}
---

Create flashcards that help learners master the key concepts from this text.`;
  }
}

/**
 * Singleton instance of AI Service
 * Use this for all AI operations
 */
export const aiService = new AIService();
