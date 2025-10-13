# Plan Implementacji Usługi OpenRouter

## 1. Opis Usługi

### 1.1 Cel i Odpowiedzialność

`OpenRouterService` to warstwa abstrakcji zapewniająca ujednolicony interfejs do komunikacji z API OpenRouter. Usługa ta będzie odpowiedzialna za:

- **Zarządzanie komunikacją z API OpenRouter** - wysyłanie żądań i odbieranie odpowiedzi
- **Strukturyzację żądań** - budowanie poprawnych payloadów zgodnych z specyfikacją OpenRouter API
- **Walidację odpowiedzi** - weryfikację i parsowanie odpowiedzi z wykorzystaniem JSON Schema
- **Obsługę błędów** - przechwytywanie i transformację błędów API na błędy domenowe aplikacji
- **Zarządzanie konfiguracją** - centralne zarządzanie kluczem API, nazwą modelu i parametrami
- **Logowanie** - szczegółowe logowanie wszystkich operacji dla celów debugowania i monitorowania

### 1.2 Architektura

Usługa będzie warstwą pośrednią między:
- **Warstwa wyższa** (np. `AIService`) - która definiuje domenową logikę generowania flashcards
- **Warstwa niższa** (OpenRouter API) - która dostarcza surowe możliwości LLM

```
AIService (domena biznesowa)
    ↓
OpenRouterService (komunikacja z API)
    ↓
OpenRouter API (LLM)
```

### 1.3 Kluczowe Cechy

1. **Typowanie statyczne** - pełne TypeScript typowanie dla wszystkich żądań i odpowiedzi
2. **JSON Schema validation** - wymuszanie struktury odpowiedzi za pomocą `response_format`
3. **Konfigurowalność** - elastyczne zarządzanie modelami i parametrami
4. **Obsługa błędów** - dedykowane typy błędów dla różnych scenariuszy
5. **Timeout handling** - automatyczne timeouty dla długo trwających żądań
6. **Retry logic** - opcjonalna logika ponawiania dla błędów przejściowych
7. **Logowanie** - strukturalne logowanie wszystkich operacji

## 2. Opis Konstruktora

### 2.1 Sygnatura

```typescript
constructor(options?: OpenRouterServiceOptions)
```

### 2.2 Parametry Konfiguracyjne

```typescript
interface OpenRouterServiceOptions {
  /** 
   * Klucz API OpenRouter
   * Domyślnie: import.meta.env.OPENROUTER_API_KEY
   */
  apiKey?: string;
  
  /** 
   * Nazwa modelu LLM
   * Domyślnie: import.meta.env.OPENROUTER_MODEL lub "openai/gpt-4-turbo"
   * Przykłady: "openai/gpt-4-turbo", "anthropic/claude-3-opus", "google/gemini-pro"
   */
  model?: string;
  
  /** 
   * URL bazowy API
   * Domyślnie: "https://openrouter.ai/api/v1/chat/completions"
   */
  apiUrl?: string;
  
  /** 
   * Timeout dla żądań (ms)
   * Domyślnie: 30000 (30 sekund)
   */
  timeout?: number;
  
  /** 
   * HTTP Referer dla statystyk OpenRouter
   * Domyślnie: import.meta.env.SITE lub "http://localhost:4321"
   */
  httpReferer?: string;
  
  /** 
   * Nazwa aplikacji dla statystyk OpenRouter
   * Domyślnie: "10x-cards"
   */
  appTitle?: string;
  
  /**
   * Domyślne parametry modelu
   */
  defaultParams?: ModelParameters;
}

interface ModelParameters {
  /** 
   * Kontrola randomizacji (0.0 - 2.0)
   * 0.0 = deterministyczne, 2.0 = bardzo kreatywne
   * Domyślnie: 0.7
   */
  temperature?: number;
  
  /** 
   * Maksymalna liczba tokenów w odpowiedzi
   * Domyślnie: 2000
   */
  max_tokens?: number;
  
  /** 
   * Top-p sampling (0.0 - 1.0)
   * Domyślnie: 1.0
   */
  top_p?: number;
  
  /** 
   * Frequency penalty (-2.0 - 2.0)
   * Zmniejsza powtarzanie tych samych fraz
   * Domyślnie: 0.0
   */
  frequency_penalty?: number;
  
  /** 
   * Presence penalty (-2.0 - 2.0)
   * Zachęca do nowych tematów
   * Domyślnie: 0.0
   */
  presence_penalty?: number;
}
```

### 2.3 Logika Inicjalizacji

Konstruktor powinien:
1. Załadować wartości z `import.meta.env` jako domyślne
2. Nadpisać domyślne wartości parametrami przekazanymi w `options`
3. Zwalidować obecność wymaganych wartości (szczególnie `apiKey`)
4. Zainicjalizować logger z kontekstem "OpenRouterService"
5. Zalogować informacje o konfiguracji (bez ujawniania klucza API)

### 2.4 Przykład Użycia

```typescript
// Domyślna konfiguracja (z env)
const service = new OpenRouterService();

// Niestandardowa konfiguracja
const customService = new OpenRouterService({
  model: "anthropic/claude-3-opus",
  timeout: 60000,
  defaultParams: {
    temperature: 0.5,
    max_tokens: 3000,
  }
});
```

## 3. Publiczne Metody i Pola

### 3.1 Metoda: `chat()` - Uniwersalna Metoda Czatu

Podstawowa metoda do wykonywania zapytań do modelu LLM.

#### Sygnatura

```typescript
async chat<T = unknown>(request: ChatRequest<T>): Promise<ChatResponse<T>>
```

#### Parametry Żądania

```typescript
interface ChatRequest<T = unknown> {
  /** 
   * Komunikat systemowy
   * Definiuje rolę i zachowanie asystenta
   */
  systemMessage: string;
  
  /** 
   * Komunikat użytkownika
   * Główny prompt z pytaniem lub instrukcją
   */
  userMessage: string;
  
  /** 
   * Opcjonalny schemat JSON dla odpowiedzi
   * Gdy podany, wymusza strukturyzowaną odpowiedź
   */
  responseSchema?: JsonSchema<T>;
  
  /** 
   * Opcjonalne nadpisanie modelu
   * Jeśli nie podane, użyje modelu z konstruktora
   */
  model?: string;
  
  /** 
   * Opcjonalne nadpisanie parametrów modelu
   * Łączone z defaultParams z konstruktora
   */
  params?: Partial<ModelParameters>;
  
  /** 
   * Historia konwersacji (opcjonalna)
   * Umożliwia kontynuację rozmowy
   */
  conversationHistory?: Message[];
}

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface JsonSchema<T = unknown> {
  /** Nazwa schematu (np. "flashcard_response") */
  name: string;
  
  /** Opis schematu */
  description?: string;
  
  /** Schemat JSON zgodny z JSON Schema Draft 7 */
  schema: {
    type: "object" | "array";
    properties?: Record<string, unknown>;
    items?: unknown;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  };
  
  /** 
   * Strict mode (domyślnie true)
   * Gdy true, model musi ściśle przestrzegać schematu
   */
  strict?: boolean;
}
```

#### Typ Odpowiedzi

```typescript
interface ChatResponse<T = unknown> {
  /** 
   * Sparsowana odpowiedź modelu
   * Typ T jeśli podano responseSchema, string w przeciwnym razie
   */
  content: T;
  
  /** 
   * Surowa odpowiedź z API (dla debugowania)
   */
  raw: OpenRouterApiResponse;
  
  /** 
   * Metadane odpowiedzi
   */
  metadata: ResponseMetadata;
}

interface ResponseMetadata {
  /** Model użyty do generowania odpowiedzi */
  model: string;
  
  /** Liczba tokenów w prompcie */
  promptTokens: number;
  
  /** Liczba tokenów w odpowiedzi */
  completionTokens: number;
  
  /** Całkowita liczba tokenów */
  totalTokens: number;
  
  /** Czas trwania żądania (ms) */
  duration: number;
  
  /** Przyczyna zakończenia ("stop", "length", "content_filter") */
  finishReason: string;
}
```

#### Przykłady Użycia

##### Przykład 1: Prosty czat bez schematu

```typescript
const response = await openRouterService.chat({
  systemMessage: "You are a helpful assistant.",
  userMessage: "What is the capital of France?",
});

console.log(response.content); // "The capital of France is Paris."
```

##### Przykład 2: Czat ze strukturyzowaną odpowiedzią

```typescript
interface FlashcardsResponse {
  flashcards: Array<{
    front: string;
    back: string;
  }>;
}

const response = await openRouterService.chat<FlashcardsResponse>({
  systemMessage: "You are an educational assistant that generates flashcards.",
  userMessage: `Generate 3 flashcards about photosynthesis.`,
  responseSchema: {
    name: "flashcards_response",
    description: "A response containing an array of flashcards",
    schema: {
      type: "object",
      properties: {
        flashcards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              front: { type: "string", description: "Question" },
              back: { type: "string", description: "Answer" }
            },
            required: ["front", "back"],
            additionalProperties: false
          }
        }
      },
      required: ["flashcards"],
      additionalProperties: false
    },
    strict: true
  }
});

// TypeScript wie, że response.content to FlashcardsResponse
response.content.flashcards.forEach(card => {
  console.log(`Q: ${card.front}`);
  console.log(`A: ${card.back}`);
});
```

##### Przykład 3: Czat z niestandardowymi parametrami

```typescript
const response = await openRouterService.chat({
  systemMessage: "You are a creative storyteller.",
  userMessage: "Write a short story about a robot.",
  model: "anthropic/claude-3-opus",
  params: {
    temperature: 1.5,
    max_tokens: 1000,
  }
});
```

##### Przykład 4: Kontynuacja konwersacji

```typescript
const response = await openRouterService.chat({
  systemMessage: "You are a helpful tutor.",
  userMessage: "Can you explain more about that?",
  conversationHistory: [
    { role: "user", content: "What is machine learning?" },
    { role: "assistant", content: "Machine learning is a subset of AI..." }
  ]
});
```

### 3.2 Metoda: `generateStructured()` - Uproszczona Generacja ze Schematem

Wygodna metoda wrappująca `chat()` dla przypadków wymagających strukturyzowanej odpowiedzi.

#### Sygnatura

```typescript
async generateStructured<T>(
  systemMessage: string,
  userMessage: string,
  schema: JsonSchema<T>,
  options?: GenerateOptions
): Promise<T>
```

#### Parametry

```typescript
interface GenerateOptions {
  model?: string;
  params?: Partial<ModelParameters>;
}
```

#### Przykład Użycia

```typescript
interface QuizResponse {
  questions: Array<{
    question: string;
    options: string[];
    correctAnswer: number;
  }>;
}

const quiz = await openRouterService.generateStructured<QuizResponse>(
  "You are an educational quiz generator.",
  "Create 5 multiple choice questions about World War II.",
  {
    name: "quiz_response",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              options: { 
                type: "array",
                items: { type: "string" },
                minItems: 4,
                maxItems: 4
              },
              correctAnswer: { 
                type: "number",
                minimum: 0,
                maximum: 3
              }
            },
            required: ["question", "options", "correctAnswer"]
          }
        }
      },
      required: ["questions"]
    }
  }
);

// Bezpośredni dostęp do struktury
quiz.questions.forEach(q => {
  console.log(q.question);
  console.log(q.options[q.correctAnswer]); // Poprawna odpowiedź
});
```

### 3.3 Metoda: `validateApiKey()` - Walidacja Klucza API

Metoda sprawdzająca poprawność klucza API poprzez wykonanie minimalnego żądania testowego.

#### Sygnatura

```typescript
async validateApiKey(): Promise<boolean>
```

#### Przykład Użycia

```typescript
try {
  const isValid = await openRouterService.validateApiKey();
  if (isValid) {
    console.log("API key is valid");
  }
} catch (error) {
  console.error("API key validation failed:", error);
}
```

### 3.4 Właściwość: `model` (get/set)

Umożliwia odczyt i zmianę aktualnie używanego modelu.

```typescript
// Getter
get model(): string

// Setter
set model(value: string)
```

#### Przykład Użycia

```typescript
console.log(service.model); // "openai/gpt-4-turbo"

service.model = "anthropic/claude-3-opus";
// Kolejne żądania użyją nowego modelu
```

## 4. Prywatne Metody i Pola

### 4.1 Pola Prywatne

```typescript
private readonly apiKey: string;
private apiUrl: string;
private currentModel: string;
private timeout: number;
private httpReferer: string;
private appTitle: string;
private defaultParams: ModelParameters;
private logger: Logger;
```

### 4.2 Metoda: `buildRequestPayload()` - Budowanie Payloadu Żądania

Konstruuje pełny payload dla OpenRouter API zgodnie ze specyfikacją.

#### Sygnatura

```typescript
private buildRequestPayload<T>(request: ChatRequest<T>): OpenRouterRequestPayload
```

#### Struktura Payloadu

```typescript
interface OpenRouterRequestPayload {
  /** Nazwa modelu */
  model: string;
  
  /** Tablica komunikatów */
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  
  /** Parametry modelu */
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  
  /** Format odpowiedzi (opcjonalny) */
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      description?: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
}
```

#### Logika Implementacji

1. Utwórz tablicę `messages`:
   - Dodaj komunikat systemowy (role: "system")
   - Dodaj historię konwersacji (jeśli podana)
   - Dodaj komunikat użytkownika (role: "user")

2. Wybierz model:
   - Użyj `request.model` jeśli podany
   - W przeciwnym razie użyj `this.currentModel`

3. Scal parametry:
   - Rozpocznij od `this.defaultParams`
   - Nadpisz wartościami z `request.params`

4. Dodaj `response_format` jeśli `request.responseSchema` jest podany:
   ```typescript
   response_format: {
     type: "json_schema",
     json_schema: {
       name: request.responseSchema.name,
       description: request.responseSchema.description,
       strict: request.responseSchema.strict ?? true,
       schema: request.responseSchema.schema
     }
   }
   ```

#### Przykład Wyjścia

```json
{
  "model": "openai/gpt-4-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a flashcard generator."
    },
    {
      "role": "user",
      "content": "Generate flashcards about chemistry."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 2000,
  "response_format": {
    "type": "json_schema",
    "json_schema": {
      "name": "flashcards_response",
      "strict": true,
      "schema": {
        "type": "object",
        "properties": {
          "flashcards": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "front": { "type": "string" },
                "back": { "type": "string" }
              },
              "required": ["front", "back"]
            }
          }
        },
        "required": ["flashcards"]
      }
    }
  }
}
```

### 4.3 Metoda: `executeRequest()` - Wykonanie HTTP Request

Wykonuje żądanie HTTP do OpenRouter API z odpowiednimi nagłówkami i obsługą timeout.

#### Sygnatura

```typescript
private async executeRequest(
  payload: OpenRouterRequestPayload
): Promise<OpenRouterApiResponse>
```

#### Nagłówki HTTP

```typescript
const headers = {
  "Authorization": `Bearer ${this.apiKey}`,
  "Content-Type": "application/json",
  "HTTP-Referer": this.httpReferer,
  "X-Title": this.appTitle,
};
```

#### Obsługa Timeout

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.timeout);

try {
  const response = await fetch(this.apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    signal: controller.signal
  });
  
  return await response.json();
} finally {
  clearTimeout(timeoutId);
}
```

#### Obsługa Statusów HTTP

- **200-299**: Sukces - zwróć odpowiedź
- **400**: Bad Request - rzuć `OpenRouterValidationError`
- **401**: Unauthorized - rzuć `OpenRouterAuthError`
- **403**: Forbidden - rzuć `OpenRouterAuthError`
- **429**: Rate Limited - rzuć `OpenRouterRateLimitError`
- **500-599**: Server Error - rzuć `OpenRouterServerError`
- **Timeout**: Rzuć `OpenRouterTimeoutError`

### 4.4 Metoda: `parseResponse()` - Parsowanie Odpowiedzi

Ekstrahuje i parsuje zawartość z odpowiedzi OpenRouter API.

#### Sygnatura

```typescript
private parseResponse<T>(
  apiResponse: OpenRouterApiResponse,
  hasSchema: boolean
): T | string
```

#### Logika Implementacji

1. Wyciągnij content z `apiResponse.choices[0].message.content`
2. Jeśli `hasSchema === true`:
   - Spróbuj sparsować jako JSON
   - Zwaliduj zgodność ze schematem (podstawowa walidacja)
   - Zwróć sparsowany obiekt typu T
3. Jeśli `hasSchema === false`:
   - Zwróć surowy string

#### Obsługa Błędów

- Brak `choices` w odpowiedzi → `OpenRouterInvalidResponseError`
- Pusty `content` → `OpenRouterInvalidResponseError`
- JSON parse error gdy `hasSchema === true` → `OpenRouterInvalidResponseError`

### 4.5 Metoda: `extractMetadata()` - Ekstrakcja Metadanych

Wyciąga metadane z odpowiedzi API.

#### Sygnatura

```typescript
private extractMetadata(
  apiResponse: OpenRouterApiResponse,
  startTime: number
): ResponseMetadata
```

#### Implementacja

```typescript
return {
  model: apiResponse.model,
  promptTokens: apiResponse.usage?.prompt_tokens ?? 0,
  completionTokens: apiResponse.usage?.completion_tokens ?? 0,
  totalTokens: apiResponse.usage?.total_tokens ?? 0,
  duration: Date.now() - startTime,
  finishReason: apiResponse.choices?.[0]?.finish_reason ?? "unknown"
};
```

### 4.6 Typy API Response

```typescript
interface OpenRouterApiResponse {
  id: string;
  model: string;
  created: number;
  object: string;
  
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
  }>;
  
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  
  error?: {
    message: string;
    type: string;
    code: string;
  };
}
```

## 5. Obsługa Błędów

### 5.1 Hierarchia Błędów

```typescript
// Bazowy błąd OpenRouter
export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "OpenRouterError";
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OpenRouterError);
    }
  }
}

// Błąd konfiguracji (brak klucza API)
export class OpenRouterConfigError extends OpenRouterError {
  constructor(message: string) {
    super(message, "OPENROUTER_CONFIG_ERROR", 500);
    this.name = "OpenRouterConfigError";
  }
}

// Błąd autentykacji (401, 403)
export class OpenRouterAuthError extends OpenRouterError {
  constructor(message: string, statusCode: number) {
    super(message, "OPENROUTER_AUTH_ERROR", statusCode);
    this.name = "OpenRouterAuthError";
  }
}

// Błąd walidacji żądania (400)
export class OpenRouterValidationError extends OpenRouterError {
  constructor(
    message: string,
    public readonly validationErrors?: unknown
  ) {
    super(message, "OPENROUTER_VALIDATION_ERROR", 400);
    this.name = "OpenRouterValidationError";
  }
}

// Błąd rate limit (429)
export class OpenRouterRateLimitError extends OpenRouterError {
  constructor(
    message: string,
    public readonly resetAt?: Date
  ) {
    super(message, "OPENROUTER_RATE_LIMIT_ERROR", 429);
    this.name = "OpenRouterRateLimitError";
  }
}

// Błąd serwera OpenRouter (500-599)
export class OpenRouterServerError extends OpenRouterError {
  constructor(message: string, statusCode: number) {
    super(message, "OPENROUTER_SERVER_ERROR", statusCode);
    this.name = "OpenRouterServerError";
  }
}

// Błąd timeout
export class OpenRouterTimeoutError extends OpenRouterError {
  constructor(
    public readonly timeoutMs: number
  ) {
    super(
      `Request timed out after ${timeoutMs}ms`,
      "OPENROUTER_TIMEOUT_ERROR",
      408
    );
    this.name = "OpenRouterTimeoutError";
  }
}

// Błąd parsowania odpowiedzi
export class OpenRouterInvalidResponseError extends OpenRouterError {
  constructor(
    message: string,
    public readonly rawResponse?: unknown
  ) {
    super(message, "OPENROUTER_INVALID_RESPONSE_ERROR", 502);
    this.name = "OpenRouterInvalidResponseError";
  }
}
```

### 5.2 Scenariusze Błędów

#### Scenariusz 1: Brak Klucza API

```typescript
// W konstruktorze
if (!this.apiKey) {
  throw new OpenRouterConfigError(
    "OpenRouter API key is missing. Set OPENROUTER_API_KEY environment variable."
  );
}
```

#### Scenariusz 2: Nieprawidłowy Klucz API (401)

```typescript
if (response.status === 401) {
  throw new OpenRouterAuthError(
    "Invalid API key. Please check your OPENROUTER_API_KEY.",
    401
  );
}
```

#### Scenariusz 3: Rate Limit (429)

```typescript
if (response.status === 429) {
  const resetAt = response.headers.get("X-RateLimit-Reset");
  const resetDate = resetAt ? new Date(parseInt(resetAt) * 1000) : undefined;
  
  throw new OpenRouterRateLimitError(
    "Rate limit exceeded. Please try again later.",
    resetDate
  );
}
```

#### Scenariusz 4: Timeout

```typescript
try {
  const response = await fetch(this.apiUrl, {
    signal: AbortSignal.timeout(this.timeout)
  });
} catch (error) {
  if (error.name === "AbortError" || error.name === "TimeoutError") {
    throw new OpenRouterTimeoutError(this.timeout);
  }
  throw error;
}
```

#### Scenariusz 5: Nieprawidłowa Odpowiedź JSON

```typescript
try {
  const data = JSON.parse(content);
  return data as T;
} catch (error) {
  throw new OpenRouterInvalidResponseError(
    "Failed to parse JSON response. Expected structured JSON but received invalid format.",
    content
  );
}
```

#### Scenariusz 6: Błąd Walidacji (400)

```typescript
if (response.status === 400) {
  const errorData = await response.json();
  throw new OpenRouterValidationError(
    errorData.error?.message || "Request validation failed",
    errorData.error
  );
}
```

#### Scenariusz 7: Błąd Serwera (500-599)

```typescript
if (response.status >= 500) {
  const errorData = await response.json().catch(() => ({}));
  throw new OpenRouterServerError(
    errorData.error?.message || "OpenRouter server error",
    response.status
  );
}
```

### 5.3 Struktura Pliku Błędów

Utwórz `src/lib/errors/openrouter.error.ts`:

```typescript
/**
 * Custom error classes for OpenRouter service
 * 
 * These errors represent different failure scenarios when
 * communicating with the OpenRouter API.
 */

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "OpenRouterError";
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OpenRouterError);
    }
  }
}

// ... pozostałe klasy błędów ...
```

## 6. Kwestie Bezpieczeństwa

### 6.1 Ochrona Klucza API

#### Nigdy nie loguj klucza API

```typescript
// ❌ ŹLE
logger.info("Initializing OpenRouter", { apiKey: this.apiKey });

// ✅ DOBRZE
logger.info("Initializing OpenRouter", { 
  hasApiKey: !!this.apiKey,
  apiKeyPrefix: this.apiKey?.substring(0, 8) + "..." 
});
```

#### Walidacja obecności klucza

```typescript
constructor(options?: OpenRouterServiceOptions) {
  this.apiKey = options?.apiKey || import.meta.env.OPENROUTER_API_KEY || "";
  
  if (!this.apiKey) {
    throw new OpenRouterConfigError(
      "OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable."
    );
  }
  
  // Walidacja formatu (opcjonalna)
  if (this.apiKey.length < 20) {
    logger.warning("API key seems unusually short. This might be invalid.");
  }
}
```

### 6.2 Sanityzacja Logów

Nigdy nie loguj:
- Pełnych kluczy API
- Pełnych tokenów
- Danych osobowych użytkowników w komunikatach

```typescript
// Bezpieczne logowanie żądań
logger.info("Sending chat request", {
  model: payload.model,
  messageCount: payload.messages.length,
  hasResponseFormat: !!payload.response_format,
  temperature: payload.temperature,
  // NIE loguj: pełnych komunikatów, kluczy API
});
```

### 6.3 Walidacja Input

```typescript
private validateChatRequest<T>(request: ChatRequest<T>): void {
  // Walidacja systemMessage
  if (!request.systemMessage || request.systemMessage.trim().length === 0) {
    throw new OpenRouterValidationError("systemMessage cannot be empty");
  }
  
  if (request.systemMessage.length > 10000) {
    throw new OpenRouterValidationError(
      "systemMessage is too long (max 10000 characters)"
    );
  }
  
  // Walidacja userMessage
  if (!request.userMessage || request.userMessage.trim().length === 0) {
    throw new OpenRouterValidationError("userMessage cannot be empty");
  }
  
  if (request.userMessage.length > 50000) {
    throw new OpenRouterValidationError(
      "userMessage is too long (max 50000 characters)"
    );
  }
  
  // Walidacja parametrów
  if (request.params?.temperature !== undefined) {
    if (request.params.temperature < 0 || request.params.temperature > 2) {
      throw new OpenRouterValidationError(
        "temperature must be between 0 and 2"
      );
    }
  }
  
  if (request.params?.max_tokens !== undefined) {
    if (request.params.max_tokens < 1 || request.params.max_tokens > 100000) {
      throw new OpenRouterValidationError(
        "max_tokens must be between 1 and 100000"
      );
    }
  }
}
```

### 6.4 Rate Limiting na Poziomie Klienta

Rozważ implementację lokalnego rate limiting aby uniknąć przekroczenia limitów OpenRouter:

```typescript
private requestTimestamps: number[] = [];
private readonly MAX_REQUESTS_PER_MINUTE = 60;

private checkLocalRateLimit(): void {
  const now = Date.now();
  const oneMinuteAgo = now - 60000;
  
  // Usuń stare timestamps
  this.requestTimestamps = this.requestTimestamps.filter(
    ts => ts > oneMinuteAgo
  );
  
  if (this.requestTimestamps.length >= this.MAX_REQUESTS_PER_MINUTE) {
    throw new OpenRouterRateLimitError(
      "Local rate limit exceeded. Maximum 60 requests per minute.",
      new Date(this.requestTimestamps[0] + 60000)
    );
  }
  
  this.requestTimestamps.push(now);
}
```

### 6.5 Timeout i Abort

Zawsze używaj timeout dla żądań aby uniknąć wieszania się aplikacji:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), this.timeout);

try {
  const response = await fetch(this.apiUrl, {
    signal: controller.signal,
    // ... inne opcje
  });
  
  return await response.json();
} finally {
  clearTimeout(timeoutId);
}
```

### 6.6 HTTPS i Weryfikacja Certyfikatów

- Zawsze używaj HTTPS dla produkcji
- W środowisku Node.js, upewnij się że certyfikaty SSL są weryfikowane
- Nigdy nie wyłączaj weryfikacji SSL w produkcji

```typescript
// URL API powinien zawsze zaczynać się od https://
if (!this.apiUrl.startsWith("https://") && import.meta.env.PROD) {
  logger.warning("API URL should use HTTPS in production");
}
```

## 7. Plan Wdrożenia Krok po Kroku

### Krok 1: Przygotowanie Struktury Plików

#### 1.1 Utwórz plik błędów

Ścieżka: `src/lib/errors/openrouter.error.ts`

```typescript
/**
 * Custom error classes for OpenRouter service
 */

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "OpenRouterError";
    
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OpenRouterError);
    }
  }
}

export class OpenRouterConfigError extends OpenRouterError {
  constructor(message: string) {
    super(message, "OPENROUTER_CONFIG_ERROR", 500);
    this.name = "OpenRouterConfigError";
  }
}

export class OpenRouterAuthError extends OpenRouterError {
  constructor(message: string, statusCode: number) {
    super(message, "OPENROUTER_AUTH_ERROR", statusCode);
    this.name = "OpenRouterAuthError";
  }
}

export class OpenRouterValidationError extends OpenRouterError {
  constructor(
    message: string,
    public readonly validationErrors?: unknown
  ) {
    super(message, "OPENROUTER_VALIDATION_ERROR", 400);
    this.name = "OpenRouterValidationError";
  }
}

export class OpenRouterRateLimitError extends OpenRouterError {
  constructor(
    message: string,
    public readonly resetAt?: Date
  ) {
    super(message, "OPENROUTER_RATE_LIMIT_ERROR", 429);
    this.name = "OpenRouterRateLimitError";
  }
}

export class OpenRouterServerError extends OpenRouterError {
  constructor(message: string, statusCode: number) {
    super(message, "OPENROUTER_SERVER_ERROR", statusCode);
    this.name = "OpenRouterServerError";
  }
}

export class OpenRouterTimeoutError extends OpenRouterError {
  constructor(
    public readonly timeoutMs: number
  ) {
    super(
      `Request timed out after ${timeoutMs}ms`,
      "OPENROUTER_TIMEOUT_ERROR",
      408
    );
    this.name = "OpenRouterTimeoutError";
  }
}

export class OpenRouterInvalidResponseError extends OpenRouterError {
  constructor(
    message: string,
    public readonly rawResponse?: unknown
  ) {
    super(message, "OPENROUTER_INVALID_RESPONSE_ERROR", 502);
    this.name = "OpenRouterInvalidResponseError";
  }
}
```

#### 1.2 Utwórz plik serwisu

Ścieżka: `src/lib/services/openrouter.service.ts`

### Krok 2: Implementacja Typów

```typescript
import { Logger } from "./logger.service";
import {
  OpenRouterError,
  OpenRouterConfigError,
  OpenRouterAuthError,
  OpenRouterValidationError,
  OpenRouterRateLimitError,
  OpenRouterServerError,
  OpenRouterTimeoutError,
  OpenRouterInvalidResponseError,
} from "../errors/openrouter.error";

/**
 * OpenRouter Service for LLM API communication
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface ModelParameters {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface OpenRouterServiceOptions {
  apiKey?: string;
  model?: string;
  apiUrl?: string;
  timeout?: number;
  httpReferer?: string;
  appTitle?: string;
  defaultParams?: ModelParameters;
}

// ============================================================================
// Request Types
// ============================================================================

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonSchema<T = unknown> {
  name: string;
  description?: string;
  schema: {
    type: "object" | "array";
    properties?: Record<string, unknown>;
    items?: unknown;
    required?: string[];
    additionalProperties?: boolean;
    [key: string]: unknown;
  };
  strict?: boolean;
}

export interface ChatRequest<T = unknown> {
  systemMessage: string;
  userMessage: string;
  responseSchema?: JsonSchema<T>;
  model?: string;
  params?: Partial<ModelParameters>;
  conversationHistory?: Message[];
}

export interface GenerateOptions {
  model?: string;
  params?: Partial<ModelParameters>;
}

// ============================================================================
// Response Types
// ============================================================================

export interface ResponseMetadata {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  duration: number;
  finishReason: string;
}

export interface ChatResponse<T = unknown> {
  content: T;
  raw: OpenRouterApiResponse;
  metadata: ResponseMetadata;
}

// ============================================================================
// OpenRouter API Types
// ============================================================================

interface OpenRouterRequestPayload {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      description?: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
}

interface OpenRouterApiResponse {
  id: string;
  model: string;
  created: number;
  object: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string;
    };
    finish_reason: "stop" | "length" | "content_filter" | "tool_calls";
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
    code: string;
  };
}

// ... dalsze sekcje w następnych krokach
```

### Krok 3: Implementacja Konstruktora

```typescript
export class OpenRouterService {
  private readonly apiKey: string;
  private readonly apiUrl: string;
  private currentModel: string;
  private readonly timeout: number;
  private readonly httpReferer: string;
  private readonly appTitle: string;
  private readonly defaultParams: ModelParameters;
  private readonly logger: Logger;

  constructor(options?: OpenRouterServiceOptions) {
    this.logger = new Logger("OpenRouterService");
    
    // Załaduj konfigurację
    this.apiKey = options?.apiKey || import.meta.env.OPENROUTER_API_KEY || "";
    this.currentModel = options?.model || import.meta.env.OPENROUTER_MODEL || "openai/gpt-4-turbo";
    this.apiUrl = options?.apiUrl || "https://openrouter.ai/api/v1/chat/completions";
    this.timeout = options?.timeout || 30000;
    this.httpReferer = options?.httpReferer || import.meta.env.SITE || "http://localhost:4321";
    this.appTitle = options?.appTitle || "10x-cards";
    
    // Załaduj domyślne parametry
    this.defaultParams = {
      temperature: 0.7,
      max_tokens: 2000,
      top_p: 1.0,
      frequency_penalty: 0.0,
      presence_penalty: 0.0,
      ...options?.defaultParams,
    };
    
    // Walidacja klucza API
    if (!this.apiKey) {
      throw new OpenRouterConfigError(
        "OpenRouter API key is required. Set OPENROUTER_API_KEY environment variable."
      );
    }
    
    if (this.apiKey.length < 20) {
      this.logger.warning("API key seems unusually short");
    }
    
    // Walidacja URL w produkcji
    if (!this.apiUrl.startsWith("https://") && import.meta.env.PROD) {
      this.logger.warning("API URL should use HTTPS in production");
    }
    
    // Loguj konfigurację (bez klucza API!)
    this.logger.info("OpenRouter service initialized", {
      model: this.currentModel,
      timeout: this.timeout,
      apiUrl: this.apiUrl,
      hasApiKey: true,
      defaultParams: this.defaultParams,
    });
  }
  
  // Getter i setter dla modelu
  get model(): string {
    return this.currentModel;
  }
  
  set model(value: string) {
    this.logger.info("Changing model", { from: this.currentModel, to: value });
    this.currentModel = value;
  }
}
```

### Krok 4: Implementacja Metody `chat()`

```typescript
async chat<T = unknown>(request: ChatRequest<T>): Promise<ChatResponse<T>> {
  const startTime = Date.now();
  
  try {
    // Walidacja żądania
    this.validateChatRequest(request);
    
    // Loguj początek żądania
    this.logger.info("Starting chat request", {
      hasSchema: !!request.responseSchema,
      model: request.model || this.currentModel,
      hasHistory: !!request.conversationHistory,
    });
    
    // Zbuduj payload
    const payload = this.buildRequestPayload(request);
    
    // Wykonaj żądanie
    const apiResponse = await this.executeRequest(payload);
    
    // Parsuj odpowiedź
    const content = this.parseResponse<T>(apiResponse, !!request.responseSchema);
    
    // Wyciągnij metadane
    const metadata = this.extractMetadata(apiResponse, startTime);
    
    // Loguj sukces
    this.logger.info("Chat request completed", {
      duration: metadata.duration,
      totalTokens: metadata.totalTokens,
      finishReason: metadata.finishReason,
    });
    
    return {
      content,
      raw: apiResponse,
      metadata,
    };
  } catch (error) {
    // Loguj błąd
    if (error instanceof OpenRouterError) {
      this.logger.error("OpenRouter error in chat", error as Error, {
        code: error.code,
        statusCode: error.statusCode,
        duration: Date.now() - startTime,
      });
      throw error;
    }
    
    this.logger.error("Unexpected error in chat", error as Error, {
      duration: Date.now() - startTime,
    });
    
    throw new OpenRouterError(
      "Unexpected error during chat request",
      "OPENROUTER_UNKNOWN_ERROR",
      500
    );
  }
}
```

### Krok 5: Implementacja Walidacji

```typescript
private validateChatRequest<T>(request: ChatRequest<T>): void {
  // Walidacja systemMessage
  if (!request.systemMessage || request.systemMessage.trim().length === 0) {
    throw new OpenRouterValidationError("systemMessage cannot be empty");
  }
  
  if (request.systemMessage.length > 10000) {
    throw new OpenRouterValidationError(
      "systemMessage is too long (max 10000 characters)"
    );
  }
  
  // Walidacja userMessage
  if (!request.userMessage || request.userMessage.trim().length === 0) {
    throw new OpenRouterValidationError("userMessage cannot be empty");
  }
  
  if (request.userMessage.length > 50000) {
    throw new OpenRouterValidationError(
      "userMessage is too long (max 50000 characters)"
    );
  }
  
  // Walidacja parametrów
  if (request.params?.temperature !== undefined) {
    if (request.params.temperature < 0 || request.params.temperature > 2) {
      throw new OpenRouterValidationError(
        "temperature must be between 0 and 2"
      );
    }
  }
  
  if (request.params?.max_tokens !== undefined) {
    if (request.params.max_tokens < 1 || request.params.max_tokens > 100000) {
      throw new OpenRouterValidationError(
        "max_tokens must be between 1 and 100000"
      );
    }
  }
  
  if (request.params?.top_p !== undefined) {
    if (request.params.top_p < 0 || request.params.top_p > 1) {
      throw new OpenRouterValidationError("top_p must be between 0 and 1");
    }
  }
  
  if (request.params?.frequency_penalty !== undefined) {
    if (request.params.frequency_penalty < -2 || request.params.frequency_penalty > 2) {
      throw new OpenRouterValidationError(
        "frequency_penalty must be between -2 and 2"
      );
    }
  }
  
  if (request.params?.presence_penalty !== undefined) {
    if (request.params.presence_penalty < -2 || request.params.presence_penalty > 2) {
      throw new OpenRouterValidationError(
        "presence_penalty must be between -2 and 2"
      );
    }
  }
}
```

### Krok 6: Implementacja Budowania Payloadu

```typescript
private buildRequestPayload<T>(request: ChatRequest<T>): OpenRouterRequestPayload {
  // Zbuduj tablicę komunikatów
  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  
  // Dodaj komunikat systemowy
  messages.push({
    role: "system",
    content: request.systemMessage,
  });
  
  // Dodaj historię konwersacji (jeśli istnieje)
  if (request.conversationHistory && request.conversationHistory.length > 0) {
    messages.push(...request.conversationHistory);
  }
  
  // Dodaj komunikat użytkownika
  messages.push({
    role: "user",
    content: request.userMessage,
  });
  
  // Wybierz model
  const model = request.model || this.currentModel;
  
  // Scal parametry
  const params: ModelParameters = {
    ...this.defaultParams,
    ...request.params,
  };
  
  // Zbuduj bazowy payload
  const payload: OpenRouterRequestPayload = {
    model,
    messages,
    temperature: params.temperature,
    max_tokens: params.max_tokens,
    top_p: params.top_p,
    frequency_penalty: params.frequency_penalty,
    presence_penalty: params.presence_penalty,
  };
  
  // Dodaj response_format jeśli podano schemat
  if (request.responseSchema) {
    payload.response_format = {
      type: "json_schema",
      json_schema: {
        name: request.responseSchema.name,
        description: request.responseSchema.description,
        strict: request.responseSchema.strict ?? true,
        schema: request.responseSchema.schema as Record<string, unknown>,
      },
    };
  }
  
  return payload;
}
```

### Krok 7: Implementacja Wykonania Żądania

```typescript
private async executeRequest(
  payload: OpenRouterRequestPayload
): Promise<OpenRouterApiResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), this.timeout);
  
  try {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": this.httpReferer,
        "X-Title": this.appTitle,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    
    // Obsługa błędów HTTP
    if (!response.ok) {
      await this.handleHttpError(response);
    }
    
    const data = await response.json();
    
    // Sprawdź czy odpowiedź zawiera błąd
    if (data.error) {
      throw new OpenRouterServerError(
        data.error.message || "OpenRouter API returned an error",
        response.status
      );
    }
    
    return data as OpenRouterApiResponse;
  } catch (error) {
    // Obsługa timeout
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new OpenRouterTimeoutError(this.timeout);
    }
    
    // Przekaż dalej OpenRouter errors
    if (error instanceof OpenRouterError) {
      throw error;
    }
    
    // Network errors
    throw new OpenRouterError(
      `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      "OPENROUTER_NETWORK_ERROR",
      500
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

private async handleHttpError(response: Response): Promise<never> {
  const errorData = await response.json().catch(() => ({}));
  const errorMessage = errorData.error?.message || response.statusText;
  
  switch (response.status) {
    case 400:
      throw new OpenRouterValidationError(errorMessage, errorData.error);
      
    case 401:
      throw new OpenRouterAuthError(
        "Invalid API key. Please check your OPENROUTER_API_KEY.",
        401
      );
      
    case 403:
      throw new OpenRouterAuthError(
        "Access forbidden. Your API key may not have permission to use this model.",
        403
      );
      
    case 429: {
      const resetAt = response.headers.get("X-RateLimit-Reset");
      const resetDate = resetAt ? new Date(parseInt(resetAt) * 1000) : undefined;
      throw new OpenRouterRateLimitError(
        "Rate limit exceeded. Please try again later.",
        resetDate
      );
    }
      
    case 500:
    case 502:
    case 503:
    case 504:
      throw new OpenRouterServerError(errorMessage, response.status);
      
    default:
      throw new OpenRouterError(errorMessage, "OPENROUTER_HTTP_ERROR", response.status);
  }
}
```

### Krok 8: Implementacja Parsowania Odpowiedzi

```typescript
private parseResponse<T>(
  apiResponse: OpenRouterApiResponse,
  hasSchema: boolean
): T | string {
  // Sprawdź czy odpowiedź ma choices
  if (!apiResponse.choices || apiResponse.choices.length === 0) {
    throw new OpenRouterInvalidResponseError(
      "No choices in API response",
      apiResponse
    );
  }
  
  // Wyciągnij content
  const content = apiResponse.choices[0]?.message?.content;
  
  if (!content) {
    throw new OpenRouterInvalidResponseError(
      "Empty content in API response",
      apiResponse
    );
  }
  
  // Jeśli nie ma schematu, zwróć surowy string
  if (!hasSchema) {
    return content as T | string;
  }
  
  // Parsuj JSON
  try {
    const parsed = JSON.parse(content);
    return parsed as T;
  } catch (error) {
    throw new OpenRouterInvalidResponseError(
      "Failed to parse JSON response. Expected structured JSON but received invalid format.",
      content
    );
  }
}
```

### Krok 9: Implementacja Ekstrakcji Metadanych

```typescript
private extractMetadata(
  apiResponse: OpenRouterApiResponse,
  startTime: number
): ResponseMetadata {
  return {
    model: apiResponse.model,
    promptTokens: apiResponse.usage?.prompt_tokens ?? 0,
    completionTokens: apiResponse.usage?.completion_tokens ?? 0,
    totalTokens: apiResponse.usage?.total_tokens ?? 0,
    duration: Date.now() - startTime,
    finishReason: apiResponse.choices?.[0]?.finish_reason ?? "unknown",
  };
}
```

### Krok 10: Implementacja Metody `generateStructured()`

```typescript
async generateStructured<T>(
  systemMessage: string,
  userMessage: string,
  schema: JsonSchema<T>,
  options?: GenerateOptions
): Promise<T> {
  const response = await this.chat<T>({
    systemMessage,
    userMessage,
    responseSchema: schema,
    model: options?.model,
    params: options?.params,
  });
  
  return response.content;
}
```

### Krok 11: Implementacja Walidacji Klucza API

```typescript
async validateApiKey(): Promise<boolean> {
  try {
    this.logger.info("Validating API key");
    
    const response = await this.chat({
      systemMessage: "You are a helpful assistant.",
      userMessage: "Say 'OK' if you can read this.",
      params: {
        max_tokens: 10,
        temperature: 0,
      },
    });
    
    this.logger.info("API key validation successful");
    return true;
  } catch (error) {
    if (error instanceof OpenRouterAuthError) {
      this.logger.warning("API key validation failed - auth error");
      return false;
    }
    
    // Inne błędy też mogą oznaczać problem z kluczem
    this.logger.error("API key validation failed", error as Error);
    throw error;
  }
}
```

### Krok 12: Export Singletona (Opcjonalnie)

Na końcu pliku dodaj:

```typescript
/**
 * Singleton instance of OpenRouter Service
 * Use this for all OpenRouter operations
 */
export const openRouterService = new OpenRouterService();
```

### Krok 13: Aktualizacja `AIService`

Zmodyfikuj `src/lib/services/ai.service.ts` aby używał `OpenRouterService`:

```typescript
import { openRouterService } from "./openrouter.service";
import type { JsonSchema } from "./openrouter.service";

export class AIService {
  async generateFlashcards(sourceText: string): Promise<FlashcardData[]> {
    logger.info("Generating flashcards via AI", {
      textLength: sourceText.length,
    });

    try {
      // Zdefiniuj schemat odpowiedzi
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
                    description: "Question or front side of the flashcard"
                  },
                  back: { 
                    type: "string",
                    description: "Answer or back side of the flashcard"
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

      // Wywołaj OpenRouter
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
      if (error instanceof OpenRouterError) {
        throw new AIServiceError(
          "Failed to generate flashcards",
          error.message,
          error.statusCode
        );
      }

      logger.error("Unexpected error in generateFlashcards", error as Error);
      throw new AIServiceError(
        "Unable to generate flashcards",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private buildSystemMessage(): string {
    return `You are an expert educational assistant specializing in creating high-quality flashcards for spaced repetition learning.

Your task is to:
- Extract key concepts from the provided text
- Create clear, focused questions for the front of each card
- Provide concise, accurate answers for the back
- Generate between 5 and 15 flashcards depending on content richness
- Ensure flashcards are suitable for spaced repetition learning`;
  }

  private buildUserMessage(sourceText: string): string {
    return `Generate educational flashcards from the following text. Each flashcard should focus on a single concept and be suitable for spaced repetition learning.

Text to analyze:
---
${sourceText}
---

Create flashcards that help learners master the key concepts from this text.`;
  }
}
```

### Krok 14: Dodanie Zmiennych Środowiskowych

Utwórz lub zaktualizuj plik `.env` w katalogu głównym projektu:

```env
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your-api-key-here
OPENROUTER_MODEL=openai/gpt-4-turbo

# Site URL for OpenRouter referer tracking
SITE=https://yourdomain.com
```

Dodaj do `.env.example`:

```env
# OpenRouter Configuration
OPENROUTER_API_KEY=
OPENROUTER_MODEL=openai/gpt-4-turbo
SITE=http://localhost:4321
```

### Krok 15: Aktualizacja TypeScript Env Types

W `src/env.d.ts` dodaj:

```typescript
interface ImportMetaEnv {
  readonly OPENROUTER_API_KEY: string;
  readonly OPENROUTER_MODEL: string;
  readonly SITE: string;
  // ... inne zmienne
}
```

### Krok 16: Testowanie

Utwórz prosty plik testowy `src/lib/services/__tests__/openrouter.test.ts`:

```typescript
import { openRouterService } from "../openrouter.service";

// Test 1: Prosty czat
async function testSimpleChat() {
  console.log("Test 1: Simple chat");
  
  const response = await openRouterService.chat({
    systemMessage: "You are a helpful assistant.",
    userMessage: "Say hello!",
  });
  
  console.log("Response:", response.content);
  console.log("Tokens:", response.metadata.totalTokens);
}

// Test 2: Strukturyzowana odpowiedź
async function testStructuredResponse() {
  console.log("\nTest 2: Structured response");
  
  interface TestResponse {
    items: string[];
  }
  
  const response = await openRouterService.chat<TestResponse>({
    systemMessage: "You are a helpful assistant.",
    userMessage: "List 3 colors",
    responseSchema: {
      name: "colors_list",
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["items"]
      }
    }
  });
  
  console.log("Colors:", response.content.items);
}

// Uruchom testy
(async () => {
  try {
    await testSimpleChat();
    await testStructuredResponse();
    console.log("\n✅ All tests passed");
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
})();
```

### Krok 17: Dokumentacja

Zaktualizuj `README.md` aby zawierał informacje o konfiguracji OpenRouter:

```markdown
## Configuration

### OpenRouter API

This application uses OpenRouter for AI-powered flashcard generation.

1. Get an API key from [OpenRouter](https://openrouter.ai/)
2. Set environment variables:

```bash
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENROUTER_MODEL=openai/gpt-4-turbo  # Optional, defaults to gpt-4-turbo
```

3. Supported models:
   - `openai/gpt-4-turbo` (recommended)
   - `anthropic/claude-3-opus`
   - `google/gemini-pro`
   - See [OpenRouter Models](https://openrouter.ai/models) for full list

### Rate Limits

- Default: 60 requests per minute
- Adjust based on your OpenRouter plan
```

## Podsumowanie

Ten plan implementacji obejmuje:

✅ **Pełną specyfikację typów TypeScript** dla wszystkich żądań i odpowiedzi
✅ **Szczegółową obsługę błędów** z dedykowanymi klasami dla różnych scenariuszy
✅ **Bezpieczne zarządzanie kluczami API** bez logowania wrażliwych danych
✅ **JSON Schema validation** dla strukturyzowanych odpowiedzi
✅ **Elastyczną konfigurację** modeli i parametrów
✅ **Kompletne przykłady użycia** dla wszystkich funkcji
✅ **Krok po kroku implementację** zgodną z architekturą projektu
✅ **Integrację z istniejącym AIService**
✅ **Dokumentację i testy**

Implementacja powinna zająć około 2-4 godzin doświadczonemu deweloperowi TypeScript.

