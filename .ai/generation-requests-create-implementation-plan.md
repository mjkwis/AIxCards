# API Endpoint Implementation Plan: POST /api/generation-requests

## 1. Endpoint Overview

**Endpoint:** `POST /api/generation-requests`

**Purpose:** Main application endpoint - AI flashcard generation based on source text. The endpoint accepts text (1000-10000 characters), passes it to AI service (mock for MVP), parses the response and saves generated flashcards in the database with `pending_review` status.

**Functionality:**

- Source text length validation (1000-10000 chars)
- Rate limiting (10 requests/hour per user) - protection against abuse
- **AI service integration (MOCK for MVP)** ← deterministic test data
- Parsing AI response to flashcard structure
- Bulk insert flashcards (transaction)
- Return generation request + all generated flashcards
- Error handling for AI failures

**User Stories:** US-003, US-004 (Core MVP functionality)

**Security:** Protected endpoint (requires auth), rate limiting (10/hour)

**⚠️ MVP Note:** For MVP we use **MockAIService** - real OpenRouter.ai integration will be added later.

---

## 2. Szczegóły żądania

### HTTP Method

`POST`

### URL Structure

```
/api/generation-requests
```

### Headers (Required)

```http
Authorization: Bearer {access_token}
Content-Type: application/json
```

### Request Body

```typescript
{
  "source_text": string  // 1000-10000 characters
}
```

**Typ:** `CreateGenerationRequestCommand`

**Przykład:**

```json
{
  "source_text": "Photosynthesis is a process used by plants and other organisms to convert light energy into chemical energy that can later be released to fuel the organisms' activities. This chemical energy is stored in carbohydrate molecules, such as sugars, which are synthesized from carbon dioxide and water. In most cases, oxygen is also released as a waste product. Most plants, most algae, and cyanobacteria perform photosynthesis; such organisms are called photoautotrophs. Photosynthesis is largely responsible for producing and maintaining the oxygen content of the Earth's atmosphere, and supplies most of the energy necessary for life on Earth. [... continues to 1000+ chars]"
}
```

### Parametry

#### Z Request Body

| Parametr      | Typ    | Wymagany | Walidacja        | Opis                                   |
| ------------- | ------ | -------- | ---------------- | -------------------------------------- |
| `source_text` | string | Tak      | 1000-10000 chars | Tekst źródłowy do wygenerowania fiszek |

---

## 3. Wykorzystywane typy

### DTOs (z src/types.ts)

```typescript
// Request
CreateGenerationRequestCommand {
  source_text: string;
}

// Response - Success
CreateGenerationRequestResponse {
  generation_request: GenerationRequestDTO;
  flashcards: FlashcardDTO[];
}

GenerationRequestDTO {
  id: string;
  user_id: string;
  source_text: string;
  created_at: string;
  updated_at: string;
}

FlashcardDTO {
  id: string;
  user_id: string;
  generation_request_id: string | null;
  front: string;
  back: string;
  source: FlashcardSource;  // "ai_generated"
  status: FlashcardStatus;  // "pending_review"
  next_review_at: string | null;  // null for pending
  interval: number | null;  // 0
  ease_factor: number | null;  // 2.5
  created_at: string;
  updated_at: string;
}

// Response - Error
ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
}
```

### Zod Schema (do utworzenia)

```typescript
// src/lib/validation/generation-requests.ts
import { z } from "zod";

export const CreateGenerationRequestSchema = z.object({
  source_text: z
    .string({ required_error: "Source text is required" })
    .min(1000, "Source text must be at least 1000 characters")
    .max(10000, "Source text must not exceed 10000 characters")
    .trim(),
});

export type CreateGenerationRequestInput = z.infer<typeof CreateGenerationRequestSchema>;
```

---

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

**Headers:**

```http
Content-Type: application/json
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1696943700
```

**Body:**

```json
{
  "generation_request": {
    "id": "uuid-gr",
    "user_id": "uuid-user",
    "source_text": "Photosynthesis is a process...",
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T10:00:00Z"
  },
  "flashcards": [
    {
      "id": "uuid-fc-1",
      "user_id": "uuid-user",
      "generation_request_id": "uuid-gr",
      "front": "What is photosynthesis?",
      "back": "A process used by plants to convert light energy into chemical energy stored in carbohydrates.",
      "source": "ai_generated",
      "status": "pending_review",
      "next_review_at": null,
      "interval": 0,
      "ease_factor": 2.5,
      "created_at": "2025-10-12T10:00:00Z",
      "updated_at": "2025-10-12T10:00:00Z"
    },
    {
      "id": "uuid-fc-2",
      "user_id": "uuid-user",
      "generation_request_id": "uuid-gr",
      "front": "What is released as a waste product during photosynthesis?",
      "back": "Oxygen is released as a waste product in most cases.",
      "source": "ai_generated",
      "status": "pending_review",
      "next_review_at": null,
      "interval": 0,
      "ease_factor": 2.5,
      "created_at": "2025-10-12T10:00:00Z",
      "updated_at": "2025-10-12T10:00:00Z"
    }
  ]
}
```

**Uwagi:**

- Liczba flashcards: zwykle 5-20 (zależnie od długości tekstu i AI decision)
- Wszystkie flashcards mają status `pending_review` (wymagają user approval)
- `generation_request_id` jest ustawiony dla wszystkich flashcards
- `next_review_at` jest NULL (nie są jeszcze aktywne)

### Error Responses

#### 400 Bad Request - VALIDATION_ERROR

**Scenariusze:**

- Brak pola `source_text`
- Text za krótki (< 1000 chars)
- Text za długi (> 10000 chars)
- Invalid JSON

**Response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Source text must be at least 1000 characters",
    "details": {
      "field": "source_text",
      "current_length": 523,
      "min_length": 1000
    }
  }
}
```

#### 401 Unauthorized - AUTH_REQUIRED

**Scenariusze:**

- Brak Authorization header
- Invalid JWT token
- Token expired

**Response:**

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Valid authentication token is required"
  }
}
```

#### 422 Unprocessable Entity - AI_SERVICE_ERROR

**Scenariusze:**

- OpenRouter API error
- AI nie może sparsować tekstu
- AI zwróciło invalid format
- AI timeout

**Response:**

```json
{
  "error": {
    "code": "AI_SERVICE_ERROR",
    "message": "Failed to generate flashcards. Please try again with different text.",
    "details": {
      "reason": "AI service temporarily unavailable"
    }
  }
}
```

#### 429 Too Many Requests - RATE_LIMIT_EXCEEDED

**Scenariusze:**

- User przekroczył limit 10 requests/hour

**Response:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many generation requests. Please try again later.",
    "details": {
      "limit": 10,
      "window_hours": 1,
      "reset_at": "2025-10-12T11:00:00Z"
    }
  }
}
```

#### 500 Internal Server Error - INTERNAL_ERROR

**Scenariusze:**

- Database error podczas zapisywania
- Unexpected exception
- Transaction rollback failure

**Response:**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to create generation request. Please try again later."
  }
}
```

---

## 5. Przepływ danych

### Diagram przepływu

```
Client Request
      ↓
[1] Middleware
      ├─→ Verify JWT Token
      ├─→ Rate Limiting Check (10/hour per user)
      └─→ Inject supabase + user to context
      ↓
[2] API Route Handler (POST)
      ├─→ Parse request body
      └─→ Validate with Zod
      ↓
[3] GenerationRequestService.create()
      ├─→ [3a] Create generation_request record
      ├─→ [3b] Call AI Service (OpenRouter)
      ├─→ [3c] Parse AI response to flashcards
      ├─→ [3d] Bulk insert flashcards (transaction)
      └─→ [3e] Return generation_request + flashcards
      ↓
[4] Return Response
      └─→ 201 Created + JSON
      ↓
Client Response (201)
```

### Szczegółowy przepływ krok po kroku

#### Krok 1: Middleware (src/middleware/index.ts)

```typescript
// Rate limiting for generation endpoint
if (pathname === "/api/generation-requests" && method === "POST") {
  const userId = context.locals.user?.id;

  if (!userId) {
    return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  }

  try {
    // Check rate limit: 10 per hour per user
    await rateLimitService.checkGenerationRateLimit(userId);

    const remaining = rateLimitService.getRemainingGeneration(userId);
    const resetAt = rateLimitService.getResetAt(`rate_limit:generation:${userId}`);

    context.locals.rateLimitRemaining = remaining;
    context.locals.rateLimitReset = resetAt;
  } catch (error) {
    if (error instanceof RateLimitError) {
      return errorResponse(429, "RATE_LIMIT_EXCEEDED", "Too many generation requests. Please try again later.", {
        limit: 10,
        window_hours: 1,
        reset_at: error.resetAt.toISOString(),
      });
    }
    throw error;
  }
}
```

#### Krok 2: Route Handler (src/pages/api/generation-requests/index.ts)

```typescript
export const prerender = false;

export async function POST(context: APIContext) {
  try {
    const user = context.locals.user;
    const supabase = context.locals.supabase;

    if (!user || !supabase) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // Parse body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON in request body");
    }

    // Validate
    const validationResult = CreateGenerationRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        current_length: requestBody.source_text?.length || 0,
      });
    }

    logger.info("Processing generation request", {
      userId: user.id,
      textLength: validationResult.data.source_text.length,
    });

    // Generate flashcards
    const service = new GenerationRequestService(supabase);
    const result = await service.create(user.id, validationResult.data);

    logger.info("Flashcards generated successfully", {
      userId: user.id,
      requestId: result.generation_request.id,
      flashcardCount: result.flashcards.length,
    });

    // Return 201 Created
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    if (error instanceof AIServiceError) {
      logger.warning("AI service error", {
        userId: context.locals.user?.id,
        error: error.message,
      });
      return errorResponse(
        422,
        "AI_SERVICE_ERROR",
        "Failed to generate flashcards. Please try again with different text.",
        { reason: error.message }
      );
    }

    logger.critical("Unexpected error in generation request", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "Failed to create generation request. Please try again later.");
  }
}
```

#### Krok 3: GenerationRequestService Implementation

**Plik:** `src/lib/services/generation-request.service.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type {
  CreateGenerationRequestCommand,
  CreateGenerationRequestResponse,
  GenerationRequestDTO,
  FlashcardDTO,
} from "../../types";
import { AIService } from "./ai.service";
import { Logger } from "./logger.service";
import { AIServiceError } from "../errors/ai-service.error";
import { DatabaseError } from "../errors/database.error";

const logger = new Logger("GenerationRequestService");

export class GenerationRequestService {
  constructor(
    private supabase: SupabaseClient<Database>,
    private aiService: AIService
  ) {}

  /**
   * Create generation request and generate flashcards
   *
   * Flow:
   * 1. Create generation_request record
   * 2. Call AI service to generate flashcards
   * 3. Bulk insert flashcards with generation_request_id
   * 4. Return both generation_request and flashcards
   */
  async create(userId: string, command: CreateGenerationRequestCommand): Promise<CreateGenerationRequestResponse> {
    try {
      // Step 1: Create generation_request record
      const { data: generationRequest, error: grError } = await this.supabase
        .from("generation_requests")
        .insert({
          user_id: userId,
          source_text: command.source_text,
        })
        .select()
        .single();

      if (grError || !generationRequest) {
        logger.error("Failed to create generation request", grError, { userId });
        throw new DatabaseError("Failed to create generation request", grError);
      }

      logger.info("Generation request created", {
        requestId: generationRequest.id,
        userId,
      });

      // Step 2: Call AI service to generate flashcards
      let flashcardsData: Array<{ front: string; back: string }>;
      try {
        flashcardsData = await this.aiService.generateFlashcards(command.source_text);
      } catch (error) {
        // AI failed - but generation_request is already created
        // This is intentional - we want to track failed attempts
        logger.error("AI service failed", error as Error, {
          requestId: generationRequest.id,
          userId,
        });
        throw new AIServiceError("Failed to generate flashcards", error);
      }

      if (!flashcardsData || flashcardsData.length === 0) {
        throw new AIServiceError("AI returned no flashcards");
      }

      logger.info("AI generated flashcards", {
        requestId: generationRequest.id,
        count: flashcardsData.length,
      });

      // Step 3: Bulk insert flashcards
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
        next_review_at: null,
        interval: 0,
        ease_factor: 2.5,
      }));

      const { data: flashcards, error: fcError } = await this.supabase
        .from("flashcards")
        .insert(flashcardsToInsert)
        .select();

      if (fcError || !flashcards) {
        logger.error("Failed to insert flashcards", fcError, {
          requestId: generationRequest.id,
          userId,
        });
        throw new DatabaseError("Failed to save flashcards", fcError);
      }

      logger.info("Flashcards saved to database", {
        requestId: generationRequest.id,
        count: flashcards.length,
      });

      // Step 4: Return response
      return {
        generation_request: this.mapToDTO(generationRequest),
        flashcards: flashcards.map(this.mapFlashcardToDTO),
      };
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof AIServiceError || error instanceof DatabaseError) {
        throw error;
      }

      // Wrap unexpected errors
      logger.error("Unexpected error in create", error as Error, { userId });
      throw new DatabaseError("Unexpected error during generation", error);
    }
  }

  private mapToDTO(entity: any): GenerationRequestDTO {
    return {
      id: entity.id,
      user_id: entity.user_id,
      source_text: entity.source_text,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  private mapFlashcardToDTO(entity: any): FlashcardDTO {
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
```

#### Krok 4: AI Service Implementation (MVP: Mock)

**⚠️ MVP Implementation:** Dla MVP używamy MockAIService - deterministyczne dane testowe bez zewnętrznych zależności.

**Plik:** `src/lib/services/ai.service.ts`

```typescript
import { Logger } from "./logger.service";
import { AIServiceError } from "../errors/ai-service.error";

const logger = new Logger("AIService");

interface FlashcardPair {
  front: string;
  back: string;
}

/**
 * AI Service Interface
 * Defines contract for AI flashcard generation
 */
export interface IAIService {
  generateFlashcards(sourceText: string): Promise<FlashcardPair[]>;
}

/**
 * Mock AI Service - Used for MVP
 * Returns deterministic test data
 *
 * Benefits:
 * - No external API dependencies
 * - No API costs during development
 * - Predictable, testable results
 * - Fast response times
 */
export class MockAIService implements IAIService {
  async generateFlashcards(sourceText: string): Promise<FlashcardPair[]> {
    logger.info("MockAIService: Generating flashcards", {
      textLength: sourceText.length,
    });

    // Simulate slight delay for realism (100-300ms)
    await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 200));

    // Generate 5-10 mock flashcards based on text length
    const count = Math.floor(5 + (sourceText.length / 2000) * 5);
    const flashcards: FlashcardPair[] = [];

    // Extract first sentence or 100 chars as context
    const preview = sourceText.substring(0, 100).trim();
    const topic = this.extractTopic(preview);

    for (let i = 1; i <= Math.min(count, 10); i++) {
      flashcards.push({
        front: `${topic} - Pytanie ${i}`,
        back: `Odpowiedź na pytanie ${i} dotyczące: ${preview}${preview.length >= 100 ? "..." : ""}`,
      });
    }

    logger.info(`MockAIService: Generated ${flashcards.length} flashcards`);
    return flashcards;
  }

  private extractTopic(text: string): string {
    // Simple topic extraction - first few words
    const words = text.split(" ").slice(0, 3).join(" ");
    return words || "Zagadnienie";
  }
}

/**
 * Real OpenRouter AI Service - For Production
 *
 * IMPLEMENTATION NOTE: Uncomment and use when ready for production
 * Requires OPENROUTER_API_KEY environment variable
 */
export class OpenRouterAIService implements IAIService {
  private apiKey: string;
  private apiUrl: string = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    const apiKey = import.meta.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable is required for OpenRouterAIService");
    }

    this.apiKey = apiKey;
  }

  async generateFlashcards(sourceText: string): Promise<FlashcardPair[]> {
    try {
      logger.info("OpenRouterAIService: Calling API", {
        textLength: sourceText.length,
      });

      const prompt = this.buildPrompt(sourceText);

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": import.meta.env.SITE_URL || "http://localhost:3000",
          "X-Title": "AIxCards",
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that creates educational flashcards from text.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error("OpenRouter API error", new Error(errorText), {
          status: response.status,
        });
        throw new AIServiceError(`OpenRouter API returned ${response.status}`);
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new AIServiceError("Invalid response format from AI");
      }

      const flashcards = this.parseFlashcards(data.choices[0].message.content);

      if (flashcards.length === 0) {
        throw new AIServiceError("AI returned no valid flashcards");
      }

      // Limit to max 20 flashcards
      return flashcards.slice(0, 20);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }
      logger.error("Unexpected error calling OpenRouter", error as Error);
      throw new AIServiceError("Failed to communicate with AI service");
    }
  }

  private buildPrompt(sourceText: string): string {
    return `Generate flashcards from the following text. Create 5-15 flashcards that cover the key concepts.

Format your response EXACTLY like this (one flashcard per line, separated by "|||"):
Q: What is photosynthesis? ||| A: A process used by plants to convert light energy into chemical energy.
Q: What gas is released during photosynthesis? ||| A: Oxygen is released as a waste product.

Rules:
- Each line must follow the format: Q: question ||| A: answer
- Questions should be clear and specific
- Answers should be concise but complete
- Focus on key concepts and important details
- Aim for 5-15 flashcards
- Do not include any other text, explanations, or formatting

Text to analyze:
${sourceText}`;
  }

  private parseFlashcards(content: string): FlashcardPair[] {
    const flashcards: FlashcardPair[] = [];
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    for (const line of lines) {
      const match = line.match(/Q:\s*(.+?)\s*\|\|\|\s*A:\s*(.+)/i);

      if (match) {
        const front = match[1].trim();
        const back = match[2].trim();

        if (front.length > 0 && back.length > 0 && front.length <= 1000 && back.length <= 2000) {
          flashcards.push({ front, back });
        }
      }
    }

    return flashcards;
  }
}

/**
 * Factory function - creates appropriate AI service
 *
 * MVP: Returns MockAIService
 * Production: Switch to OpenRouterAIService when ready
 */
export function createAIService(): IAIService {
  // MVP: Use Mock
  return new MockAIService();

  // Production: Uncomment when ready
  // return new OpenRouterAIService();
}
```

### Error Class

**Plik:** `src/lib/errors/ai-service.error.ts`

```typescript
export class AIServiceError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}
```

---

## 6. Względy bezpieczeństwa

### 6.1. Rate Limiting

**Strategy:** User-based rate limiting (10 requests per hour per user)

```typescript
// RateLimitService extension
async checkGenerationRateLimit(userId: string): Promise<void> {
  const key = `rate_limit:generation:${userId}`;
  const limit = 10;
  const windowMs = 3600000; // 1 hour
  const now = new Date();

  const entry = this.store.get(key);

  if (!entry || entry.resetAt < now) {
    this.store.set(key, {
      count: 1,
      resetAt: new Date(now.getTime() + windowMs)
    });
    return;
  }

  if (entry.count >= limit) {
    throw new RateLimitError(entry.resetAt);
  }

  entry.count++;
  this.store.set(key, entry);
}
```

**Rationale:**

- Ochrona przed nadużyciami (koszty API OpenRouter)
- Per user (nie per IP) - każdy user ma swój limit
- 10/hour jest rozsądnym limitem dla MVP
- Może być zwiększony w przyszłości lub per plan subscription

### 6.2. Input Validation

**Text Length:**

- **Minimum:** 1000 chars - zapewnia wystarczający kontekst dla AI
- **Maximum:** 10000 chars - zapobiega:
  - Bardzo długim requestom (latency)
  - Wysokim kosztom API (tokens)
  - Timeouts
  - DoS attacks

**Sanitization:**

```typescript
// Trim whitespace
source_text: command.source_text.trim();

// Flashcard content trim
front: fc.front.trim();
back: fc.back.trim();
```

### 6.3. AI Service Security

**API Key Protection:**

```typescript
// NEVER expose API key to client
this.apiKey = import.meta.env.OPENROUTER_API_KEY;

// Server-side only
// .env should NOT be committed to git
```

**Timeout Protection:**

```typescript
// Add timeout to AI request (future enhancement)
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

const response = await fetch(url, {
  signal: controller.signal,
  // ... other options
});

clearTimeout(timeoutId);
```

### 6.4. Database Transactions

**Why important:**

- Generation request created BEFORE AI call
- If AI fails, request exists but no flashcards
- This is INTENTIONAL - we want to track failed attempts

**Alternative approach (full transaction):**

```typescript
// Could wrap in Supabase transaction (future)
// But current approach is acceptable for MVP
```

### 6.5. Error Information Disclosure

**Safe to expose:**

- "AI service temporarily unavailable"
- "Failed to generate flashcards"
- Rate limit information

**NEVER expose:**

- API keys
- OpenRouter error details
- Database errors
- Stack traces

---

## 7. Rozważania dotyczące wydajności

### 7.1. Bottlenecks

**1. AI API Call (Biggest)**

- **Latency:** 3-15 seconds (depends on text length)
- **Impact:** User waits for response
- **Mitigation:**
  - Show loading indicator on frontend
  - Consider async processing (future)
  - Timeout after 30 seconds

**2. Bulk Insert Flashcards**

- **Latency:** 100-500ms for 5-20 flashcards
- **Impact:** Minimal
- **Mitigation:** Already using bulk insert

**3. Rate Limiting Check**

- **Latency:** 1-5ms (in-memory), 10-20ms (Redis)
- **Impact:** Negligible

### 7.2. Optimization Strategies

**Option 1: Async Processing (Future)**

```typescript
// Immediate response with job ID
POST /api/generation-requests
→ 202 Accepted
{
  "job_id": "uuid",
  "status": "processing"
}

// Poll for results
GET /api/generation-requests/job/:jobId
→ 200 OK (when complete)
{
  "status": "completed",
  "generation_request": {...},
  "flashcards": [...]
}
```

**Benefits:**

- Faster initial response
- Better UX with progress indicator
- Can retry failures

**Drawbacks:**

- More complex implementation
- Requires job queue (Redis/Bull)
- Not needed for MVP

**Option 2: Streaming Response (Advanced)**

```typescript
// Stream flashcards as they're generated
// SSE (Server-Sent Events)
```

**Decision for MVP:** Synchronous processing (simpler)

### 7.3. Caching

**Should NOT cache:**

- Generation results (each is unique)
- Rate limit status (needs real-time)

**Could cache:**

- AI service availability (health check)

### 7.4. Monitoring

**Key Metrics:**

1. **AI Success Rate**
   - Target: > 95%
   - Alert: < 90%

2. **Response Time**
   - P50: < 5s
   - P95: < 15s
   - P99: < 30s

3. **Flashcards per Request**
   - Average: 8-12
   - Alert if consistently < 3

4. **Rate Limit Hit Rate**
   - Normal: < 5% of users
   - Alert: > 20% (limit may be too low)

---

## 8. Environment Variables

**MVP (MockAIService):**

```env
# .env - MVP doesn't require any AI API keys
SITE_URL=http://localhost:3000
```

**Production (OpenRouterAIService):**

```env
# .env - Required when switching to OpenRouterAIService
OPENROUTER_API_KEY=your_openrouter_api_key
SITE_URL=https://your-domain.com
```

**Security (for Production):**

- Add `.env` to `.gitignore`
- Use different keys for dev/prod
- Rotate keys periodically
- Never commit API keys to repository

---

## 9. Testing

### Unit Tests - MockAIService (MVP)

```typescript
// tests/lib/services/ai.service.test.ts
describe("MockAIService", () => {
  it("should generate deterministic flashcards", async () => {
    const service = new MockAIService();
    const sourceText = "Photosynthesis is a process...".repeat(50); // 1500+ chars

    const result = await service.generateFlashcards(sourceText);

    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(10);
    expect(result[0]).toHaveProperty("front");
    expect(result[0]).toHaveProperty("back");
  });

  it("should generate more flashcards for longer text", async () => {
    const service = new MockAIService();
    const shortText = "a".repeat(1000);
    const longText = "b".repeat(5000);

    const shortResult = await service.generateFlashcards(shortText);
    const longResult = await service.generateFlashcards(longText);

    expect(longResult.length).toBeGreaterThanOrEqual(shortResult.length);
  });

  it("should extract topic from text", async () => {
    const service = new MockAIService();
    const text = "Machine Learning is a subset of artificial intelligence...".repeat(20);

    const result = await service.generateFlashcards(text);

    expect(result[0].front).toContain("Machine Learning is");
  });
});

// tests/lib/services/generation-request.service.test.ts
describe("GenerationRequestService", () => {
  it("should create generation request with mock flashcards", async () => {
    const mockSupabase = createMockSupabase({
      insertGenerationRequest: { data: mockGenerationRequest, error: null },
      insertFlashcards: { data: mockFlashcards, error: null },
    });

    const service = new GenerationRequestService(mockSupabase);
    const result = await service.create("user-id", {
      source_text: "Test content ".repeat(100), // > 1000 chars
    });

    expect(result.generation_request).toBeDefined();
    expect(result.flashcards.length).toBeGreaterThan(0);
    expect(result.flashcards[0].status).toBe("pending_review");
    expect(result.flashcards[0].source).toBe("ai_generated");
  });

  it("should handle AI service errors", async () => {
    const mockSupabase = createMockSupabase();
    const mockAIService = {
      generateFlashcards: jest.fn().mockRejectedValue(new AIServiceError("Mock error")),
    };

    const service = new GenerationRequestService(mockSupabase, mockAIService);

    await expect(service.create("user-id", { source_text: "a".repeat(1000) })).rejects.toThrow(AIServiceError);
  });
});
```

### Unit Tests - OpenRouterAIService (Future)

```typescript
// tests/lib/services/ai.service.openrouter.test.ts
describe("OpenRouterAIService", () => {
  it("should parse flashcards correctly", () => {
    const service = new OpenRouterAIService();
    const content = `
Q: What is photosynthesis? ||| A: Process of converting light to energy
Q: What is released? ||| A: Oxygen
    `;

    const result = service["parseFlashcards"](content);

    expect(result).toHaveLength(2);
    expect(result[0].front).toBe("What is photosynthesis?");
    expect(result[0].back).toBe("Process of converting light to energy");
  });

  it("should handle invalid format gracefully", () => {
    const service = new OpenRouterAIService();
    const content = "Invalid content without proper format";

    const result = service["parseFlashcards"](content);

    expect(result).toHaveLength(0);
  });
});
```

### Integration Tests

```typescript
describe("POST /api/generation-requests", () => {
  it("should return 400 for text too short", async () => {
    const token = await getAuthToken();

    const response = await fetch("/api/generation-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_text: "Short text",
      }),
    });

    expect(response.status).toBe(400);
  });

  it("should generate flashcards successfully", async () => {
    const token = await getAuthToken();

    const response = await fetch("/api/generation-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_text: "Lorem ipsum...".repeat(100), // > 1000 chars
      }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.generation_request).toBeDefined();
    expect(data.flashcards).toBeInstanceOf(Array);
    expect(data.flashcards.length).toBeGreaterThan(0);
    expect(data.flashcards[0].status).toBe("pending_review");
  });

  it("should enforce rate limiting", async () => {
    const token = await getAuthToken();

    // Make 10 requests
    for (let i = 0; i < 10; i++) {
      await fetch("/api/generation-requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source_text: "x".repeat(1000),
        }),
      });
    }

    // 11th should be rate limited
    const response = await fetch("/api/generation-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source_text: "x".repeat(1000),
      }),
    });

    expect(response.status).toBe(429);
  });
});
```

---

## 10. Checklist końcowy

### Pre-deployment (MVP - MockAIService)

- [ ] MockAIService implemented and tested
- [ ] GenerationRequestService implemented
- [ ] Rate limiting working (10/hour)
- [ ] Validation working (1000-10000 chars)
- [ ] Error handling comprehensive
- [ ] Unit tests passing (MockAIService)
- [ ] Integration tests passing
- [ ] Logging implemented
- [ ] Mock generates predictable flashcards

### Security (MVP)

- [ ] Rate limiting enforced
- [ ] Input validation strict
- [ ] Error messages don't leak sensitive info
- [ ] Authentication required
- [ ] RLS policies active

### Performance (MVP)

- [ ] Mock response time fast (< 1s)
- [ ] Bulk insert used for flashcards
- [ ] Response time acceptable
- [ ] No external API timeouts to worry about

### Post-deployment (MVP)

- [ ] Monitor generation success rate
- [ ] Monitor response times
- [ ] Track flashcards per request
- [ ] Monitor rate limit hits
- [ ] Verify mock data quality sufficient for testing

### Future: Production Migration (OpenRouterAIService)

- [ ] OPENROUTER_API_KEY configured
- [ ] Switch to OpenRouterAIService in factory
- [ ] Test with real AI responses
- [ ] Monitor AI costs
- [ ] Configure AI call timeout (30s)
- [ ] User feedback on real AI quality

---

## 11. Notatki dodatkowe

### Ważne decyzje projektowe

1. **🔥 MVP: Mock vs Real AI:**
   - **Chosen:** MockAIService dla MVP
   - **Rationale:**
     - Brak kosztów API podczas development
     - Brak zależności zewnętrznych
     - Szybkie iteracje i testy
     - Deterministyczne wyniki
     - Łatwa migracja na real AI (interface pattern)
   - **Migration:** Switch to OpenRouterAIService when ready

2. **Synchronous vs Async:**
   - **Chosen:** Synchronous (MVP)
   - **Rationale:** Simpler implementation, acceptable latency for mock

3. **Generation Request Created Before AI:**
   - **Chosen:** Yes, create record first
   - **Rationale:** Track failed attempts, audit trail

4. **Max Flashcards Limit:**
   - **Chosen:** 20 flashcards max per request
   - **Rationale:** Performance, UX (reviewing too many at once is overwhelming)

5. **AI Model (Future):**
   - **Planned:** OpenAI GPT-3.5-turbo via OpenRouter
   - **Rationale:** Cost-effective, fast, good quality for production

6. **Status for AI Flashcards:**
   - **Chosen:** `pending_review` (requires approval)
   - **Rationale:** User control, quality gate, prevents spam

### Potential Enhancements (Future)

1. **Async Processing:** Job queue for long-running generations
2. **Multiple AI Models:** Allow user to choose model
3. **Prompt Customization:** User-defined generation styles
4. **Flashcard Quality Scoring:** AI confidence scores
5. **Regeneration:** Regenerate specific flashcards
6. **Batch Processing:** Multiple texts in one request
7. **Image Support:** Generate flashcards from images (OCR + AI)

**Autor:** AI Architecture Team  
**Data:** 2025-10-12  
**Wersja:** 1.0  
**Status:** Ready for Implementation  
**Priority:** CRITICAL - Core MVP Feature
