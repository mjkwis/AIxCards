/**
 * AI Service for generating flashcards from text
 *
 * MOCK IMPLEMENTATION - Currently returns mock data for frontend development
 * TODO: Replace with actual OpenRouter.ai integration when ready
 */

import { AIServiceError } from "../errors/ai-service.error";
import { Logger } from "./logger.service";

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
 * CURRENT STATUS: Mock implementation for frontend development
 * Returns sample flashcards based on text length
 */
export class AIService {
  private apiKey: string;
  private model: string;
  private apiUrl = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    this.apiKey = import.meta.env.OPENROUTER_API_KEY || "";
    this.model = import.meta.env.OPENROUTER_MODEL || "openai/gpt-4-turbo";
  }

  /**
   * Generates flashcards from source text
   *
   * MOCK IMPLEMENTATION: Returns 5-10 sample flashcards
   * TODO: Implement actual OpenRouter.ai API call
   *
   * @param sourceText - Source text to generate flashcards from (1000-10000 chars)
   * @returns Array of flashcard data with front and back
   * @throws AIServiceError if generation fails
   */
  async generateFlashcards(sourceText: string): Promise<FlashcardData[]> {
    logger.info("Generating flashcards via AI (MOCK)", {
      textLength: sourceText.length,
    });

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Mock implementation - generate sample flashcards
    const mockFlashcards = this.generateMockFlashcards(sourceText);

    logger.info("Successfully generated flashcards (MOCK)", {
      count: mockFlashcards.length,
    });

    return mockFlashcards;

    /* 
    TODO: Uncomment and implement when ready for OpenRouter.ai integration
    
    try {
      if (!this.apiKey) {
        throw new AIServiceError(
          "AI service is not configured",
          "OPENROUTER_API_KEY is missing"
        );
      }

      const prompt = this.buildPrompt(sourceText);

      // HTTP Request to OpenRouter.ai
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": import.meta.env.SITE || "http://localhost:4321",
          "X-Title": "10x-cards",
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that generates educational flashcards.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(30000), // 30s timeout
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new AIServiceError(
          "AI service returned an error",
          errorData.error?.message || "Unknown error",
          response.status
        );
      }

      const data = await response.json();
      const flashcards = this.parseAIResponse(data);

      logger.info("Successfully generated flashcards", {
        count: flashcards.length,
      });

      return flashcards;
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      logger.error("Unexpected error in generateFlashcards", error as Error);
      throw new AIServiceError(
        "Unable to generate flashcards",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
    */
  }

  /**
   * MOCK: Generates sample flashcards based on text
   *
   * @param sourceText - Source text
   * @returns Array of mock flashcards
   */
  private generateMockFlashcards(sourceText: string): FlashcardData[] {
    // Generate 5-10 flashcards based on text length
    const count = Math.min(10, Math.max(5, Math.floor(sourceText.length / 1000)));
    const preview = sourceText.substring(0, 50);

    return Array.from({ length: count }, (_, i) => ({
      front: `Sample question ${i + 1} about: "${preview}..."?`,
      back: `Sample answer ${i + 1} based on the provided text. This is a mock response for frontend development.`,
    }));
  }

  /**
   * Builds prompt for AI flashcard generation
   *
   * @param sourceText - Source text to generate flashcards from
   * @returns Formatted prompt string
   */
  private buildPrompt(sourceText: string): string {
    return `Generate educational flashcards from the following text. Create between 5 and 15 flashcards.

Each flashcard should:
- Have a clear question on the front
- Have a concise answer on the back
- Cover important concepts from the text
- Be suitable for spaced repetition learning

Return ONLY a JSON array with this exact format:
[
  {
    "front": "Question text?",
    "back": "Answer text."
  }
]

Text to generate flashcards from:
---
${sourceText}
---

JSON array of flashcards:`;
  }

  /**
   * Parses AI response and validates flashcard structure
   *
   * @param response - Raw response from OpenRouter.ai
   * @returns Validated array of flashcards
   * @throws AIServiceError if response is invalid
   */
  private parseAIResponse(response: unknown): FlashcardData[] {
    try {
      const data = response as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new AIServiceError("AI response is empty", "No content in AI response");
      }

      // Try to extract JSON from response (might be wrapped in markdown)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new AIServiceError("Could not parse AI response", "No JSON array found in response");
      }

      const flashcards = JSON.parse(jsonMatch[0]) as unknown[];

      // Validate structure
      if (!Array.isArray(flashcards) || flashcards.length === 0) {
        throw new AIServiceError("Invalid flashcards format", "Expected non-empty array");
      }

      // Validate each flashcard
      for (const fc of flashcards) {
        const card = fc as { front?: unknown; back?: unknown };
        if (!card.front || !card.back || typeof card.front !== "string" || typeof card.back !== "string") {
          throw new AIServiceError("Invalid flashcard structure", "Each flashcard must have front and back as strings");
        }
      }

      // Limit to max 20 flashcards
      return (flashcards as FlashcardData[]).slice(0, 20);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      logger.error("Error parsing AI response", error as Error, { response });
      throw new AIServiceError("Failed to parse AI response", error instanceof Error ? error.message : "Parse error");
    }
  }
}

/**
 * Singleton instance of AI Service
 * Use this for all AI operations
 */
export const aiService = new AIService();
