# API Endpoint Implementation Plan: POST /api/auth/register

## 1. Przegląd punktu końcowego

**Endpoint:** `POST /api/auth/register`

**Cel:** Rejestracja nowego konta użytkownika w systemie 10x-cards. Endpoint pozwala użytkownikom na utworzenie konta poprzez podanie adresu email i hasła. Po pomyślnej rejestracji użytkownik otrzymuje tokeny JWT, które umożliwiają natychmiastowe zalogowanie bez konieczności osobnego wywołania endpointu login.

**Funkcjonalność:**
- Walidacja formatu email i siły hasła
- Utworzenie konta użytkownika przez Supabase Auth
- Automatyczne utworzenie rekordu w tabeli `auth.users` (zarządzane przez Supabase)
- Generowanie JWT tokens (access_token i refresh_token)
- Zwrócenie danych użytkownika i sesji
- Implementacja rate limiting dla ochrony przed atakami
- Opcjonalna weryfikacja email (konfigurowana w Supabase)

**User Stories:** Podstawowa funkcjonalność wymagana dla wszystkich user stories wymagających autentykacji

**Bezpieczeństwo:** Endpoint publiczny, ale z rate limiting i strong password requirements

---

## 2. Szczegóły żądania

### HTTP Method
`POST`

### URL Structure
```
/api/auth/register
```

### Headers (Required)
```http
Content-Type: application/json
```

**Uwaga:** Brak wymagania Authorization header (endpoint publiczny)

### Request Body
```typescript
{
  "email": string,      // Valid email address
  "password": string    // Minimum 8 characters, must contain uppercase, lowercase, and number
}
```

**Typ:** `RegisterCommand`

**Przykład:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

### Parametry

#### Z Request Body
| Parametr | Typ | Wymagany | Walidacja | Opis |
|----------|-----|----------|-----------|------|
| `email` | string | Tak | Valid email format, max 255 chars | Adres email użytkownika |
| `password` | string | Tak | Min 8 chars, uppercase, lowercase, number | Hasło użytkownika |

#### Automatycznie generowane przez Supabase
| Parametr | Typ | Źródło | Opis |
|----------|-----|--------|------|
| `id` | UUID | Supabase Auth | Unikalny identyfikator użytkownika |
| `created_at` | TIMESTAMPTZ | Supabase Auth | Data utworzenia konta |

---

## 3. Wykorzystywane typy

### DTOs (z src/types.ts)

```typescript
// Request
RegisterCommand {
  email: string;
  password: string;
}

// Response - Success
AuthResponse {
  user: UserDTO;
  session: SessionDTO;
}

UserDTO {
  id: string;
  email: string;
  created_at: string;
}

SessionDTO {
  access_token: string;
  refresh_token: string;
  expires_at: string;
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

### Zod Schemas (do utworzenia w src/lib/validation/)

```typescript
// src/lib/validation/auth.ts
import { z } from 'zod';

/**
 * Password validation schema
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Email validation schema
 */
const emailSchema = z
  .string({ required_error: "Email is required" })
  .email("Invalid email format")
  .max(255, "Email must not exceed 255 characters")
  .toLowerCase()
  .trim();

/**
 * Register command validation schema
 */
export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
```

### Supabase Auth Types

```typescript
// Supabase Auth User (from @supabase/supabase-js)
import type { User, Session } from '@supabase/supabase-js';

// User reprezentuje użytkownika z auth.users
// Session reprezentuje sesję z tokenami JWT
```

---

## 4. Szczegóły odpowiedzi

### Success Response (201 Created)

**Headers:**
```http
Content-Type: application/json
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 1696942800
Set-Cookie: sb-refresh-token=...; HttpOnly; Secure; SameSite=Lax; Path=/
```

**Body:**
```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "created_at": "2025-10-12T10:00:00Z"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1.MXkFjRLdTgPBpGkFjRLdTgPB...",
    "expires_at": "2025-10-12T11:00:00Z"
  }
}
```

**Uwagi:**
- `access_token` ważny przez 1 godzinę (konfigurowane w Supabase)
- `refresh_token` może być użyty do odświeżenia access_token
- `refresh_token` powinien być przechowywany w httpOnly cookie dla bezpieczeństwa

### Error Responses

#### 400 Bad Request - VALIDATION_ERROR
**Scenariusze:**
- Brak pola `email` lub `password`
- Invalid email format
- Password nie spełnia wymagań siły
- Invalid JSON w body

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must be at least 8 characters long",
    "details": {
      "field": "password",
      "errors": [
        {
          "path": ["password"],
          "message": "Password must be at least 8 characters long"
        }
      ]
    }
  }
}
```

**Inne przykłady walidacji:**
```json
// Invalid email
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email"
    }
  }
}

// Weak password (brak uppercase)
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must contain at least one uppercase letter",
    "details": {
      "field": "password"
    }
  }
}
```

#### 409 Conflict - EMAIL_ALREADY_REGISTERED
**Scenariusze:**
- Email już istnieje w systemie

**Response:**
```json
{
  "error": {
    "code": "EMAIL_ALREADY_REGISTERED",
    "message": "An account with this email already exists",
    "details": {}
  }
}
```

**Security Note:** Niektóre aplikacje nie ujawniają czy email istnieje (aby zapobiec email enumeration), ale dla lepszego UX informujemy użytkownika. Alternatywnie można zawsze zwracać sukces i wysyłać email z linkiem do logowania jeśli konto już istnieje.

#### 429 Too Many Requests - RATE_LIMIT_EXCEEDED
**Scenariusze:**
- Przekroczony limit rejestracji (np. 5 prób na godzinę z tego samego IP)

**Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many registration attempts. Please try again later.",
    "details": {
      "limit": 5,
      "reset_at": "2025-10-12T11:00:00Z"
    }
  }
}
```

#### 500 Internal Server Error - INTERNAL_ERROR
**Scenariusze:**
- Błąd Supabase Auth service
- Database connection error
- Nieoczekiwany exception

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred during registration. Please try again later.",
    "details": {}
  }
}
```

**Security Note:** Nie ujawniamy szczegółów błędów wewnętrznych użytkownikowi, tylko logujemy je.

---

## 5. Przepływ danych

### Diagram przepływu

```
Client Request
      ↓
[1] Astro Middleware
      ├─→ Parse request body
      ├─→ Rate Limiting Check (IP-based)
      └─→ CORS headers
      ↓
[2] API Route Handler (POST)
      ├─→ Walidacja Zod schema
      └─→ Sanitization (email lowercase, trim)
      ↓
[3] AuthService.register()
      ├─→ Supabase Auth signUp()
      ├─→ Create user in auth.users (automatic)
      └─→ Generate JWT tokens (automatic)
      ↓
[4] Format Response
      ├─→ Map Supabase User → UserDTO
      ├─→ Map Supabase Session → SessionDTO
      ├─→ Set httpOnly cookie (refresh_token)
      └─→ Return AuthResponse
      ↓
Client Response (201)
```

### Szczegółowy przepływ krok po kroku

#### Krok 1: Middleware (src/middleware/index.ts)
- **CORS:** Walidacja origin, dodanie headers dla public endpoint
- **Rate Limiting:**
  - IP-based rate limiting dla endpoint register
  - 5 prób na godzinę per IP address
  - Zapobiega bot registration i brute force attacks
- **No Authentication Required:** Ten endpoint jest publiczny

```typescript
// Pseudo-kod middleware dla /api/auth/register
if (pathname === '/api/auth/register' && method === 'POST') {
  const clientIp = getClientIp(request);
  await rateLimitService.check(clientIp, 'auth:register');
}
```

#### Krok 2: Route Handler (src/pages/api/auth/register.ts)
```typescript
export const prerender = false;

export async function POST(context: APIContext) {
  // 1. Parse request body
  const requestBody = await context.request.json();
  
  // 2. Validate with Zod
  const validationResult = RegisterSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return errorResponse(400, 'VALIDATION_ERROR', ...);
  }
  
  // 3. Call AuthService
  const authResponse = await authService.register(
    validationResult.data.email,
    validationResult.data.password
  );
  
  // 4. Set httpOnly cookie for refresh token
  context.cookies.set('sb-refresh-token', authResponse.session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });
  
  // 5. Return response
  return new Response(JSON.stringify(authResponse), { status: 201 });
}
```

#### Krok 3: AuthService (src/lib/services/auth.service.ts)
```typescript
class AuthService {
  async register(email: string, password: string): Promise<AuthResponse> {
    // 1. Call Supabase Auth signUp
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${SITE_URL}/auth/callback`,
        data: {
          // Dodatkowe metadata użytkownika jeśli potrzebne
        }
      }
    });
    
    // 2. Handle errors
    if (error) {
      if (error.message.includes('already registered')) {
        throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Email already registered');
      }
      throw new AuthServiceError('Registration failed', error.message);
    }
    
    if (!data.user || !data.session) {
      throw new AuthServiceError('Registration failed', 'No user or session returned');
    }
    
    // 3. Map to DTOs
    return {
      user: this.mapUserToDTO(data.user),
      session: this.mapSessionToDTO(data.session)
    };
  }
  
  private mapUserToDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email!,
      created_at: user.created_at
    };
  }
  
  private mapSessionToDTO(session: Session): SessionDTO {
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: new Date(session.expires_at! * 1000).toISOString()
    };
  }
}
```

### Interakcje z zewnętrznymi serwisami

#### Supabase Auth
- **Service:** Supabase Auth (wbudowany w Supabase)
- **Operation:** `signUp({ email, password })`
- **Automatyczne akcje:**
  - Hashowanie hasła (bcrypt)
  - Utworzenie rekordu w `auth.users`
  - Generowanie JWT tokens
  - Opcjonalnie: wysłanie email weryfikacyjnego
- **Konfiguracja:** Supabase Dashboard → Authentication → Settings
  - Enable email confirmation (opcjonalne)
  - Password strength requirements
  - JWT expiry times

#### Database (PostgreSQL via Supabase)
- **Tabela:** `auth.users` (zarządzana przez Supabase, read-only dla aplikacji)
- **Automatic triggers:** Supabase może mieć triggery do tworzenia profili użytkowników
- **RLS:** Dostęp do `auth.users` tylko przez Supabase Auth API

---

## 6. Względy bezpieczeństwa

### 6.1. Password Security

#### Strong Password Requirements
```typescript
// Wymagania:
- Minimum 8 znaków
- Przynajmniej jedna wielka litera (A-Z)
- Przynajmniej jedna mała litera (a-z)
- Przynajmniej jedna cyfra (0-9)
- Maximum 128 znaków (zapobiega DoS przez bardzo długie hasła)

// Opcjonalnie dla przyszłości:
- Przynajmniej jeden znak specjalny (!@#$%^&*)
- Sprawdzanie czy hasło nie jest na liście popularnych haseł
- Sprawdzanie czy hasło nie zawiera email użytkownika
```

#### Password Hashing
- **Mechanizm:** Automatyczne przez Supabase Auth
- **Algorithm:** bcrypt (industry standard)
- **Salt:** Unique per user, automatically generated
- **Rounds:** Configurable in Supabase (default: 10)

**Uwaga:** Aplikacja nigdy nie przechowuje ani nie widzi plain-text hasła

### 6.2. Email Security

#### Email Validation
```typescript
- Valid email format (RFC 5322 compliant)
- Lowercase normalization (user@example.com === USER@EXAMPLE.COM)
- Trim whitespace
- Maximum length: 255 characters
- Sprawdzenie czy domena nie jest na blacklist (opcjonalne)
```

#### Email Enumeration Protection
**Problem:** Atakujący może sprawdzić czy email istnieje w systemie

**Strategie:**
1. **Obecne rozwiązanie:** Zwracamy 409 Conflict jeśli email istnieje
   - **Pros:** Lepszy UX, użytkownik wie że konto istnieje
   - **Cons:** Umożliwia email enumeration

2. **Alternatywne rozwiązanie (strict security):**
   - Zawsze zwracać 201 Created
   - Wysyłać email: "Konto już istnieje, kliknij aby się zalogować"
   - **Pros:** Zapobiega email enumeration
   - **Cons:** Gorszy UX, dodatkowa złożoność

**Decyzja:** Dla MVP używamy pierwszego podejścia (409 Conflict)

### 6.3. Rate Limiting

#### IP-based Rate Limiting
```typescript
Endpoint: POST /api/auth/register
Limit: 5 requests per hour per IP address
Window: Sliding window of 1 hour
Storage: In-memory (MVP) → Redis (production)
```

**Implementacja:**
```typescript
const key = `rate_limit:auth:register:${clientIp}`;
const count = await rateLimit.get(key) || 0;
if (count >= 5) {
  throw new RateLimitError(resetAt);
}
await rateLimit.increment(key, { ttl: 3600 });
```

**Uwaga:** IP może być shared (NAT, corporate network), więc limit nie może być zbyt restrykcyjny

#### Additional Protection (Future)
- **CAPTCHA:** Google reCAPTCHA v3 dla podejrzanych requestów
- **Email Verification Required:** Wymuszenie potwierdzenia email przed aktywacją konta
- **Honeypot Fields:** Ukryte pola formularza dla botów

### 6.4. JWT Token Security

#### Access Token
- **Lifetime:** 1 godzina (configurable)
- **Storage:** Frontend memory (not localStorage!)
- **Transmission:** HTTPS only
- **Usage:** Authorization header dla protected endpoints

#### Refresh Token
- **Lifetime:** 7-30 dni (configurable)
- **Storage:** httpOnly cookie (XSS protection)
- **Flags:** Secure, SameSite=Lax
- **Rotation:** New refresh token przy każdym refresh (optional)

**Cookie Configuration:**
```typescript
context.cookies.set('sb-refresh-token', refreshToken, {
  httpOnly: true,      // JavaScript nie może odczytać
  secure: true,        // Tylko HTTPS (except localhost)
  sameSite: 'lax',     // CSRF protection
  path: '/',
  maxAge: 60 * 60 * 24 * 7  // 7 days
});
```

### 6.5. HTTPS/TLS
- **Requirement:** Wszystkie requesty przez HTTPS w produkcji
- **Local Development:** HTTP allowed dla localhost
- **HSTS Header:** Strict-Transport-Security dla wymuszenia HTTPS
- **Certificate:** Valid SSL certificate (Let's Encrypt, Cloudflare)

### 6.6. CORS (Cross-Origin Resource Sharing)
```typescript
// Development
Allow-Origin: http://localhost:* 
Allow-Methods: POST
Allow-Headers: Content-Type
Allow-Credentials: true

// Production
Allow-Origin: https://your-domain.com
Allow-Methods: POST
Allow-Headers: Content-Type
Allow-Credentials: true
```

### 6.7. Input Sanitization
```typescript
// Email
- Convert to lowercase
- Trim whitespace
- Validate format
- Check for SQL injection patterns (paranoid mode)

// Password
- No sanitization (preserve user input)
- Length validation
- Character validation
- Będzie zahashowane przez Supabase
```

### 6.8. Error Information Disclosure
**Zasada:** Never reveal sensitive information in errors

**Bezpieczne:**
- "Invalid email format"
- "Password must contain uppercase letter"
- "An account with this email already exists"

**Niebezpieczne (NEVER):**
- Internal error details
- Database errors
- Stack traces
- Supabase error details
- Server paths

### 6.9. Email Verification (Optional)

#### Włączenie w Supabase
1. Dashboard → Authentication → Settings
2. Enable "Confirm email"
3. Configure email templates

#### Przepływ z weryfikacją:
```
1. User registers → receives confirmation email
2. User clicks link → redirected to /auth/callback
3. Callback verifies token → activates account
4. User can now login
```

**Uwaga:** Jeśli włączone, `data.session` będzie null do czasu potwierdzenia email

---

## 7. Obsługa błędów

### 7.1. Kategoryzacja błędów

#### Client Errors (4xx)

**400 Bad Request - VALIDATION_ERROR**
- **Przyczyny:**
  - Brak email lub password w body
  - Invalid email format
  - Email za długi (> 255 chars)
  - Password za krótki (< 8 chars)
  - Password za długi (> 128 chars)
  - Password brak uppercase
  - Password brak lowercase
  - Password brak cyfry
  - Invalid JSON w body
- **Akcja:** Zwróć szczegółowe informacje walidacji
- **Logging:** Info level (normalny przypadek)
- **User-facing:** Tak, szczegółowy komunikat

**409 Conflict - EMAIL_ALREADY_REGISTERED**
- **Przyczyny:**
  - Email już istnieje w auth.users
  - Supabase Auth zwrócił "User already registered"
- **Akcja:** Zwróć przyjazny komunikat
- **Logging:** Info level
- **User-facing:** Tak, informuj że konto istnieje

**429 Too Many Requests - RATE_LIMIT_EXCEEDED**
- **Przyczyny:**
  - IP address przekroczył limit 5 rejestracji/godzinę
- **Akcja:** Zwróć czas do reset
- **Logging:** Warning level (możliwy abuse)
- **User-facing:** Tak, z czasem reset

#### Server Errors (5xx)

**500 Internal Server Error - INTERNAL_ERROR**
- **Przyczyny:**
  - Supabase Auth service error
  - Database unavailable
  - Network error do Supabase
  - Nieoczekiwany exception
- **Akcja:** Zwróć ogólny komunikat, loguj szczegóły
- **Logging:** Critical level z full details
- **User-facing:** Tak, ale ogólny komunikat

**503 Service Unavailable - SERVICE_UNAVAILABLE**
- **Przyczyny:**
  - Supabase Auth is down
  - Maintenance mode
- **Akcja:** Zwróć komunikat o tymczasowej niedostępności
- **Logging:** Critical level
- **User-facing:** Tak, informuj o tymczasowym problemie

### 7.2. Error Handling Strategy

#### W Route Handler
```typescript
export async function POST(context: APIContext) {
  try {
    // 1. Parse JSON
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body');
    }
    
    // 2. Validate with Zod
    const validationResult = RegisterSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, 'VALIDATION_ERROR', firstError.message, {
        field: firstError.path.join('.'),
        errors: validationResult.error.errors
      });
    }
    
    // 3. Register via AuthService
    let authResponse;
    try {
      authResponse = await authService.register(
        validationResult.data.email,
        validationResult.data.password
      );
    } catch (error) {
      if (error instanceof ConflictError) {
        return errorResponse(409, error.code, error.message);
      }
      if (error instanceof AuthServiceError) {
        logger.error('Auth service error', error);
        return errorResponse(500, 'INTERNAL_ERROR', 'Registration failed. Please try again.');
      }
      throw error; // Re-throw unexpected errors
    }
    
    // 4. Set refresh token cookie
    context.cookies.set('sb-refresh-token', authResponse.session.refresh_token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });
    
    // 5. Return success
    return new Response(JSON.stringify(authResponse), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    // Catch-all for unexpected errors
    logger.critical('Unexpected error in register endpoint', error as Error);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
}
```

### 7.3. Custom Error Classes

```typescript
// src/lib/errors/auth-service.error.ts
export class AuthServiceError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

// src/lib/errors/conflict.error.ts
export class ConflictError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}

// Rate limit error już istnieje z poprzedniego endpointu
```

### 7.4. Supabase Error Mapping

Supabase Auth może zwracać różne błędy. Musimy je mapować na nasze error codes:

```typescript
function mapSupabaseError(error: AuthError): Error {
  const message = error.message.toLowerCase();
  
  // Email already registered
  if (message.includes('already registered') || 
      message.includes('already exists') ||
      message.includes('duplicate')) {
    return new ConflictError(
      'EMAIL_ALREADY_REGISTERED',
      'An account with this email already exists'
    );
  }
  
  // Invalid email format (jeśli Supabase to zwróci)
  if (message.includes('invalid email')) {
    return new ConflictError(
      'VALIDATION_ERROR',
      'Invalid email format'
    );
  }
  
  // Weak password (jeśli Supabase ma własne wymagania)
  if (message.includes('password') && message.includes('weak')) {
    return new ConflictError(
      'VALIDATION_ERROR',
      'Password does not meet security requirements'
    );
  }
  
  // Generic error
  return new AuthServiceError(
    'Registration failed',
    error
  );
}
```

### 7.5. Logging Strategy

```typescript
// Użyj Logger service z poprzedniego endpointu
const logger = new Logger('POST /api/auth/register');

// Info - successful registration
logger.info('User registered successfully', {
  userId: user.id,
  email: user.email // OK to log email in backend logs
});

// Warning - rate limit hit
logger.warning('Rate limit exceeded for registration', {
  ip: clientIp,
  attempts: count
});

// Error - Supabase error
logger.error('Supabase Auth error', error, {
  email: sanitizedEmail, // Log email but not password!
  errorCode: error.code
});

// Critical - unexpected error
logger.critical('Unexpected registration error', error, {
  email: sanitizedEmail
});
```

**WAŻNE:** Nigdy nie logować plain-text passwords!

---

## 8. Rozważania dotyczące wydajności

### 8.1. Potencjalne wąskie gardła

#### 1. Supabase Auth API Latency
- **Problem:** External API call, zależny od network i Supabase performance
- **Typical latency:** 100-500ms
- **Wpływ:** Użytkownik czeka na response
- **Mitigation:**
  - Supabase ma global CDN, wybierze najbliższy region
  - Timeout na requestach (10s)
  - Proper error handling i retry dla transient errors

#### 2. Password Hashing (bcrypt)
- **Problem:** bcrypt jest CPU-intensive (by design, dla security)
- **Processing time:** 50-200ms w zależności od rounds
- **Wpływ:** Dodatkowy czas response
- **Mitigation:**
  - Odbywa się po stronie Supabase (nie blokuje naszego serwera)
  - Optymalny trade-off między security a performance (10 rounds)

#### 3. Rate Limiting Check
- **Problem:** Dodatkowe operacje przed każdym requestem
- **Wpływ:** Minimalny (~1-5ms dla in-memory, ~10-20ms dla Redis)
- **Mitigation:**
  - Użyć in-memory cache dla MVP
  - Redis w produkcji (bardzo szybki)

#### 4. Database Connection
- **Problem:** Ograniczona liczba połączeń do PostgreSQL
- **Wpływ:** Potencjalny bottleneck przy wysokim traffic
- **Mitigation:**
  - Supabase zarządza connection pooling
  - Auth operations są optymalizowane
  - Monitor i scale Supabase plan w razie potrzeby

### 8.2. Strategie optymalizacji

#### Optymalizacja 1: Response Caching (NOT APPLICABLE)
**Uwaga:** Registration endpoints NIE mogą być cache'owane - każdy request tworzy nowe dane

#### Optymalizacja 2: Async Email Sending
```typescript
// Jeśli używamy custom email verification
// Wysyłaj email asynchronicznie (job queue)
await authService.register(email, password);
// Don't wait for email
emailQueue.add({ type: 'welcome', userId, email });
return response; // Fast!
```

**Korzyści:**
- Szybsza response dla użytkownika
- Email failures nie blokują rejestracji

#### Optymalizacja 3: Rate Limit in Redis
```typescript
// Zamiast in-memory (który resetuje się przy restart)
import Redis from 'ioredis';

const redis = new Redis(REDIS_URL);

async function checkRateLimit(ip: string): Promise<boolean> {
  const key = `rate_limit:auth:register:${ip}`;
  const count = await redis.incr(key);
  
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour
  }
  
  return count <= 5;
}
```

**Korzyści:**
- Persistent across server restarts
- Shared state w multi-instance deployment
- Very fast (~1-2ms)

#### Optymalizacja 4: Pre-validation na Frontend
```typescript
// Frontend validation przed wysłaniem
// Reduces invalid requests to API
const errors = validateRegisterForm(email, password);
if (errors.length > 0) {
  showErrors(errors);
  return; // Don't send request
}
```

**Korzyści:**
- Lepszy UX (instant feedback)
- Redukcja niepotrzebnych API calls
- Mniejsze obciążenie serwera

#### Optymalizacja 5: Connection Pooling
```typescript
// Supabase client z connection pooling
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(url, key, {
  auth: {
    persistSession: false // Server-side nie potrzebuje persist
  },
  global: {
    headers: {
      'x-application-name': '10x-cards'
    }
  }
});
```

### 8.3. Monitoring & Metrics

**Kluczowe metryki do monitorowania:**

1. **Registration Success Rate**
   - Target: > 95%
   - Alert: < 90%

2. **Response Time**
   - P50: < 300ms
   - P95: < 1000ms
   - P99: < 2000ms
   - Alert: P95 > 2000ms

3. **Supabase Auth Performance**
   - Success rate
   - Latency
   - Error rate by type

4. **Rate Limiting**
   - Requests per IP
   - 429 response rate
   - Pattern detection (potential abuse)

5. **Error Rates**
   - 4xx rate (should be low if frontend validation works)
   - 5xx rate (should be very low)
   - Error distribution by type

**Implementacja:**
```typescript
// src/lib/services/metrics.service.ts
export class MetricsService {
  recordRegistration(success: boolean, duration: number, userId?: string) {
    // Send to monitoring service
    console.log('[METRIC] Registration', { success, duration, userId });
  }
  
  recordAuthServiceCall(operation: string, success: boolean, duration: number) {
    console.log('[METRIC] Auth Service', { operation, success, duration });
  }
  
  recordRateLimitHit(ip: string) {
    console.log('[METRIC] Rate Limit Hit', { ip, endpoint: 'register' });
  }
}
```

---

## 9. Etapy wdrożenia

### Faza 1: Przygotowanie infrastruktury

#### 1.1. Konfiguracja Supabase Auth
```bash
# W Supabase Dashboard:
1. Authentication → Settings
2. Enable Email Provider
3. Configure Site URL: https://your-domain.com
4. Configure Redirect URLs:
   - http://localhost:4321/auth/callback (dev)
   - https://your-domain.com/auth/callback (prod)
5. JWT Settings:
   - JWT Expiry: 3600 (1 hour)
   - Enable Refresh Token Rotation: true
6. Email Auth:
   - Enable email confirmation: false (dla MVP, true w przyszłości)
   - Secure email change enabled: true
7. Password Requirements (jeśli dostępne w Supabase):
   - Minimum length: 8
```

#### 1.2. Zmienne środowiskowe
```env
# .env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
SITE_URL=http://localhost:4321
NODE_ENV=development

# Production additional
# REDIS_URL=redis://...
```

#### 1.3. Struktura folderów (jeśli nie istnieje)
```bash
mkdir -p src/pages/api/auth
mkdir -p src/lib/services
mkdir -p src/lib/validation
mkdir -p src/lib/errors
mkdir -p src/lib/helpers
```

### Faza 2: Implementacja warstwy walidacji

#### 2.1. Auth Zod schemas
**Plik:** `src/lib/validation/auth.ts`

```typescript
import { z } from 'zod';

/**
 * Password validation schema
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Email validation schema
 */
const emailSchema = z
  .string({ required_error: "Email is required" })
  .email("Invalid email format")
  .max(255, "Email must not exceed 255 characters")
  .toLowerCase()
  .trim();

/**
 * Register command validation schema
 */
export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Login command validation schema
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: "Password is required" })
});

export type LoginInput = z.infer<typeof LoginSchema>;
```

**Test:**
```typescript
// tests/lib/validation/auth.test.ts
describe('RegisterSchema', () => {
  it('should accept valid email and password', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: 'SecurePass123'
    });
    expect(result.success).toBe(true);
  });
  
  it('should reject invalid email', () => {
    const result = RegisterSchema.safeParse({
      email: 'invalid-email',
      password: 'SecurePass123'
    });
    expect(result.success).toBe(false);
  });
  
  it('should reject weak password', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: 'weak'
    });
    expect(result.success).toBe(false);
  });
  
  it('should reject password without uppercase', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: 'securepass123'
    });
    expect(result.success).toBe(false);
  });
  
  it('should normalize email to lowercase', () => {
    const result = RegisterSchema.safeParse({
      email: 'USER@EXAMPLE.COM',
      password: 'SecurePass123'
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('user@example.com');
  });
  
  it('should trim email whitespace', () => {
    const result = RegisterSchema.safeParse({
      email: '  user@example.com  ',
      password: 'SecurePass123'
    });
    expect(result.success).toBe(true);
    expect(result.data?.email).toBe('user@example.com');
  });
});
```

### Faza 3: Implementacja Custom Error Classes

#### 3.1. AuthServiceError
**Plik:** `src/lib/errors/auth-service.error.ts`

```typescript
export class AuthServiceError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}
```

#### 3.2. ConflictError
**Plik:** `src/lib/errors/conflict.error.ts`

```typescript
export class ConflictError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'ConflictError';
  }
}
```

### Faza 4: Implementacja Auth Service

#### 4.1. AuthService class
**Plik:** `src/lib/services/auth.service.ts`

```typescript
import type { SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';
import type { Database } from '../../db/database.types';
import type { UserDTO, SessionDTO, AuthResponse } from '../../types';
import { AuthServiceError } from '../errors/auth-service.error';
import { ConflictError } from '../errors/conflict.error';
import { Logger } from './logger.service';

const logger = new Logger('AuthService');

export class AuthService {
  constructor(private supabase: SupabaseClient<Database>) {}
  
  /**
   * Register a new user
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      logger.info('Attempting to register user', { email });
      
      // Call Supabase Auth signUp
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          // Email redirect URL for confirmation (if enabled)
          emailRedirectTo: `${import.meta.env.SITE_URL || 'http://localhost:4321'}/auth/callback`,
          
          // Additional user metadata (optional)
          data: {
            // Możesz dodać dodatkowe pola user metadata tutaj
          }
        }
      });
      
      // Handle errors
      if (error) {
        logger.warning('Supabase Auth registration error', { error: error.message, email });
        throw this.mapSupabaseError(error);
      }
      
      // Check if user and session exist
      if (!data.user) {
        logger.error('No user returned from Supabase signUp', new Error('No user'), { email });
        throw new AuthServiceError('Registration failed: No user created');
      }
      
      // Note: session może być null jeśli email confirmation jest włączone
      if (!data.session) {
        logger.info('No session returned (email confirmation may be required)', { 
          userId: data.user.id,
          email 
        });
        
        // Jeśli email confirmation jest włączone, zwróć user bez session
        return {
          user: this.mapUserToDTO(data.user),
          session: {
            access_token: '',
            refresh_token: '',
            expires_at: ''
          }
        };
      }
      
      logger.info('User registered successfully', {
        userId: data.user.id,
        email: data.user.email
      });
      
      // Map to DTOs
      return {
        user: this.mapUserToDTO(data.user),
        session: this.mapSessionToDTO(data.session)
      };
      
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof ConflictError || error instanceof AuthServiceError) {
        throw error;
      }
      
      // Log and wrap unexpected errors
      logger.error('Unexpected error in register', error as Error, { email });
      throw new AuthServiceError(
        'An unexpected error occurred during registration',
        error
      );
    }
  }
  
  /**
   * Map Supabase Auth errors to our error types
   */
  private mapSupabaseError(error: AuthError): Error {
    const message = error.message.toLowerCase();
    
    // Email already registered
    if (
      message.includes('already registered') ||
      message.includes('already exists') ||
      message.includes('duplicate') ||
      error.status === 409
    ) {
      return new ConflictError(
        'EMAIL_ALREADY_REGISTERED',
        'An account with this email already exists'
      );
    }
    
    // Invalid email (if Supabase validates)
    if (message.includes('invalid email')) {
      return new AuthServiceError('Invalid email format');
    }
    
    // Weak password (if Supabase has requirements)
    if (message.includes('password') && (message.includes('weak') || message.includes('strength'))) {
      return new AuthServiceError('Password does not meet security requirements');
    }
    
    // Generic auth error
    return new AuthServiceError(
      'Registration failed',
      error
    );
  }
  
  /**
   * Map Supabase User to UserDTO
   */
  private mapUserToDTO(user: User): UserDTO {
    return {
      id: user.id,
      email: user.email || '',
      created_at: user.created_at || new Date().toISOString()
    };
  }
  
  /**
   * Map Supabase Session to SessionDTO
   */
  private mapSessionToDTO(session: Session): SessionDTO {
    // expires_at is in seconds since epoch, convert to ISO string
    const expiresAt = session.expires_at 
      ? new Date(session.expires_at * 1000).toISOString()
      : new Date(Date.now() + 3600000).toISOString(); // Default: 1 hour from now
    
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: expiresAt
    };
  }
}

/**
 * Create AuthService instance with supabase client
 * Usage: const authService = createAuthService(supabase)
 */
export function createAuthService(supabase: SupabaseClient<Database>): AuthService {
  return new AuthService(supabase);
}
```

**Test:**
```typescript
// tests/lib/services/auth.service.test.ts
describe('AuthService', () => {
  it('should register user successfully', async () => {
    const mockSupabase = createMockSupabase({
      signUpResult: {
        data: {
          user: { id: 'test-id', email: 'test@example.com', created_at: '2025-01-01' },
          session: { access_token: 'token', refresh_token: 'refresh', expires_at: 3600 }
        },
        error: null
      }
    });
    
    const authService = new AuthService(mockSupabase);
    const result = await authService.register('test@example.com', 'SecurePass123');
    
    expect(result.user.email).toBe('test@example.com');
    expect(result.session.access_token).toBe('token');
  });
  
  it('should throw ConflictError when email exists', async () => {
    const mockSupabase = createMockSupabase({
      signUpResult: {
        data: { user: null, session: null },
        error: { message: 'User already registered', status: 409 }
      }
    });
    
    const authService = new AuthService(mockSupabase);
    
    await expect(
      authService.register('existing@example.com', 'SecurePass123')
    ).rejects.toThrow(ConflictError);
  });
});
```

### Faza 5: Aktualizacja Rate Limiting dla auth endpoints

#### 5.1. Rozszerzenie RateLimitService
**Plik:** `src/lib/services/rate-limit.service.ts`

Dodaj nową konfigurację dla auth endpoints:

```typescript
// Extend existing RateLimitService with auth-specific limits

export class RateLimitService {
  // ... existing code ...
  
  /**
   * Check rate limit for authentication endpoints
   * More restrictive than other endpoints
   */
  async checkAuthRateLimit(identifier: string, endpoint: 'register' | 'login'): Promise<void> {
    const limits = {
      register: { max: 5, windowMs: 3600000 },  // 5 per hour
      login: { max: 10, windowMs: 900000 }       // 10 per 15 minutes
    };
    
    const config = limits[endpoint];
    const key = `rate_limit:auth:${endpoint}:${identifier}`;
    const now = new Date();
    
    const entry = this.store.get(key);
    
    if (!entry || entry.resetAt < now) {
      this.store.set(key, {
        count: 1,
        resetAt: new Date(now.getTime() + config.windowMs)
      });
      return;
    }
    
    if (entry.count >= config.max) {
      throw new RateLimitError(entry.resetAt);
    }
    
    entry.count++;
    this.store.set(key, entry);
  }
  
  getRemainingAuth(identifier: string, endpoint: 'register' | 'login'): number {
    const limits = {
      register: 5,
      login: 10
    };
    
    const key = `rate_limit:auth:${endpoint}:${identifier}`;
    const entry = this.store.get(key);
    
    if (!entry || entry.resetAt < new Date()) {
      return limits[endpoint];
    }
    
    return Math.max(0, limits[endpoint] - entry.count);
  }
}
```

### Faza 6: Aktualizacja Middleware

#### 6.1. Dodaj rate limiting dla auth endpoints
**Plik:** `src/middleware/index.ts`

```typescript
import { defineMiddleware } from 'astro:middleware';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '../db/database.types';
import { errorResponse } from '../lib/helpers/error-response';
import { rateLimitService } from '../lib/services/rate-limit.service';
import { RateLimitError } from '../lib/errors/rate-limit.error';

// Helper to get client IP
function getClientIp(request: Request): string {
  // Check common headers (depends on your hosting)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback (not reliable in production)
  return 'unknown';
}

export const onRequest = defineMiddleware(async (context, next) => {
  // 1. Initialize Supabase client
  const supabase = createServerClient<Database>(
    import.meta.env.SUPABASE_URL,
    import.meta.env.SUPABASE_KEY,
    {
      cookies: {
        get: (key) => context.cookies.get(key)?.value,
        set: (key, value, options) => {
          context.cookies.set(key, value, options);
        },
        remove: (key, options) => {
          context.cookies.delete(key, options);
        }
      }
    }
  );
  
  context.locals.supabase = supabase;
  
  const pathname = context.url.pathname;
  const method = context.request.method;
  
  // 2. Handle auth endpoints (public, but with rate limiting)
  if (pathname === '/api/auth/register' && method === 'POST') {
    const clientIp = getClientIp(context.request);
    
    try {
      await rateLimitService.checkAuthRateLimit(clientIp, 'register');
      
      // Store rate limit info for response headers
      const remaining = rateLimitService.getRemainingAuth(clientIp, 'register');
      const resetAt = rateLimitService.getResetAt(`rate_limit:auth:register:${clientIp}`, 'auth');
      
      context.locals.rateLimitRemaining = remaining;
      context.locals.rateLimitReset = resetAt;
      
    } catch (error) {
      if (error instanceof RateLimitError) {
        return errorResponse(
          429,
          'RATE_LIMIT_EXCEEDED',
          'Too many registration attempts. Please try again later.',
          {
            limit: 5,
            reset_at: error.resetAt.toISOString()
          }
        );
      }
      throw error;
    }
  }
  
  // 3. Handle protected API routes (existing code for other endpoints)
  const isApiRoute = pathname.startsWith('/api/');
  const isAuthRoute = pathname.startsWith('/api/auth/');
  
  if (isApiRoute && !isAuthRoute) {
    // ... existing authentication middleware code ...
  }
  
  // 4. Continue to endpoint
  const response = await next();
  
  // 5. Add rate limit headers if available
  if (context.locals.rateLimitRemaining !== undefined) {
    const limit = pathname.includes('register') ? 5 : 10;
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', context.locals.rateLimitRemaining.toString());
    
    if (context.locals.rateLimitReset) {
      response.headers.set(
        'X-RateLimit-Reset',
        Math.floor(context.locals.rateLimitReset.getTime() / 1000).toString()
      );
    }
  }
  
  return response;
});
```

### Faza 7: Implementacja API Route Handler

#### 7.1. POST /api/auth/register handler
**Plik:** `src/pages/api/auth/register.ts`

```typescript
import type { APIContext } from 'astro';
import { RegisterSchema } from '../../../lib/validation/auth';
import { errorResponse } from '../../../lib/helpers/error-response';
import { createAuthService } from '../../../lib/services/auth.service';
import { ConflictError } from '../../../lib/errors/conflict.error';
import { AuthServiceError } from '../../../lib/errors/auth-service.error';
import { Logger } from '../../../lib/services/logger.service';

const logger = new Logger('POST /api/auth/register');

// Disable prerendering for API routes
export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Get Supabase client from middleware
    const supabase = context.locals.supabase;
    
    if (!supabase) {
      logger.error('Supabase client not available', new Error('No supabase client'));
      return errorResponse(500, 'INTERNAL_ERROR', 'Service configuration error');
    }
    
    // 2. Parse request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      logger.info('Invalid JSON in request body');
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body');
    }
    
    // 3. Validate input with Zod
    const validationResult = RegisterSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.info('Validation failed', {
        field: firstError.path.join('.'),
        message: firstError.message
      });
      
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        firstError.message,
        {
          field: firstError.path.join('.'),
          errors: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }
      );
    }
    
    const { email, password } = validationResult.data;
    
    logger.info('Processing registration request', { email });
    
    // 4. Register user via AuthService
    let authResponse;
    try {
      const authService = createAuthService(supabase);
      authResponse = await authService.register(email, password);
    } catch (error) {
      // Handle specific errors
      if (error instanceof ConflictError) {
        logger.info('Email already registered', { email });
        return errorResponse(409, error.code, error.message);
      }
      
      if (error instanceof AuthServiceError) {
        logger.error('Auth service error during registration', error as Error, { email });
        return errorResponse(
          500,
          'INTERNAL_ERROR',
          'Registration failed. Please try again later.'
        );
      }
      
      // Re-throw unexpected errors for catch-all
      throw error;
    }
    
    // 5. Set refresh token in httpOnly cookie
    if (authResponse.session.refresh_token) {
      context.cookies.set('sb-refresh-token', authResponse.session.refresh_token, {
        httpOnly: true,
        secure: import.meta.env.PROD, // HTTPS only in production
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 7 days
      });
      
      logger.info('Refresh token cookie set');
    }
    
    logger.info('User registered successfully', {
      userId: authResponse.user.id,
      email: authResponse.user.email
    });
    
    // 6. Return success response (201 Created)
    return new Response(
      JSON.stringify(authResponse),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    // Catch-all for unexpected errors
    logger.critical('Unexpected error in register endpoint', error as Error);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred during registration. Please try again later.'
    );
  }
}
```

### Faza 8: Testing & Quality Assurance

#### 8.1. Unit Tests

**Test 1: Validation Schema**
```typescript
// tests/lib/validation/auth.test.ts
import { RegisterSchema } from '../../../src/lib/validation/auth';

describe('RegisterSchema', () => {
  describe('valid inputs', () => {
    it('should accept valid email and password', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'SecurePass123'
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });
    
    it('should normalize email to lowercase', () => {
      const result = RegisterSchema.safeParse({
        email: 'USER@EXAMPLE.COM',
        password: 'SecurePass123'
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });
    
    it('should trim email whitespace', () => {
      const result = RegisterSchema.safeParse({
        email: '  user@example.com  ',
        password: 'SecurePass123'
      });
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('user@example.com');
      }
    });
  });
  
  describe('email validation', () => {
    it('should reject invalid email format', () => {
      const result = RegisterSchema.safeParse({
        email: 'invalid-email',
        password: 'SecurePass123'
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should reject email without domain', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@',
        password: 'SecurePass123'
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should reject empty email', () => {
      const result = RegisterSchema.safeParse({
        email: '',
        password: 'SecurePass123'
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should reject email longer than 255 chars', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      const result = RegisterSchema.safeParse({
        email: longEmail,
        password: 'SecurePass123'
      });
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('password validation', () => {
    it('should reject password shorter than 8 chars', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'Short1'
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should reject password without uppercase', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'securepass123'
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should reject password without lowercase', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'SECUREPASS123'
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should reject password without number', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'SecurePass'
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should reject password longer than 128 chars', () => {
      const longPassword = 'A' + 'a'.repeat(126) + '1';
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: longPassword
      });
      
      expect(result.success).toBe(false);
    });
    
    it('should accept password with all requirements', () => {
      const result = RegisterSchema.safeParse({
        email: 'user@example.com',
        password: 'MySecurePassword123'
      });
      
      expect(result.success).toBe(true);
    });
  });
});
```

**Test 2: AuthService**
```typescript
// tests/lib/services/auth.service.test.ts
import { AuthService } from '../../../src/lib/services/auth.service';
import { ConflictError } from '../../../src/lib/errors/conflict.error';
import { AuthServiceError } from '../../../src/lib/errors/auth-service.error';

// Mock Supabase client
function createMockSupabase(config: any) {
  return {
    auth: {
      signUp: jest.fn().mockResolvedValue(config.signUpResult)
    }
  } as any;
}

describe('AuthService', () => {
  describe('register', () => {
    it('should register user successfully', async () => {
      const mockSupabase = createMockSupabase({
        signUpResult: {
          data: {
            user: {
              id: '123e4567-e89b-12d3-a456-426614174000',
              email: 'test@example.com',
              created_at: '2025-10-12T10:00:00Z'
            },
            session: {
              access_token: 'mock_access_token',
              refresh_token: 'mock_refresh_token',
              expires_at: Math.floor(Date.now() / 1000) + 3600
            }
          },
          error: null
        }
      });
      
      const authService = new AuthService(mockSupabase);
      const result = await authService.register('test@example.com', 'SecurePass123');
      
      expect(result.user.id).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(result.user.email).toBe('test@example.com');
      expect(result.session.access_token).toBe('mock_access_token');
      expect(result.session.refresh_token).toBe('mock_refresh_token');
    });
    
    it('should throw ConflictError when email already exists', async () => {
      const mockSupabase = createMockSupabase({
        signUpResult: {
          data: { user: null, session: null },
          error: {
            message: 'User already registered',
            status: 409
          }
        }
      });
      
      const authService = new AuthService(mockSupabase);
      
      await expect(
        authService.register('existing@example.com', 'SecurePass123')
      ).rejects.toThrow(ConflictError);
    });
    
    it('should throw AuthServiceError on Supabase error', async () => {
      const mockSupabase = createMockSupabase({
        signUpResult: {
          data: { user: null, session: null },
          error: {
            message: 'Internal server error',
            status: 500
          }
        }
      });
      
      const authService = new AuthService(mockSupabase);
      
      await expect(
        authService.register('test@example.com', 'SecurePass123')
      ).rejects.toThrow(AuthServiceError);
    });
    
    it('should throw AuthServiceError when no user returned', async () => {
      const mockSupabase = createMockSupabase({
        signUpResult: {
          data: { user: null, session: null },
          error: null
        }
      });
      
      const authService = new AuthService(mockSupabase);
      
      await expect(
        authService.register('test@example.com', 'SecurePass123')
      ).rejects.toThrow(AuthServiceError);
    });
  });
});
```

#### 8.2. Integration Tests

```typescript
// tests/api/auth/register.test.ts
describe('POST /api/auth/register', () => {
  it('should return 400 for invalid email', async () => {
    const response = await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'SecurePass123'
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
  
  it('should return 400 for weak password', async () => {
    const response = await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user@example.com',
        password: 'weak'
      })
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
  
  it('should register new user successfully', async () => {
    const uniqueEmail = `user${Date.now()}@example.com`;
    const response = await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'SecurePass123'
      })
    });
    
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe(uniqueEmail);
    expect(data.session).toBeDefined();
    expect(data.session.access_token).toBeDefined();
    
    // Check refresh token cookie
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('sb-refresh-token');
  });
  
  it('should return 409 for existing email', async () => {
    const email = 'existing@example.com';
    
    // First registration
    await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'SecurePass123' })
    });
    
    // Second registration with same email
    const response = await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'SecurePass123' })
    });
    
    expect(response.status).toBe(409);
    const data = await response.json();
    expect(data.error.code).toBe('EMAIL_ALREADY_REGISTERED');
  });
  
  it('should enforce rate limiting', async () => {
    // Make 5 requests (limit)
    for (let i = 0; i < 5; i++) {
      await fetch('http://localhost:4321/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `user${i}@example.com`,
          password: 'SecurePass123'
        })
      });
    }
    
    // 6th request should be rate limited
    const response = await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user6@example.com',
        password: 'SecurePass123'
      })
    });
    
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
  
  it('should include rate limit headers', async () => {
    const response = await fetch('http://localhost:4321/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `user${Date.now()}@example.com`,
        password: 'SecurePass123'
      })
    });
    
    expect(response.headers.get('X-RateLimit-Limit')).toBe('5');
    expect(response.headers.get('X-RateLimit-Remaining')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
  });
});
```

#### 8.3. Manual Testing Checklist

- [ ] **Happy Path**
  - [ ] Register with valid email and password
  - [ ] Verify 201 response with user and session
  - [ ] Verify refresh token cookie is set
  - [ ] Verify user created in Supabase Dashboard
  - [ ] Verify can use access_token for protected endpoints

- [ ] **Validation Errors**
  - [ ] Invalid email format → 400
  - [ ] Password too short → 400
  - [ ] Password without uppercase → 400
  - [ ] Password without lowercase → 400
  - [ ] Password without number → 400
  - [ ] Missing email field → 400
  - [ ] Missing password field → 400
  - [ ] Invalid JSON → 400

- [ ] **Conflict Errors**
  - [ ] Register with existing email → 409
  - [ ] Error message is user-friendly

- [ ] **Rate Limiting**
  - [ ] 5 registrations work
  - [ ] 6th registration → 429
  - [ ] Rate limit headers present
  - [ ] Wait 1 hour, can register again

- [ ] **Security**
  - [ ] Refresh token is httpOnly
  - [ ] Refresh token is Secure (in prod)
  - [ ] Password not logged
  - [ ] Error messages don't leak sensitive info
  - [ ] HTTPS enforced in production

- [ ] **Edge Cases**
  - [ ] Very long email (255 chars) works
  - [ ] Email with + addressing works
  - [ ] Email case-insensitive (USER@example.com)
  - [ ] Concurrent registrations handled

### Faza 9: Dokumentacja

#### 9.1. API Documentation
**Plik:** `.ai/api-endpoints.md` (update)

```markdown
## POST /api/auth/register

Register a new user account.

### Request

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

### Response

**Success (201 Created):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2025-10-12T10:00:00Z"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": "2025-10-12T11:00:00Z"
  }
}
```

**Errors:**
- `400` - Validation error (invalid email, weak password)
- `409` - Email already registered
- `429` - Rate limit exceeded (5 per hour)
- `500` - Internal server error

### Rate Limiting
- 5 requests per hour per IP address
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

### Security
- Password requirements: min 8 chars, uppercase, lowercase, number
- Refresh token stored in httpOnly cookie
- Access token valid for 1 hour
```

#### 9.2. Frontend Integration Guide
**Plik:** `.ai/frontend-integration.md`

```markdown
# Frontend Integration Guide

## Registration Form

```typescript
// Example React component
import { useState } from 'react';

export function RegisterForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password }),
        credentials: 'include' // Important for cookies!
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error.message);
        return;
      }
      
      // Store access token in memory or state management
      localStorage.setItem('access_token', data.session.access_token);
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
      
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error">{error}</div>}
      
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
        minLength={8}
      />
      
      <button type="submit" disabled={loading}>
        {loading ? 'Registering...' : 'Register'}
      </button>
    </form>
  );
}
```

## Password Strength Indicator

```typescript
export function PasswordStrength({ password }: { password: string }) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password)
  };
  
  return (
    <div className="password-strength">
      <div className={checks.length ? 'check-pass' : 'check-fail'}>
        ✓ At least 8 characters
      </div>
      <div className={checks.uppercase ? 'check-pass' : 'check-fail'}>
        ✓ Contains uppercase letter
      </div>
      <div className={checks.lowercase ? 'check-pass' : 'check-fail'}>
        ✓ Contains lowercase letter
      </div>
      <div className={checks.number ? 'check-pass' : 'check-fail'}>
        ✓ Contains number
      </div>
    </div>
  );
}
```
```

### Faza 10: Deployment

#### 10.1. Environment Variables (Production)
```bash
# Production .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_production_anon_key
SITE_URL=https://your-production-domain.com
NODE_ENV=production

# Optional: Redis for rate limiting
REDIS_URL=redis://your-redis-instance
```

#### 10.2. Supabase Configuration (Production)
1. Dashboard → Authentication → Settings
2. Update Site URL: `https://your-production-domain.com`
3. Update Redirect URLs: `https://your-production-domain.com/auth/callback`
4. Enable email confirmation (recommended for production)
5. Configure email templates
6. Set up custom SMTP (optional, for branded emails)

#### 10.3. Deployment Checklist
- [ ] Environment variables configured
- [ ] Supabase auth settings updated
- [ ] HTTPS enforced
- [ ] Rate limiting tested
- [ ] Monitoring configured
- [ ] Error tracking (Sentry) configured
- [ ] Email delivery tested (if email confirmation enabled)

---

## 10. Checklist końcowy

### Pre-deployment
- [ ] Wszystkie testy jednostkowe przechodzą
- [ ] Wszystkie testy integracyjne przechodzą
- [ ] Manual testing completed
- [ ] Password validation działa poprawnie
- [ ] Rate limiting działa
- [ ] Refresh token cookie ustawiony prawidłowo
- [ ] Error handling przetestowany
- [ ] Code review wykonany
- [ ] Dokumentacja API zaktualizowana
- [ ] Frontend integration guide gotowy

### Deployment
- [ ] Deployed to staging
- [ ] Smoke tests na staging
- [ ] Security testing (OWASP Top 10)
- [ ] Load testing rate limiting
- [ ] Deployed to production
- [ ] Smoke tests na production
- [ ] Monitoring skonfigurowane
- [ ] Alerts skonfigurowane

### Post-deployment
- [ ] Monitor registration success rate
- [ ] Monitor error rates
- [ ] Monitor rate limiting effectiveness
- [ ] Check for abuse patterns
- [ ] Verify email delivery (if enabled)
- [ ] Collect user feedback
- [ ] Document any issues

---

## 11. Potencjalne rozszerzenia (Future)

1. **Email Verification:** Wymaganie potwierdzenia email przed aktywacją konta
2. **OAuth Providers:** Google, GitHub, Facebook sign-in
3. **Two-Factor Authentication:** TOTP dla dodatkowego bezpieczeństwa
4. **Password Strength Meter:** Real-time feedback podczas wpisywania
5. **CAPTCHA Integration:** Google reCAPTCHA v3 dla ochrony przed botami
6. **Account Recovery:** "Forgot password" flow
7. **Email Deliverability:** Custom SMTP, branded emails
8. **Username Support:** Opcjonalne username zamiast tylko email
9. **Profile Creation:** Automatyczne utworzenie profilu użytkownika w dodatkowej tabeli
10. **Analytics:** Track registration funnel, drop-off points
11. **A/B Testing:** Testowanie różnych form registration
12. **Social Proof:** "1000+ users registered" badge
13. **Referral System:** Invite friends functionality
14. **Terms Acceptance:** Checkbox dla terms of service
15. **Age Verification:** Date of birth field (jeśli wymagane prawnie)

---

## 12. Notatki dodatkowe

### Ważne decyzje projektowe

1. **Email Enumeration:** Ujawniamy czy email istnieje (409) dla lepszego UX
   - Alternative: Zawsze zwracać sukces i wysyłać email
   
2. **Email Confirmation:** Wyłączone dla MVP, włączyć w produkcji
   - Requires email setup i callback handling
   
3. **Rate Limiting:** IP-based, 5 per hour
   - May need adjustment based on real usage patterns
   
4. **Password Requirements:** Min 8 chars, uppercase, lowercase, number
   - No special characters required (for now)
   - No password history checking
   
5. **Session Management:** httpOnly cookie dla refresh token
   - Access token w memory (nie localStorage)
   - Supabase handles token refresh

### Znane ograniczenia

1. **IP-based Rate Limiting:** 
   - Może być problematyczne dla shared IPs (corporate, NAT)
   - Rozważyć user-based lub hybrid approach
   
2. **In-memory Rate Limit Store:**
   - Resetuje się przy server restart
   - Migrate do Redis w produkcji
   
3. **No Email Verification (MVP):**
   - Użytkownicy mogą używać fake emails
   - Enable w przyszłości
   
4. **No CAPTCHA:**
   - Vulnerable do automated bot registration
   - Add jeśli wystąpi problem

### Security Best Practices Checklist

- [x] Strong password requirements
- [x] Password hashing (Supabase bcrypt)
- [x] Rate limiting
- [x] httpOnly cookies dla refresh token
- [x] HTTPS enforcement (production)
- [x] Input validation i sanitization
- [x] Error message security (no info leakage)
- [ ] Email verification (future)
- [ ] CAPTCHA (future)
- [ ] Account lockout after failed attempts (future)

### Troubleshooting

**Problem:** "User already registered" ale użytkownik nie dostał email weryfikacyjnego
- **Rozwiązanie:** Check Supabase email logs, verify SMTP config

**Problem:** Rate limiting zbyt restrykcyjne
- **Rozwiązanie:** Adjust limit lub window w RateLimitService

**Problem:** Cookies nie są ustawiane
- **Rozwiązanie:** Check SameSite, Secure flags; verify domain matches

**Problem:** Supabase error "Invalid API key"
- **Rozwiązanie:** Verify SUPABASE_KEY environment variable

---

**Autor:** AI Architecture Team  
**Data:** 2025-10-12  
**Wersja:** 1.0  
**Status:** Ready for Implementation  
**Related Endpoints:** POST /api/auth/login, POST /api/auth/logout, DELETE /api/auth/account

