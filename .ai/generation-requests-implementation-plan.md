teraz dla mnie wygeneruj dla mnie implementation-plan dla /api/auth/register i zapisz go do pliku .ai/register-implementation-plan.md# API Endpoint Implementation Plan: POST /api/generation-requests

## 1. Przegląd punktu końcowego

**Endpoint:** `POST /api/generation-requests`

**Cel:** Utworzenie nowego żądania generowania fiszek przez AI. Użytkownik przesyła tekst źródłowy (1000-10000 znaków), a system wykorzystuje OpenRouter.ai do wygenerowania zestawu fiszek edukacyjnych. Wygenerowane fiszki są zapisywane w bazie danych ze statusem `pending_review`, co pozwala użytkownikowi na ich późniejszą akceptację lub odrzucenie.

**Funkcjonalność:**

- Walidacja długości tekstu źródłowego (1000-10000 znaków)
- Komunikacja z OpenRouter.ai w celu generowania fiszek
- Utworzenie rekordu `generation_request` w bazie danych
- Utworzenie wielu rekordów `flashcards` powiązanych z żądaniem
- Zwrócenie zarówno żądania jak i wygenerowanych fiszek w odpowiedzi
- Implementacja rate limiting (10 żądań/godzinę per użytkownik)

**User Stories:** US-003 (Generowanie fiszek przez AI), US-004 (Akceptacja/odrzucenie fiszek)

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
  "source_text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit... [1000-10000 characters total]"
}
```

### Parametry

#### Z Request Body

| Parametr      | Typ    | Wymagany | Walidacja         | Opis                                 |
| ------------- | ------ | -------- | ----------------- | ------------------------------------ |
| `source_text` | string | Tak      | 1000-10000 znaków | Tekst źródłowy do generowania fiszek |

#### Z JWT Token (automatycznie)

| Parametr  | Typ  | Źródło                       | Opis                        |
| --------- | ---- | ---------------------------- | --------------------------- |
| `user_id` | UUID | `auth.uid()` z Supabase Auth | ID zalogowanego użytkownika |

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
  source: FlashcardSource;  // "ai_generated" for AI-generated flashcards
  status: FlashcardStatus;  // "pending_review" for AI-generated, "active" for manual
  next_review_at: string | null;  // null for pending_review, timestamp for active
  interval: number | null;  // 0 for new flashcards
  ease_factor: number | null;  // 2.5 for new flashcards
  created_at: string;
  updated_at: string;
}

// Note: Default values for new AI-generated flashcards:
// - status: "pending_review"
// - next_review_at: null
// - interval: 0
// - ease_factor: 2.5

// Response - Error
ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
}
```

### Zod Schemas (do utworzenia w src/lib/validation/)

```typescript
// src/lib/validation/generation-requests.ts
import { z } from "zod";

export const CreateGenerationRequestSchema = z.object({
  source_text: z
    .string()
    .min(1000, "Source text must be at least 1000 characters")
    .max(10000, "Source text must not exceed 10000 characters")
    .trim(),
});

export type CreateGenerationRequestInput = z.infer<typeof CreateGenerationRequestSchema>;
```

### Database Types (z src/db/database.types.ts)

```typescript
// Insert types
TablesInsert<'generation_requests'> {
  id?: string;
  user_id: string;
  source_text: string;
  created_at?: string;
  updated_at?: string;
}

TablesInsert<'flashcards'> {
  id?: string;
  user_id: string;
  generation_request_id?: string | null;
  front: string;
  back: string;
  source: "manual" | "ai_generated";
  status: "active" | "pending_review" | "rejected";
  next_review_at?: string | null;
  interval?: number | null;
  ease_factor?: number | null;
  created_at?: string;
  updated_at?: string;
}
```

---

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

**Headers:**

```http
Content-Type: application/json
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1696942800
```

**Body:**

```json
{
  "generation_request": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "123e4567-e89b-12d3-a456-426614174000",
    "source_text": "Original text...",
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:00:00Z"
  },
  "flashcards": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "user_id": "123e4567-e89b-12d3-a456-426614174000",
      "generation_request_id": "550e8400-e29b-41d4-a716-446655440000",
      "front": "Question text?",
      "back": "Answer text.",
      "source": "ai_generated",
      "status": "pending_review",
      "next_review_at": null,
      "interval": 0,
      "ease_factor": 2.5,
      "created_at": "2025-10-11T10:00:00Z",
      "updated_at": "2025-10-11T10:00:00Z"
    }
  ]
}
```

### Error Responses

#### 400 Bad Request

**Scenariusze:**

- Brak `source_text` w body
- `source_text` krótszy niż 1000 znaków
- `source_text` dłuższy niż 10000 znaków
- Nieprawidłowy format JSON

**Response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Source text must be between 1000 and 10000 characters",
    "details": {
      "field": "source_text",
      "received_length": 500
    }
  }
}
```

#### 401 Unauthorized

**Scenariusze:**

- Brak nagłówka Authorization
- Nieprawidłowy token JWT
- Token wygasły

**Response:**

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Valid authentication token is required",
    "details": {}
  }
}
```

#### 422 Unprocessable Entity

**Scenariusze:**

- AI service zwrócił błąd
- AI nie mógł wygenerować fiszek
- AI zwrócił nieprawidłowy format

**Response:**

```json
{
  "error": {
    "code": "AI_SERVICE_ERROR",
    "message": "Unable to generate flashcards from provided text",
    "details": {
      "reason": "Text content not suitable for flashcard generation"
    }
  }
}
```

#### 429 Too Many Requests

**Scenariusze:**

- Przekroczony limit 10 żądań/godzinę

**Response:**

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Generation request limit exceeded. Please try again later.",
    "details": {
      "limit": 10,
      "reset_at": "2025-10-11T11:00:00Z"
    }
  }
}
```

#### 500 Internal Server Error

**Scenariusze:**

- Błąd bazy danych
- Nieoczekiwany błąd systemu

**Response:**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred. Please try again later.",
    "details": {}
  }
}
```

---

## 5. Przepływ danych

### Diagram przepływu

```
Client Request
      ↓
[1] Astro Middleware
      ├─→ Walidacja CORS
      ├─→ Walidacja JWT Token
      ├─→ Ekstrakcja user_id
      └─→ Rate Limiting Check
      ↓
[2] API Route Handler (POST)
      ├─→ Parse request body
      └─→ Walidacja Zod schema
      ↓
[3] AIService.generateFlashcards()
      ├─→ Przygotowanie prompt
      ├─→ HTTP Request do OpenRouter.ai
      ├─→ Parse AI response
      └─→ Zwrot array<{front, back}>
      ↓
[4] GenerationRequestService.create()
      ├─→ [Transaction Start]
      ├─→ INSERT generation_request (Supabase)
      ├─→ INSERT flashcards[] (bulk, Supabase)
      └─→ [Transaction Commit]
      ↓
[5] Format Response
      ├─→ Map DB entities → DTOs
      └─→ Return CreateGenerationRequestResponse
      ↓
Client Response (201)
```

### Szczegółowy przepływ krok po kroku

#### Krok 1: Middleware (src/middleware/index.ts)

- **CORS:** Walidacja origin, dodanie headers
- **Authentication:**
  - Ekstrakcja tokenu z `Authorization: Bearer {token}`
  - Walidacja JWT przez Supabase Auth
  - Ustawienie `context.locals.user` i `context.locals.supabase`
- **Rate Limiting:**
  - Sprawdzenie liczby żądań dla `user_id` w ostatniej godzinie
  - Aktualizacja licznika żądań

#### Krok 2: Route Handler (src/pages/api/generation-requests/index.ts)

```typescript
export const prerender = false;

export async function POST(context: APIContext) {
  // 1. Ekstrakcja danych
  const supabase = context.locals.supabase;
  const userId = context.locals.user?.id;
  const requestBody = await context.request.json();

  // 2. Walidacja input
  const validationResult = CreateGenerationRequestSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return new Response(JSON.stringify(errorResponse), { status: 400 });
  }

  // 3. Wywołanie AIService
  const flashcardsData = await aiService.generateFlashcards(validationResult.data.source_text);

  // 4. Wywołanie GenerationRequestService
  const result = await generationRequestService.create(userId, validationResult.data.source_text, flashcardsData);

  // 5. Zwrot odpowiedzi
  return new Response(JSON.stringify(result), { status: 201 });
}
```

#### Krok 3: AIService (src/lib/services/ai.service.ts)

```typescript
class AIService {
  async generateFlashcards(sourceText: string): Promise<Array<{ front: string; back: string }>> {
    // 1. Przygotowanie prompt
    const prompt = this.buildPrompt(sourceText);

    // 2. HTTP Request do OpenRouter.ai
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4-turbo",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    // 3. Parse i walidacja odpowiedzi
    const aiResponse = await response.json();
    const flashcards = this.parseAIResponse(aiResponse);

    return flashcards;
  }
}
```

#### Krok 4: GenerationRequestService (src/lib/services/generation-request.service.ts)

```typescript
class GenerationRequestService {
  async create(userId: string, sourceText: string, flashcardsData: Array<{ front: string; back: string }>) {
    // Transaction: utworzenie generation_request i flashcards

    // 1. INSERT generation_request
    const { data: generationRequest, error: grError } = await this.supabase
      .from("generation_requests")
      .insert({
        user_id: userId,
        source_text: sourceText,
      })
      .select()
      .single();

    // 2. Bulk INSERT flashcards
    const flashcardsToInsert = flashcardsData.map((fc) => ({
      user_id: userId,
      generation_request_id: generationRequest.id,
      front: fc.front,
      back: fc.back,
      source: "ai_generated" as const,
      status: "pending_review" as const,
      interval: 0,
      ease_factor: 2.5,
    }));

    const { data: flashcards, error: fcError } = await this.supabase
      .from("flashcards")
      .insert(flashcardsToInsert)
      .select();

    // 3. Zwrot wyniku
    return {
      generation_request: this.mapToDTO(generationRequest),
      flashcards: flashcards.map(this.mapFlashcardToDTO),
    };
  }
}
```

### Interakcje z zewnętrznymi serwisami

#### OpenRouter.ai

- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Method:** POST
- **Authentication:** Bearer token (API key w zmiennej środowiskowej)
- **Timeout:** 30 sekund
- **Retry Strategy:** 2 próby przy błędach 5xx
- **Rate Limits:** Zgodnie z planem OpenRouter (do monitorowania)

#### Supabase Database

- **Tabele:** `generation_requests`, `flashcards`
- **RLS:** Włączone - polityki zapewniają, że user_id jest poprawne
- **Transakcje:** Brak natywnych transakcji w Supabase, ale błędy są obsługiwane
- **Connection Pool:** Zarządzane przez Supabase client

---

## 6. Względy bezpieczeństwa

### 6.1. Uwierzytelnianie (Authentication)

- **Mechanizm:** JWT Bearer token w nagłówku Authorization
- **Walidacja:** Middleware Astro używa `@supabase/ssr` do walidacji tokenu
- **Session Management:** Supabase Auth zarządza sesjami
- **Token Expiry:** Domyślnie 1 godzina (konfigurowane w Supabase)

**Implementacja w middleware:**

```typescript
const token = context.request.headers.get("Authorization")?.replace("Bearer ", "");
const {
  data: { user },
  error,
} = await supabase.auth.getUser(token);
if (error || !user) {
  return new Response(JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Authentication required" } }), {
    status: 401,
  });
}
context.locals.user = user;
```

### 6.2. Autoryzacja (Authorization)

- **Row-Level Security (RLS):** Polityki na poziomie PostgreSQL
  - Użytkownik może tworzyć tylko swoje generation_requests (user_id = auth.uid())
  - Użytkownik może tworzyć tylko swoje flashcards (user_id = auth.uid())
- **API Level:** Middleware weryfikuje że user jest zalogowany przed dostępem
- **Resource Ownership:** user_id wyciągany z JWT, nie z request body (zapobiega impersonation)

### 6.3. Walidacja danych wejściowych

- **Zod Schema:** Silna walidacja typu i długości source_text
- **Sanitization:**
  - `.trim()` usuwa białe znaki z początku i końca
  - PostgreSQL automatycznie sanitizuje przy INSERT
- **Length Limits:**
  - Min: 1000 znaków (zapewnia wystarczającą ilość treści)
  - Max: 10000 znaków (zapobiega resource exhaustion)

### 6.4. Rate Limiting

- **Limit:** 10 żądań/godzinę per user_id
- **Implementacja:**
  - In-memory store (dla MVP) lub Redis (produkcja)
  - Klucz: `rate_limit:generation:${user_id}`
  - TTL: 1 godzina
- **Headers:** X-RateLimit-\* headers w odpowiedzi
- **Response:** 429 Too Many Requests przy przekroczeniu

**Pseudo-kod:**

```typescript
const key = `rate_limit:generation:${userId}`;
const count = (await rateLimit.get(key)) || 0;
if (count >= 10) {
  return 429;
}
await rateLimit.increment(key, { ttl: 3600 });
```

### 6.5. AI Prompt Injection Prevention

- **Input Validation:** Długość i format tekstu
- **Prompt Structure:** Separacja instruction od user input
- **Output Parsing:** Strict validation formatu zwróconego przez AI
- **Fallback:** Odrzucenie odpowiedzi AI jeśli nie spełnia wymagań

**Przykład bezpiecznego promptu:**

```
System: You are a flashcard generator. Generate flashcards from the following text.
Instructions: Return JSON array with objects containing 'front' and 'back' fields.

User Text:
---
[USER_TEXT_HERE]
---

Output format:
[{"front": "question", "back": "answer"}]
```

### 6.6. CORS (Cross-Origin Resource Sharing)

- **Allowed Origins:**
  - Development: `http://localhost:*`
  - Production: Specyficzna domena aplikacji
- **Allowed Methods:** POST
- **Allowed Headers:** Authorization, Content-Type
- **Credentials:** Include (dla cookies jeśli używane)

### 6.7. HTTPS/TLS

- **Wymaganie:** Wszystkie requesty przez HTTPS w produkcji
- **Token Security:** JWT tokeny transmitowane tylko przez HTTPS
- **Environment Variables:** API keys w zmiennych środowiskowych, nie w kodzie

### 6.8. Error Information Disclosure

- **Production:** Ogólne komunikaty błędów, szczegóły tylko w logach
- **Development:** Szczegółowe błędy dla debugowania
- **Never Expose:**
  - Struktury bazy danych
  - API keys
  - Internal paths
  - Stack traces (w produkcji)

---

## 7. Obsługa błędów

### 7.1. Kategoryzacja błędów

#### Client Errors (4xx)

**400 Bad Request - VALIDATION_ERROR**

- **Przyczyny:**
  - Brak pola `source_text`
  - `source_text` jest pusty string
  - `source_text` < 1000 znaków
  - `source_text` > 10000 znaków
  - Nieprawidłowy JSON w body
- **Akcja:** Zwróć szczegóły walidacji w `details.field`
- **Logging:** Info level (normalny przypadek)

**401 Unauthorized - AUTH_REQUIRED**

- **Przyczyny:**
  - Brak nagłówka Authorization
  - Token nieprawidłowy
  - Token wygasły
  - Użytkownik nie istnieje
- **Akcja:** Zwróć ogólny komunikat, nie ujawniaj szczegółów
- **Logging:** Warning level

**422 Unprocessable Entity - AI_SERVICE_ERROR**

- **Przyczyny:**
  - OpenRouter.ai zwrócił błąd 400/422
  - AI nie mógł sparsować tekstu
  - AI zwrócił nieprawidłowy format
  - Tekst nie nadaje się do generowania fiszek
- **Akcja:** Zwróć przyjazny komunikat użytkownikowi
- **Logging:** Error level z pełnymi szczegółami AI response

**429 Too Many Requests - RATE_LIMIT_EXCEEDED**

- **Przyczyny:**
  - Użytkownik wykonał > 10 żądań w ciągu godziny
- **Akcja:** Zwróć czas do reset w `details.reset_at`
- **Logging:** Info level (normalny przypadek)

#### Server Errors (5xx)

**500 Internal Server Error - INTERNAL_ERROR**

- **Przyczyny:**
  - Database connection error
  - OpenRouter.ai timeout
  - Nieoczekiwany exception
  - Bug w kodzie
- **Akcja:** Zwróć ogólny komunikat, loguj szczegóły
- **Logging:** Critical level z full stack trace

**503 Service Unavailable - SERVICE_UNAVAILABLE**

- **Przyczyny:**
  - OpenRouter.ai is down (status 503)
  - Database is unavailable
- **Akcja:** Zwróć komunikat o tymczasowej niedostępności
- **Logging:** Critical level

### 7.2. Error Handling Strategy

#### W Route Handler

```typescript
export async function POST(context: APIContext) {
  try {
    // 1. Walidacja
    const validationResult = CreateGenerationRequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid input", {
        errors: validationResult.error.errors,
      });
    }

    // 2. AI Generation (może rzucić AIServiceError)
    let flashcardsData;
    try {
      flashcardsData = await aiService.generateFlashcards(sourceText);
    } catch (error) {
      if (error instanceof AIServiceError) {
        return errorResponse(422, "AI_SERVICE_ERROR", error.message, {
          reason: error.reason,
        });
      }
      throw error; // Re-throw jeśli inny błąd
    }

    // 3. Database operations (może rzucić DatabaseError)
    const result = await generationRequestService.create(userId, sourceText, flashcardsData);

    // 4. Success
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Catch-all dla nieoczekiwanych błędów
    console.error("[POST /api/generation-requests] Unexpected error:", error);
    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred");
  }
}
```

#### Custom Error Classes

```typescript
// src/lib/errors/ai-service.error.ts
export class AIServiceError extends Error {
  constructor(
    message: string,
    public reason: string,
    public statusCode: number = 422
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

// src/lib/errors/database.error.ts
export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError: any
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

// src/lib/errors/rate-limit.error.ts
export class RateLimitError extends Error {
  constructor(public resetAt: Date) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}
```

### 7.3. Error Response Helper

```typescript
// src/lib/helpers/error-response.ts
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        details,
      },
    } as ErrorResponse),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

### 7.4. Logging Strategy

```typescript
// src/lib/services/logger.service.ts
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: any) {
    console.log(`[${this.context}] INFO: ${message}`, data);
  }

  warning(message: string, data?: any) {
    console.warn(`[${this.context}] WARNING: ${message}`, data);
  }

  error(message: string, error: Error, data?: any) {
    console.error(`[${this.context}] ERROR: ${message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...data,
    });
  }

  critical(message: string, error: Error, data?: any) {
    console.error(`[${this.context}] CRITICAL: ${message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...data,
    });
    // W produkcji: wysłać alert do external monitoring (Sentry, etc.)
  }
}
```

---

## 8. Rozważania dotyczące wydajności

### 8.1. Potencjalne wąskie gardła

#### 1. OpenRouter.ai API Response Time

- **Problem:** Generowanie fiszek przez AI może trwać 5-30 sekund
- **Wpływ:** Długi czas odpowiedzi dla użytkownika
- **Mitigation:**
  - Frontend: Pokazać progress indicator / loading state
  - Backend: Ustawić timeout na 30s
  - Future: Rozważyć asynchroniczne przetwarzanie (job queue)

#### 2. Bulk Insert Flashcards

- **Problem:** Wstawianie wielu fiszek (potencjalnie 10-20) w jednym requestcie
- **Wpływ:** Długi czas INSERT przy dużej liczbie fiszek
- **Mitigation:**
  - Użyć bulk insert (jeden request z array)
  - Supabase optymalizuje bulk operations
  - Limit liczby generowanych fiszek (np. max 20)

#### 3. Rate Limiting Check

- **Problem:** Dodatkowa operacja przed każdym requestem
- **Wpływ:** Minimalny, ale sumuje się
- **Mitigation:**
  - Użyć in-memory store (Redis) zamiast database
  - Cache rate limit counter

#### 4. Database Connection Pool

- **Problem:** Ograniczona liczba połączeń do PostgreSQL
- **Wpływ:** Potencjalne timeout przy wysokim obciążeniu
- **Mitigation:**
  - Supabase zarządza connection pooling
  - Monitor connection usage
  - Zwiększyć pool size w razie potrzeby

### 8.2. Strategie optymalizacji

#### Optymalizacja 1: Caching AI Prompts (Future)

```typescript
// Cache wygenerowanych fiszek dla identycznych tekstów
const cacheKey = `flashcards:${hashText(sourceText)}`;
const cached = await cache.get(cacheKey);
if (cached) {
  return cached;
}
// ... generate
await cache.set(cacheKey, flashcards, { ttl: 3600 });
```

**Korzyści:**

- Szybsza odpowiedź dla powtarzających się tekstów
- Redukcja kosztów API OpenRouter

**Trade-offs:**

- Dodatkowa złożoność
- Cache invalidation strategy
- Memory/storage requirements

#### Optymalizacja 2: Asynchroniczne przetwarzanie (Future)

```typescript
// POST /api/generation-requests zwraca natychmiast
// Przetwarzanie odbywa się w tle (job queue)

POST response (202 Accepted):
{
  "generation_request": {
    "id": "uuid",
    "status": "processing"
  }
}

// Frontend odpytuje GET /api/generation-requests/:id
// lub używa WebSocket/Server-Sent Events
```

**Korzyści:**

- Szybka odpowiedź API (< 100ms)
- Lepsza user experience
- Możliwość retry przy błędach

**Trade-offs:**

- Większa złożoność architektury
- Potrzeba job queue (BullMQ, etc.)
- Synchronizacja stanu z frontendem

#### Optymalizacja 3: Database Indexing

**Już zaimplementowane w schema:**

- `idx_generation_requests_user_id` - szybkie pobieranie dla użytkownika
- `idx_flashcards_user_id` - szybkie pobieranie fiszek
- `idx_flashcards_generation_request_id` - szybka relacja

**Dodatkowe indeksy do rozważenia:**

- Composite index: `(user_id, created_at DESC)` dla sortowanego listingu

#### Optymalizacja 4: Response Compression

```typescript
// W middleware
if (response.body && response.body.length > 1024) {
  headers["Content-Encoding"] = "gzip";
  body = gzip(response.body);
}
```

**Korzyści:**

- Redukcja transfer size o ~70%
- Szybszy transfer po sieci

#### Optymalizacja 5: Parallel Processing (jeśli możliwe)

```typescript
// Jeśli AI API wspiera batch processing
const [generationRequest, flashcardsData] = await Promise.all([
  // Start DB insert
  supabase.from('generation_requests').insert(...),
  // Start AI generation
  aiService.generateFlashcards(sourceText)
]);
```

**Uwaga:** Tylko jeśli AI nie wymaga generationRequest.id

### 8.3. Monitoring & Metrics

**Kluczowe metryki do monitorowania:**

1. **Response Time**
   - P50, P95, P99 latency
   - Target: P95 < 10s (z uwzględnieniem AI)

2. **AI Service Performance**
   - Success rate
   - Average response time
   - Error rate by type

3. **Database Performance**
   - Query execution time
   - Connection pool usage
   - Insert performance

4. **Rate Limiting**
   - Requests per user
   - 429 response rate
   - Pattern detection (abuse)

5. **Error Rates**
   - 4xx vs 5xx ratio
   - Error type distribution
   - AI service errors specifically

**Implementacja:**

```typescript
// src/lib/services/metrics.service.ts
export class MetricsService {
  recordRequestDuration(endpoint: string, duration: number) {
    // Send to monitoring service
  }

  recordAIServiceCall(success: boolean, duration: number) {
    // Track AI performance
  }

  recordError(endpoint: string, statusCode: number, errorCode: string) {
    // Track error patterns
  }
}
```

---

## 9. Etapy wdrożenia

### Faza 1: Przygotowanie infrastruktury

#### 1.1. Utworzenie struktury folderów

```bash
mkdir -p src/pages/api/generation-requests
mkdir -p src/lib/services
mkdir -p src/lib/validation
mkdir -p src/lib/errors
mkdir -p src/lib/helpers
```

#### 1.2. Instalacja zależności

```bash
npm install zod
npm install @supabase/ssr
```

#### 1.3. Dodanie zmiennych środowiskowych

```env
# .env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-4-turbo
```

### Faza 2: Implementacja warstwy walidacji

#### 2.1. Utworzenie Zod schemas

**Plik:** `src/lib/validation/generation-requests.ts`

```typescript
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

**Test:**

```typescript
// Sprawdzić że:
// - Akceptuje valid text (1000-10000 chars)
// - Odrzuca za krótki text
// - Odrzuca za długi text
// - Trimuje whitespace
```

### Faza 3: Implementacja Custom Error Classes

#### 3.1. AIServiceError

**Plik:** `src/lib/errors/ai-service.error.ts`

```typescript
export class AIServiceError extends Error {
  constructor(
    message: string,
    public reason: string,
    public statusCode: number = 422
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}
```

#### 3.2. DatabaseError

**Plik:** `src/lib/errors/database.error.ts`

```typescript
export class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError: any
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}
```

#### 3.3. RateLimitError

**Plik:** `src/lib/errors/rate-limit.error.ts`

```typescript
export class RateLimitError extends Error {
  constructor(public resetAt: Date) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}
```

### Faza 4: Implementacja Helper Functions

#### 4.1. Error Response Helper

**Plik:** `src/lib/helpers/error-response.ts`

```typescript
import type { ErrorResponse } from "../../types";

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        details,
      },
    } as ErrorResponse),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}
```

#### 4.2. Logger Service

**Plik:** `src/lib/services/logger.service.ts`

```typescript
export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: any) {
    console.log(`[${this.context}] INFO: ${message}`, data || "");
  }

  warning(message: string, data?: any) {
    console.warn(`[${this.context}] WARNING: ${message}`, data || "");
  }

  error(message: string, error: Error, data?: any) {
    console.error(`[${this.context}] ERROR: ${message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...(data || {}),
    });
  }

  critical(message: string, error: Error, data?: any) {
    console.error(`[${this.context}] CRITICAL: ${message}`, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...(data || {}),
    });
  }
}
```

### Faza 5: Implementacja AI Service

#### 5.1. AIService class

**Plik:** `src/lib/services/ai.service.ts`

```typescript
import { AIServiceError } from "../errors/ai-service.error";
import { Logger } from "./logger.service";

const logger = new Logger("AIService");

interface FlashcardData {
  front: string;
  back: string;
}

export class AIService {
  private apiKey: string;
  private model: string;
  private apiUrl = "https://openrouter.ai/api/v1/chat/completions";

  constructor() {
    this.apiKey = import.meta.env.OPENROUTER_API_KEY;
    this.model = import.meta.env.OPENROUTER_MODEL || "openai/gpt-4-turbo";

    if (!this.apiKey) {
      throw new Error("OPENROUTER_API_KEY is not configured");
    }
  }

  async generateFlashcards(sourceText: string): Promise<FlashcardData[]> {
    try {
      logger.info("Generating flashcards via AI", {
        textLength: sourceText.length,
      });

      const prompt = this.buildPrompt(sourceText);

      // HTTP Request to OpenRouter
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
  }

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

  private parseAIResponse(response: any): FlashcardData[] {
    try {
      // Extract content from OpenRouter response
      const content = response.choices?.[0]?.message?.content;

      if (!content) {
        throw new AIServiceError("AI response is empty", "No content in AI response");
      }

      // Try to extract JSON from response (might be wrapped in markdown)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new AIServiceError("Could not parse AI response", "No JSON array found in response");
      }

      const flashcards = JSON.parse(jsonMatch[0]);

      // Validate structure
      if (!Array.isArray(flashcards) || flashcards.length === 0) {
        throw new AIServiceError("Invalid flashcards format", "Expected non-empty array");
      }

      // Validate each flashcard
      for (const fc of flashcards) {
        if (!fc.front || !fc.back || typeof fc.front !== "string" || typeof fc.back !== "string") {
          throw new AIServiceError("Invalid flashcard structure", "Each flashcard must have front and back as strings");
        }
      }

      // Limit to max 20 flashcards
      return flashcards.slice(0, 20);
    } catch (error) {
      if (error instanceof AIServiceError) {
        throw error;
      }

      logger.error("Error parsing AI response", error as Error, { response });
      throw new AIServiceError("Failed to parse AI response", error instanceof Error ? error.message : "Parse error");
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
```

**Test:**

- Mockować OpenRouter API
- Testować poprawne parsowanie
- Testować obsługę błędów
- Testować timeout

### Faza 6: Implementacja Generation Request Service

#### 6.1. GenerationRequestService class

**Plik:** `src/lib/services/generation-request.service.ts`

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { GenerationRequestDTO, FlashcardDTO, CreateGenerationRequestResponse } from "../../types";
import { DatabaseError } from "../errors/database.error";
import { Logger } from "./logger.service";

const logger = new Logger("GenerationRequestService");

interface FlashcardData {
  front: string;
  back: string;
}

export class GenerationRequestService {
  constructor(private supabase: SupabaseClient<Database>) {}

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
        logger.error("Failed to create generation request", grError as any);
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
        logger.error("Failed to create flashcards", fcError as any);

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
        flashcards: flashcards.map(this.mapFlashcardToDTO),
      };
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }

      logger.error("Unexpected error in create", error as Error);
      throw new DatabaseError("Unexpected database error", error);
    }
  }

  private mapGenerationRequestToDTO(entity: any): GenerationRequestDTO {
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

**Test:**

- Testować successful creation
- Testować cleanup przy błędzie flashcards
- Testować mapowanie do DTOs
- Testować RLS (user może tworzyć tylko swoje)

### Faza 7: Implementacja Rate Limiting (Middleware)

#### 7.1. Rate Limit Service

**Plik:** `src/lib/services/rate-limit.service.ts`

```typescript
import { RateLimitError } from "../errors/rate-limit.error";

interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

// In-memory store (dla MVP, w produkcji użyć Redis)
const store = new Map<string, RateLimitEntry>();

export class RateLimitService {
  private limit: number;
  private windowMs: number;

  constructor(limit: number = 10, windowMs: number = 3600000) {
    // 1 hour default
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async check(userId: string, endpoint: string): Promise<void> {
    const key = `${endpoint}:${userId}`;
    const now = new Date();

    const entry = store.get(key);

    // No entry or expired - create new
    if (!entry || entry.resetAt < now) {
      store.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + this.windowMs),
      });
      return;
    }

    // Entry exists and not expired
    if (entry.count >= this.limit) {
      throw new RateLimitError(entry.resetAt);
    }

    // Increment counter
    entry.count++;
    store.set(key, entry);
  }

  getRemaining(userId: string, endpoint: string): number {
    const key = `${endpoint}:${userId}`;
    const entry = store.get(key);

    if (!entry || entry.resetAt < new Date()) {
      return this.limit;
    }

    return Math.max(0, this.limit - entry.count);
  }

  getResetAt(userId: string, endpoint: string): Date | null {
    const key = `${endpoint}:${userId}`;
    const entry = store.get(key);

    if (!entry || entry.resetAt < new Date()) {
      return null;
    }

    return entry.resetAt;
  }
}

// Export singleton
export const rateLimitService = new RateLimitService(10, 3600000);
```

**Test:**

- Testować podstawowe counting
- Testować reset po expiry
- Testować throwing RateLimitError
- Testować getRemaining

### Faza 8: Implementacja Middleware

#### 8.1. Middleware główny

**Plik:** `src/middleware/index.ts`

```typescript
import { defineMiddleware } from "astro:middleware";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "../db/database.types";
import { errorResponse } from "../lib/helpers/error-response";
import { rateLimitService } from "../lib/services/rate-limit.service";
import { RateLimitError } from "../lib/errors/rate-limit.error";

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Initialize Supabase client
  const supabase = createServerClient<Database>(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY, {
    cookies: {
      get: (key) => context.cookies.get(key)?.value,
      set: (key, value, options) => {
        context.cookies.set(key, value, options);
      },
      remove: (key, options) => {
        context.cookies.delete(key, options);
      },
    },
  });

  context.locals.supabase = supabase;

  // 2. Check if this is an API route that requires authentication
  const isApiRoute = context.url.pathname.startsWith("/api/");
  const isAuthRoute = context.url.pathname.startsWith("/api/auth/");

  if (isApiRoute && !isAuthRoute) {
    // Extract and validate JWT token
    const authHeader = context.request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication token is required");
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return errorResponse(401, "AUTH_REQUIRED", "Invalid or expired authentication token");
    }

    context.locals.user = user;

    // 3. Rate limiting for generation-requests endpoint
    if (context.url.pathname === "/api/generation-requests" && context.request.method === "POST") {
      try {
        await rateLimitService.check(user.id, "generation-requests");

        // Add rate limit headers
        const remaining = rateLimitService.getRemaining(user.id, "generation-requests");
        const resetAt = rateLimitService.getResetAt(user.id, "generation-requests");

        // Store for later use in response
        context.locals.rateLimitRemaining = remaining;
        context.locals.rateLimitReset = resetAt;
      } catch (error) {
        if (error instanceof RateLimitError) {
          return errorResponse(
            429,
            "RATE_LIMIT_EXCEEDED",
            "Generation request limit exceeded. Please try again later.",
            {
              limit: 10,
              reset_at: error.resetAt.toISOString(),
            }
          );
        }
        throw error;
      }
    }
  }

  // 4. Continue to endpoint
  const response = await next();

  // 5. Add rate limit headers to response (if available)
  if (context.locals.rateLimitRemaining !== undefined) {
    response.headers.set("X-RateLimit-Limit", "10");
    response.headers.set("X-RateLimit-Remaining", context.locals.rateLimitRemaining.toString());
    if (context.locals.rateLimitReset) {
      response.headers.set("X-RateLimit-Reset", Math.floor(context.locals.rateLimitReset.getTime() / 1000).toString());
    }
  }

  return response;
});
```

#### 8.2. Aktualizacja env.d.ts

**Plik:** `src/env.d.ts`

```typescript
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_MODEL: string;
  readonly SITE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace App {
  interface Locals {
    supabase: import("@supabase/supabase-js").SupabaseClient<import("./db/database.types").Database>;
    user?: {
      id: string;
      email?: string;
    };
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  }
}
```

### Faza 9: Implementacja API Route Handler

#### 9.1. POST handler

**Plik:** `src/pages/api/generation-requests/index.ts`

```typescript
import type { APIContext } from "astro";
import { CreateGenerationRequestSchema } from "../../../lib/validation/generation-requests";
import { errorResponse } from "../../../lib/helpers/error-response";
import { aiService } from "../../../lib/services/ai.service";
import { GenerationRequestService } from "../../../lib/services/generation-request.service";
import { AIServiceError } from "../../../lib/errors/ai-service.error";
import { DatabaseError } from "../../../lib/errors/database.error";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("POST /api/generation-requests");

// Disable prerendering for API routes
export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Extract context data (set by middleware)
    const supabase = context.locals.supabase;
    const user = context.locals.user;

    if (!user) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // 2. Parse request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      return errorResponse(400, "VALIDATION_ERROR", "Invalid JSON in request body");
    }

    // 3. Validate input with Zod
    const validationResult = CreateGenerationRequestSchema.safeParse(requestBody);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
        errors: validationResult.error.errors,
      });
    }

    const { source_text } = validationResult.data;

    logger.info("Processing generation request", {
      userId: user.id,
      textLength: source_text.length,
    });

    // 4. Generate flashcards via AI
    let flashcardsData;
    try {
      flashcardsData = await aiService.generateFlashcards(source_text);
    } catch (error) {
      if (error instanceof AIServiceError) {
        logger.warning("AI service error", { error: error.message, reason: error.reason });
        return errorResponse(422, "AI_SERVICE_ERROR", error.message, {
          reason: error.reason,
        });
      }
      throw error; // Re-throw unexpected errors
    }

    // 5. Create generation request and flashcards in database
    let result;
    try {
      const generationRequestService = new GenerationRequestService(supabase);
      result = await generationRequestService.create(user.id, source_text, flashcardsData);
    } catch (error) {
      if (error instanceof DatabaseError) {
        logger.error("Database error", error, { userId: user.id });
        return errorResponse(500, "INTERNAL_ERROR", "Failed to save generation request");
      }
      throw error;
    }

    logger.info("Successfully created generation request", {
      userId: user.id,
      generationRequestId: result.generation_request.id,
      flashcardsCount: result.flashcards.length,
    });

    // 6. Return success response
    return new Response(JSON.stringify(result), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    // Catch-all for unexpected errors
    logger.critical("Unexpected error in POST handler", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "An unexpected error occurred. Please try again later.");
  }
}
```

**Test:**

- Testować successful flow
- Testować każdy error case
- Testować rate limiting headers
- Testować authentication

### Faza 10: Testing & Quality Assurance

#### 10.1. Unit Tests

```typescript
// tests/lib/validation/generation-requests.test.ts
describe("CreateGenerationRequestSchema", () => {
  it("should accept valid source_text", () => {
    const text = "A".repeat(5000);
    const result = CreateGenerationRequestSchema.safeParse({ source_text: text });
    expect(result.success).toBe(true);
  });

  it("should reject text shorter than 1000 chars", () => {
    const text = "A".repeat(999);
    const result = CreateGenerationRequestSchema.safeParse({ source_text: text });
    expect(result.success).toBe(false);
  });

  it("should reject text longer than 10000 chars", () => {
    const text = "A".repeat(10001);
    const result = CreateGenerationRequestSchema.safeParse({ source_text: text });
    expect(result.success).toBe(false);
  });

  it("should trim whitespace", () => {
    const text = "  " + "A".repeat(5000) + "  ";
    const result = CreateGenerationRequestSchema.safeParse({ source_text: text });
    expect(result.success).toBe(true);
    expect(result.data?.source_text).not.toMatch(/^\s/);
    expect(result.data?.source_text).not.toMatch(/\s$/);
  });
});
```

#### 10.2. Integration Tests

```typescript
// tests/api/generation-requests.test.ts
describe("POST /api/generation-requests", () => {
  it("should return 401 without authentication", async () => {
    const response = await fetch("/api/generation-requests", {
      method: "POST",
      body: JSON.stringify({ source_text: "A".repeat(5000) }),
    });
    expect(response.status).toBe(401);
  });

  it("should create generation request with valid input", async () => {
    const token = await getAuthToken();
    const response = await fetch("/api/generation-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source_text: "A".repeat(5000) }),
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.generation_request).toBeDefined();
    expect(data.flashcards).toBeInstanceOf(Array);
  });

  it("should enforce rate limiting", async () => {
    const token = await getAuthToken();

    // Make 10 requests (limit)
    for (let i = 0; i < 10; i++) {
      await fetch("/api/generation-requests", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ source_text: "A".repeat(5000) }),
      });
    }

    // 11th request should fail
    const response = await fetch("/api/generation-requests", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ source_text: "A".repeat(5000) }),
    });

    expect(response.status).toBe(429);
  });
});
```

#### 10.3. Manual Testing Checklist

- [ ] Successful generation request with valid text
- [ ] Error response for text < 1000 chars
- [ ] Error response for text > 10000 chars
- [ ] Error response without authentication
- [ ] Rate limiting enforcement (10 requests/hour)
- [ ] Rate limit headers in response
- [ ] Database records created correctly
- [ ] RLS policies enforced
- [ ] AI service integration working
- [ ] Error logging functioning
- [ ] Performance acceptable (< 10s P95)

### Faza 11: Deployment & Monitoring

#### 11.1. Environment Variables (Production)

```bash
# Production .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_production_anon_key
OPENROUTER_API_KEY=your_production_openrouter_key
OPENROUTER_MODEL=openai/gpt-4-turbo
SITE=https://your-production-domain.com
NODE_ENV=production
```

#### 11.2. Monitoring Setup

- **Logging:** Integrate with external service (Sentry, LogRocket)
- **Metrics:** Track response times, error rates, AI success rate
- **Alerts:** Set up alerts for:
  - High error rate (> 5%)
  - Slow response time (P95 > 15s)
  - AI service failures
  - Database connection issues

#### 11.3. Documentation

- Update API documentation with actual endpoint
- Document error codes and responses
- Provide example requests/responses
- Document rate limiting behavior

---

## 10. Checklist końcowy

### Pre-deployment

- [ ] Wszystkie testy jednostkowe przechodzą
- [ ] Wszystkie testy integracyjne przechodzą
- [ ] Manual testing completed
- [ ] Code review wykonany
- [ ] Zmienne środowiskowe skonfigurowane
- [ ] Database migrations uruchomione
- [ ] RLS policies zweryfikowane
- [ ] Dokumentacja zaktualizowana

### Deployment

- [ ] Deployed to staging
- [ ] Smoke tests na staging
- [ ] Performance testing na staging
- [ ] Deployed to production
- [ ] Smoke tests na production
- [ ] Monitoring skonfigurowane
- [ ] Alerts skonfigurowane

### Post-deployment

- [ ] Monitor error rates (first 24h)
- [ ] Monitor performance metrics
- [ ] Monitor AI service integration
- [ ] Monitor rate limiting behavior
- [ ] Collect user feedback
- [ ] Document lessons learned

---

## 11. Potencjalne rozszerzenia (Future)

1. **Asynchroniczne przetwarzanie:** Job queue dla długotrwałych AI requests
2. **Caching:** Cache powtarzających się tekstów
3. **Batch processing:** Generowanie wielu zestawów fiszek naraz
4. **Webhooks:** Powiadomienia po zakończeniu generowania
5. **Analytics:** Szczegółowe metryki użycia AI
6. **A/B Testing:** Testowanie różnych promptów AI
7. **Multi-language support:** Generowanie w różnych językach
8. **Custom models:** Możliwość wyboru modelu AI
9. **Preview mode:** Podgląd fiszek przed zapisem
10. **Regenerate:** Możliwość ponownego wygenerowania dla tego samego tekstu

---

## Notatki dodatkowe

### Ważne decyzje projektowe

1. **Rate limiting in-memory:** Dla MVP, migrate do Redis w produkcji
2. **Synchronous processing:** Dla prostoty, rozważyć async w przyszłości
3. **No caching:** Każde żądanie generuje nowe fiszki
4. **Max 20 flashcards:** Limit dla performance i user experience
5. **No preview:** Fiszki zapisywane bezpośrednio z status pending_review
6. **Type safety improvements:**
   - Dodano union type `FlashcardQuality` (0 | 1 | 2 | 3 | 4 | 5) dla lepszej type safety
   - Zaktualizowano type guards do zwracania konkretnych typów
   - Dodano szczegółową dokumentację wartości domyślnych w FlashcardDTO

### Znane ograniczenia

1. Rate limit store resetuje się po restart serwera
2. Brak transakcji database (Supabase limitation)
3. AI timeouts mogą powodować frustrację użytkowników
4. Brak progress indicator dla długich requestów

### Kontakt i wsparcie

- **Tech Lead:** [Nazwa]
- **Database Admin:** [Nazwa]
- **DevOps:** [Nazwa]
- **Documentation:** [Link do wiki/docs]

---

**Autor:** AI Architecture Team  
**Data:** 2025-10-11  
**Wersja:** 1.0  
**Status:** Ready for Implementation
