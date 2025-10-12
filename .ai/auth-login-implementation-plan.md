# API Endpoint Implementation Plan: POST /api/auth/login

## 1. Przegląd punktu końcowego

**Endpoint:** `POST /api/auth/login`

**Cel:** Uwierzytelnienie istniejącego użytkownika w systemie 10x-cards. Endpoint pozwala zalogowanym użytkownikom na uzyskanie dostępu do aplikacji poprzez podanie adresu email i hasła. Po pomyślnym uwierzytelnieniu użytkownik otrzymuje tokeny JWT umożliwiające dostęp do chronionych zasobów.

**Funkcjonalność:**
- Walidacja formatu email i obecności hasła
- Uwierzytelnienie użytkownika przez Supabase Auth
- Weryfikacja credentials (email + password)
- Generowanie JWT tokens (access_token i refresh_token)
- Zwrócenie danych użytkownika i sesji
- Implementacja rate limiting dla ochrony przed brute force
- Ustawienie httpOnly cookie dla refresh token

**User Stories:** Wymagane dla wszystkich user stories wymagających dostępu do chronionych zasobów

**Bezpieczeństwo:** Endpoint publiczny, ale z agresywnym rate limiting (10 prób/15 min) dla ochrony przed brute force attacks

---

## 2. Szczegóły żądania

### HTTP Method
`POST`

### URL Structure
```
/api/auth/login
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
  "password": string    // User's password (no validation requirements for login)
}
```

**Typ:** `LoginCommand`

**Przykład:**
```json
{
  "email": "user@example.com",
  "password": "UserPassword123"
}
```

### Parametry

#### Z Request Body
| Parametr | Typ | Wymagany | Walidacja | Opis |
|----------|-----|----------|-----------|------|
| `email` | string | Tak | Valid email format | Adres email użytkownika |
| `password` | string | Tak | Not empty | Hasło użytkownika (bez walidacji siły) |

**Uwaga:** Dla login NIE walidujemy siły hasła (tylko czy nie jest puste), ponieważ użytkownik może mieć stare hasło lub hasło z innych wymagań.

---

## 3. Wykorzystywane typy

### DTOs (z src/types.ts)

```typescript
// Request
LoginCommand {
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

### Zod Schemas (z src/lib/validation/auth.ts)

```typescript
// Użyjemy już istniejący LoginSchema z auth.ts
export const LoginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .email("Invalid email format")
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password cannot be empty")
});

export type LoginInput = z.infer<typeof LoginSchema>;
```

**Uwaga:** Login nie wymaga walidacji siły hasła - akceptujemy dowolne niepuste hasło

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

**Headers:**
```http
Content-Type: application/json
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1696943700
Set-Cookie: sb-refresh-token=...; HttpOnly; Secure; SameSite=Lax; Path=/
```

**Body:**
```json
{
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "created_at": "2025-10-10T10:00:00Z"
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "v1.MXkFjRLdTgPBpGkFjRLdTgPB...",
    "expires_at": "2025-10-12T11:00:00Z"
  }
}
```

### Error Responses

#### 400 Bad Request - VALIDATION_ERROR
**Scenariusze:**
- Brak pola `email` lub `password`
- Invalid email format
- Empty password
- Invalid JSON w body

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": {
      "field": "email"
    }
  }
}
```

#### 401 Unauthorized - INVALID_CREDENTIALS
**Scenariusze:**
- Email nie istnieje w systemie
- Hasło nieprawidłowe
- Konto nieaktywne (jeśli email verification włączone)

**Response:**
```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "details": {}
  }
}
```

**Security Note:** Generyczny komunikat "Invalid email or password" zapobiega email enumeration - nie ujawniamy czy email istnieje w systemie.

#### 429 Too Many Requests - RATE_LIMIT_EXCEEDED
**Scenariusze:**
- Przekroczony limit 10 prób logowania/15 min per IP+email combo

**Response:**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again later.",
    "details": {
      "limit": 10,
      "window_minutes": 15,
      "reset_at": "2025-10-12T10:15:00Z"
    }
  }
}
```

#### 500 Internal Server Error - INTERNAL_ERROR
**Scenariusze:**
- Błąd Supabase Auth service
- Database unavailable
- Nieoczekiwany exception

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
      ├─→ Rate Limiting Check (IP + email combination)
      ├─→ Aggressive rate limit: 10/15min
      └─→ CORS headers
      ↓
[2] API Route Handler (POST)
      ├─→ Parse request body
      └─→ Walidacja Zod schema
      ↓
[3] AuthService.login()
      ├─→ Supabase Auth signInWithPassword()
      ├─→ Verify credentials
      └─→ Generate JWT tokens (automatic)
      ↓
[4] Format Response
      ├─→ Map Supabase User → UserDTO
      ├─→ Map Supabase Session → SessionDTO
      ├─→ Set httpOnly cookie (refresh_token)
      └─→ Return AuthResponse
      ↓
Client Response (200)
```

### Szczegółowy przepływ krok po kroku

#### Krok 1: Middleware (src/middleware/index.ts)
- **Rate Limiting:**
  - Kombinacja IP + email dla precyzyjnego rate limiting
  - 10 prób na 15 minut (bardziej agresywne niż register)
  - Zapobiega brute force attacks na konkretne konta
- **CORS:** Standardowa konfiguracja dla public endpoint
- **No Authentication Required:** Ten endpoint jest publiczny

```typescript
// Rate limiting strategy dla login
const rateLimitKey = `${clientIp}:${email}`;
await rateLimitService.checkAuthRateLimit(rateLimitKey, 'login');
```

#### Krok 2: Route Handler (src/pages/api/auth/login.ts)
```typescript
export const prerender = false;

export async function POST(context: APIContext) {
  // 1. Parse body
  const requestBody = await context.request.json();
  
  // 2. Validate
  const validationResult = LoginSchema.safeParse(requestBody);
  if (!validationResult.success) {
    return errorResponse(400, 'VALIDATION_ERROR', ...);
  }
  
  // 3. Login via AuthService
  const authResponse = await authService.login(
    validationResult.data.email,
    validationResult.data.password
  );
  
  // 4. Set refresh token cookie
  context.cookies.set('sb-refresh-token', authResponse.session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7
  });
  
  // 5. Return 200 OK
  return new Response(JSON.stringify(authResponse), { status: 200 });
}
```

#### Krok 3: AuthService (src/lib/services/auth.service.ts)
```typescript
class AuthService {
  async login(email: string, password: string): Promise<AuthResponse> {
    // Call Supabase Auth signInWithPassword
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      // Map to generic error (security)
      throw new UnauthorizedError(
        'INVALID_CREDENTIALS',
        'Invalid email or password'
      );
    }
    
    if (!data.user || !data.session) {
      throw new AuthServiceError('Login failed: No user or session');
    }
    
    return {
      user: this.mapUserToDTO(data.user),
      session: this.mapSessionToDTO(data.session)
    };
  }
}
```

### Interakcje z zewnętrznymi serwisami

#### Supabase Auth
- **Service:** Supabase Auth
- **Operation:** `signInWithPassword({ email, password })`
- **Automatyczne akcje:**
  - Weryfikacja hasła (bcrypt compare)
  - Sprawdzenie czy użytkownik istnieje
  - Sprawdzenie czy konto aktywne
  - Generowanie JWT tokens
  - Utworzenie nowej sesji
- **Error Handling:** Wszystkie błędy mapowane na generyczny "Invalid credentials"

---

## 6. Względy bezpieczeństwa

### 6.1. Brute Force Protection

#### Aggressive Rate Limiting
```typescript
Endpoint: POST /api/auth/login
Strategy: IP + Email combination
Limit: 10 attempts per 15 minutes
Window: Sliding window
```

**Dlaczego IP + Email?**
- Zapobiega brute force na konkretne konto
- Nawet jeśli atakujący zmienia IP, limit per email się utrzymuje
- Chroni przed distributed brute force

**Implementacja:**
```typescript
const rateLimitKey = `${clientIp}:${normalizedEmail}`;
await rateLimitService.checkAuthRateLimit(rateLimitKey, 'login');
```

#### Account Lockout (Future Enhancement)
```typescript
// Po X nieudanych próbach, zablokuj konto na Y minut
if (failedAttempts >= 10) {
  await lockAccount(userId, 30); // 30 minutes lockout
  sendEmailNotification(email, 'suspicious_activity');
}
```

### 6.2. Credential Security

#### Password Verification
- **Mechanism:** bcrypt przez Supabase Auth
- **No Plain Text:** Hasło nigdy nie jest przechowywane ani logowane
- **Timing Attack Resistance:** bcrypt ma stały czas wykonania

#### Generic Error Messages
```typescript
// ✅ GOOD - Generic message
"Invalid email or password"

// ❌ BAD - Reveals information
"Email not found"
"Password incorrect"
"Account not activated"
```

**Dlaczego:**
- Zapobiega email enumeration
- Atakujący nie wie czy email istnieje
- Atakujący nie wie czy problem w email czy password

### 6.3. Session Security

#### JWT Tokens
- **Access Token:**
  - Lifetime: 1 godzina
  - Storage: Frontend memory (nie localStorage!)
  - Transmission: Authorization header
  - Contains: user_id, email, exp, iat

- **Refresh Token:**
  - Lifetime: 7 dni
  - Storage: httpOnly cookie (XSS protection)
  - Flags: Secure, SameSite=Lax
  - Used for: Refreshing access token

**Cookie Configuration:**
```typescript
context.cookies.set('sb-refresh-token', refreshToken, {
  httpOnly: true,      // JavaScript cannot read
  secure: true,        // HTTPS only
  sameSite: 'lax',     // CSRF protection
  path: '/',
  maxAge: 604800       // 7 days
});
```

### 6.4. Rate Limiting Strategy

**Per IP + Email (Current):**
- Pros: Prevents targeted attacks
- Cons: Może być ominięte przez botnet

**Future Enhancements:**
```typescript
// Multi-layer rate limiting
1. Per IP: 30 requests/15min (global)
2. Per IP+Email: 10 requests/15min (targeted)
3. Per Email (global): 20 requests/15min (across all IPs)
```

### 6.5. Logging & Monitoring

#### What to Log
```typescript
// ✅ Safe to log
- Email (for security monitoring)
- IP address
- Timestamp
- Success/failure
- User agent
- Rate limit hits

// ❌ NEVER log
- Password (plain text)
- Full JWT tokens
- Refresh tokens
- Personal user data beyond email
```

#### Security Events to Monitor
```typescript
- Multiple failed login attempts
- Login from new location/device
- Login at unusual time
- Rate limit exceeded
- Account lockout triggered
- Successful login after failed attempts
```

### 6.6. Additional Security Measures

#### 2FA Support (Future)
```typescript
// After successful password verification
if (user.has_2fa_enabled) {
  return {
    requires_2fa: true,
    temp_token: generateTempToken()
  };
  // Frontend shows 2FA code input
  // User submits code to /api/auth/verify-2fa
}
```

#### Device Fingerprinting (Future)
```typescript
// Track known devices
const deviceFingerprint = generateFingerprint(request);
if (!isKnownDevice(userId, deviceFingerprint)) {
  sendEmailNotification(email, 'new_device_login');
}
```

---

## 7. Obsługa błędów

### 7.1. Kategoryzacja błędów

#### Client Errors (4xx)

**400 Bad Request - VALIDATION_ERROR**
- **Przyczyny:**
  - Missing email or password
  - Invalid email format
  - Empty password field
  - Invalid JSON
- **User Message:** Specific validation error
- **Logging:** Info level
- **Action:** Return validation details

**401 Unauthorized - INVALID_CREDENTIALS**
- **Przyczyny:**
  - Email not found in system
  - Password incorrect
  - Account deactivated/suspended
  - Email not confirmed (if required)
- **User Message:** "Invalid email or password" (generic)
- **Logging:** Warning level with email (not password!)
- **Action:** Increment failed attempt counter

**429 Too Many Requests - RATE_LIMIT_EXCEEDED**
- **Przyczyny:**
  - Exceeded 10 login attempts in 15 minutes
  - Brute force detection triggered
- **User Message:** "Too many attempts. Try again later."
- **Logging:** Warning level (potential attack)
- **Action:** Return reset time, consider IP ban for extreme cases

#### Server Errors (5xx)

**500 Internal Server Error - INTERNAL_ERROR**
- **Przyczyny:**
  - Supabase Auth service error
  - Database unavailable
  - Network timeout
  - Unexpected exception
- **User Message:** Generic error message
- **Logging:** Critical level with full details
- **Action:** Alert monitoring system

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
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON');
    }
    
    // 2. Validate
    const validationResult = LoginSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, 'VALIDATION_ERROR', firstError.message, {
        field: firstError.path.join('.')
      });
    }
    
    // 3. Login
    let authResponse;
    try {
      const authService = createAuthService(supabase);
      authResponse = await authService.login(
        validationResult.data.email,
        validationResult.data.password
      );
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        logger.warning('Login failed', {
          email: validationResult.data.email,
          reason: error.code
        });
        return errorResponse(401, error.code, error.message);
      }
      
      if (error instanceof AuthServiceError) {
        logger.error('Auth service error', error, {
          email: validationResult.data.email
        });
        return errorResponse(500, 'INTERNAL_ERROR', 'Login failed');
      }
      
      throw error;
    }
    
    // 4. Set cookie
    context.cookies.set('sb-refresh-token', authResponse.session.refresh_token, {
      httpOnly: true,
      secure: import.meta.env.PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: 604800
    });
    
    logger.info('User logged in successfully', {
      userId: authResponse.user.id,
      email: authResponse.user.email
    });
    
    // 5. Return 200
    return new Response(JSON.stringify(authResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    logger.critical('Unexpected error in login', error as Error);
    return errorResponse(500, 'INTERNAL_ERROR', 'An unexpected error occurred');
  }
}
```

### 7.3. Custom Error Classes

```typescript
// src/lib/errors/unauthorized.error.ts
export class UnauthorizedError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

### 7.4. Supabase Error Mapping

```typescript
function mapSupabaseLoginError(error: AuthError): Error {
  const message = error.message.toLowerCase();
  
  // Invalid credentials (catch-all for security)
  if (
    message.includes('invalid login') ||
    message.includes('invalid credentials') ||
    message.includes('email not confirmed') ||
    message.includes('user not found')
  ) {
    return new UnauthorizedError(
      'INVALID_CREDENTIALS',
      'Invalid email or password'
    );
  }
  
  // Generic error
  return new AuthServiceError('Login failed', error);
}
```

**Security Note:** Wszystkie błędy auth mapujemy na generyczny "Invalid email or password"

---

## 8. Rozważania dotyczące wydajności

### 8.1. Potencjalne wąskie gardła

#### 1. Supabase Auth API Call
- **Latency:** 100-300ms
- **Impact:** Direct user experience
- **Mitigation:** Supabase global CDN, proper timeout handling

#### 2. bcrypt Password Verification
- **Time:** 50-200ms (security feature)
- **Impact:** Dodatkowa latencja
- **Mitigation:** Wykonywane przez Supabase (nie blokuje naszego serwera)

#### 3. Rate Limiting Lookup
- **Time:** 1-5ms (in-memory), 10-20ms (Redis)
- **Impact:** Minimalny
- **Mitigation:** Use Redis for production

#### 4. Session Creation
- **Time:** 50-100ms
- **Impact:** Part of total response time
- **Mitigation:** Handled by Supabase efficiently

### 8.2. Strategie optymalizacji

#### Optymalizacja 1: Redis dla Rate Limiting
```typescript
// Zamiast in-memory store
import Redis from 'ioredis';
const redis = new Redis(REDIS_URL);

async function checkLoginRateLimit(key: string): Promise<boolean> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 900); // 15 minutes
  }
  return count <= 10;
}
```

**Korzyści:**
- Persistent across restarts
- Shared w multi-instance deployment
- Very fast (~2ms)

#### Optymalizacja 2: Connection Pooling
```typescript
// Supabase client configuration
export const supabase = createClient(url, key, {
  auth: {
    persistSession: false, // Server-side
    autoRefreshToken: false
  },
  global: {
    headers: {
      'x-application-name': '10x-cards'
    }
  }
});
```

#### Optymalizacja 3: Response Compression
```typescript
// Middleware
if (response.headers.get('content-type')?.includes('application/json')) {
  const body = await response.text();
  if (body.length > 1024) {
    return new Response(gzip(body), {
      ...response,
      headers: {
        ...response.headers,
        'content-encoding': 'gzip'
      }
    });
  }
}
```

### 8.3. Monitoring & Metrics

**Kluczowe metryki:**

1. **Login Success Rate**
   - Target: > 95%
   - Alert: < 90%

2. **Response Time**
   - P50: < 200ms
   - P95: < 500ms
   - P99: < 1000ms

3. **Failed Login Rate**
   - Normal: < 5%
   - Alert: > 10% (potential attack)

4. **Rate Limit Hit Rate**
   - Normal: < 1%
   - Alert: > 5% (potential attack or bad UX)

5. **Brute Force Detection**
   - Track IPs with > 10 failed attempts
   - Track emails with > 20 failed attempts (across IPs)

---

## 9. Etapy wdrożenia

### Faza 1: Rozszerzenie AuthService

#### 1.1. Dodanie metody login
**Plik:** `src/lib/services/auth.service.ts` (extend existing)

```typescript
export class AuthService {
  // ... existing register method ...
  
  /**
   * Login existing user
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      logger.info('Login attempt', { email });
      
      // Call Supabase Auth signInWithPassword
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });
      
      // Handle errors - map all to generic message for security
      if (error) {
        logger.warning('Login failed', {
          email,
          error: error.message
        });
        throw this.mapSupabaseLoginError(error);
      }
      
      // Verify user and session exist
      if (!data.user || !data.session) {
        logger.error('No user or session after login', new Error('Missing data'), { email });
        throw new AuthServiceError('Login failed: No user or session returned');
      }
      
      logger.info('Login successful', {
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
      if (error instanceof UnauthorizedError || error instanceof AuthServiceError) {
        throw error;
      }
      
      // Wrap unexpected errors
      logger.error('Unexpected error in login', error as Error, { email });
      throw new AuthServiceError('An unexpected error occurred during login', error);
    }
  }
  
  /**
   * Map Supabase login errors to generic error
   * Security: Don't reveal whether email exists or password is wrong
   */
  private mapSupabaseLoginError(error: AuthError): Error {
    const message = error.message.toLowerCase();
    
    // All auth failures mapped to same generic error
    if (
      message.includes('invalid') ||
      message.includes('credentials') ||
      message.includes('not found') ||
      message.includes('wrong password') ||
      message.includes('email not confirmed')
    ) {
      return new UnauthorizedError(
        'INVALID_CREDENTIALS',
        'Invalid email or password'
      );
    }
    
    // Other errors
    return new AuthServiceError('Login failed', error);
  }
}
```

### Faza 2: Utworzenie UnauthorizedError

#### 2.1. UnauthorizedError class
**Plik:** `src/lib/errors/unauthorized.error.ts`

```typescript
export class UnauthorizedError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

### Faza 3: Rozszerzenie Rate Limiting

#### 3.1. Update RateLimitService
**Plik:** `src/lib/services/rate-limit.service.ts` (extend existing)

```typescript
export class RateLimitService {
  // ... existing code ...
  
  /**
   * Check login rate limit (IP + Email combination)
   * More aggressive than registration to prevent brute force
   */
  async checkLoginRateLimit(ip: string, email: string): Promise<void> {
    const key = `rate_limit:login:${ip}:${email}`;
    const limit = 10;
    const windowMs = 900000; // 15 minutes
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
  
  getRemainingLogin(ip: string, email: string): number {
    const key = `rate_limit:login:${ip}:${email}`;
    const entry = this.store.get(key);
    
    if (!entry || entry.resetAt < new Date()) {
      return 10;
    }
    
    return Math.max(0, 10 - entry.count);
  }
}
```

### Faza 4: Update Middleware

#### 4.1. Dodaj rate limiting dla login
**Plik:** `src/middleware/index.ts` (extend existing)

```typescript
export const onRequest = defineMiddleware(async (context, next) => {
  // ... existing Supabase init code ...
  
  const pathname = context.url.pathname;
  const method = context.request.method;
  
  // Handle login endpoint
  if (pathname === '/api/auth/login' && method === 'POST') {
    const clientIp = getClientIp(context.request);
    
    // Parse body to get email for rate limiting
    let email = '';
    try {
      const bodyText = await context.request.text();
      const body = JSON.parse(bodyText);
      email = body.email?.toLowerCase() || '';
      
      // Restore body for route handler
      context.request = new Request(context.request.url, {
        method: context.request.method,
        headers: context.request.headers,
        body: bodyText
      });
    } catch (e) {
      // Invalid JSON - let route handler deal with it
    }
    
    if (email) {
      try {
        await rateLimitService.checkLoginRateLimit(clientIp, email);
        
        const remaining = rateLimitService.getRemainingLogin(clientIp, email);
        const resetAt = rateLimitService.getResetAt(`rate_limit:login:${clientIp}:${email}`, 'login');
        
        context.locals.rateLimitRemaining = remaining;
        context.locals.rateLimitReset = resetAt;
        
      } catch (error) {
        if (error instanceof RateLimitError) {
          return errorResponse(
            429,
            'RATE_LIMIT_EXCEEDED',
            'Too many login attempts. Please try again later.',
            {
              limit: 10,
              window_minutes: 15,
              reset_at: error.resetAt.toISOString()
            }
          );
        }
        throw error;
      }
    }
  }
  
  // ... rest of middleware ...
});
```

**Uwaga:** Czytamy body w middleware, więc musimy go zrekonstruować dla route handlera.

### Faza 5: Implementacja API Route Handler

#### 5.1. POST /api/auth/login handler
**Plik:** `src/pages/api/auth/login.ts`

```typescript
import type { APIContext } from 'astro';
import { LoginSchema } from '../../../lib/validation/auth';
import { errorResponse } from '../../../lib/helpers/error-response';
import { createAuthService } from '../../../lib/services/auth.service';
import { UnauthorizedError } from '../../../lib/errors/unauthorized.error';
import { AuthServiceError } from '../../../lib/errors/auth-service.error';
import { Logger } from '../../../lib/services/logger.service';

const logger = new Logger('POST /api/auth/login');

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Get Supabase client
    const supabase = context.locals.supabase;
    
    if (!supabase) {
      logger.error('Supabase client not available', new Error('No supabase'));
      return errorResponse(500, 'INTERNAL_ERROR', 'Service configuration error');
    }
    
    // 2. Parse request body
    let requestBody;
    try {
      requestBody = await context.request.json();
    } catch (error) {
      logger.info('Invalid JSON in login request');
      return errorResponse(400, 'VALIDATION_ERROR', 'Invalid JSON in request body');
    }
    
    // 3. Validate with Zod
    const validationResult = LoginSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.info('Login validation failed', {
        field: firstError.path.join('.'),
        message: firstError.message
      });
      
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        firstError.message,
        {
          field: firstError.path.join('.')
        }
      );
    }
    
    const { email, password } = validationResult.data;
    
    logger.info('Processing login request', { email });
    
    // 4. Login via AuthService
    let authResponse;
    try {
      const authService = createAuthService(supabase);
      authResponse = await authService.login(email, password);
    } catch (error) {
      // Handle unauthorized (invalid credentials)
      if (error instanceof UnauthorizedError) {
        logger.warning('Invalid credentials', {
          email,
          code: error.code
        });
        return errorResponse(401, error.code, error.message);
      }
      
      // Handle other auth errors
      if (error instanceof AuthServiceError) {
        logger.error('Auth service error during login', error as Error, { email });
        return errorResponse(
          500,
          'INTERNAL_ERROR',
          'Login failed. Please try again later.'
        );
      }
      
      // Re-throw unexpected
      throw error;
    }
    
    // 5. Set refresh token cookie
    if (authResponse.session.refresh_token) {
      context.cookies.set('sb-refresh-token', authResponse.session.refresh_token, {
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
        path: '/',
        maxAge: 604800 // 7 days
      });
      
      logger.info('Refresh token cookie set');
    }
    
    logger.info('User logged in successfully', {
      userId: authResponse.user.id,
      email: authResponse.user.email
    });
    
    // 6. Return success (200 OK)
    return new Response(
      JSON.stringify(authResponse),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
  } catch (error) {
    // Catch-all
    logger.critical('Unexpected error in login endpoint', error as Error);
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.'
    );
  }
}
```

### Faza 6: Testing

#### 6.1. Unit Tests

```typescript
// tests/lib/services/auth.service.login.test.ts
describe('AuthService.login', () => {
  it('should login user successfully', async () => {
    const mockSupabase = createMockSupabase({
      signInResult: {
        data: {
          user: { id: 'test-id', email: 'test@example.com' },
          session: { access_token: 'token', refresh_token: 'refresh' }
        },
        error: null
      }
    });
    
    const authService = new AuthService(mockSupabase);
    const result = await authService.login('test@example.com', 'password');
    
    expect(result.user.email).toBe('test@example.com');
    expect(result.session.access_token).toBe('token');
  });
  
  it('should throw UnauthorizedError for invalid credentials', async () => {
    const mockSupabase = createMockSupabase({
      signInResult: {
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      }
    });
    
    const authService = new AuthService(mockSupabase);
    
    await expect(
      authService.login('wrong@example.com', 'wrongpass')
    ).rejects.toThrow(UnauthorizedError);
  });
  
  it('should throw UnauthorizedError for non-existent email', async () => {
    const mockSupabase = createMockSupabase({
      signInResult: {
        data: { user: null, session: null },
        error: { message: 'User not found' }
      }
    });
    
    const authService = new AuthService(mockSupabase);
    
    await expect(
      authService.login('notfound@example.com', 'password')
    ).rejects.toThrow(UnauthorizedError);
  });
});
```

#### 6.2. Integration Tests

```typescript
// tests/api/auth/login.test.ts
describe('POST /api/auth/login', () => {
  it('should return 400 for invalid email', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        password: 'password'
      })
    });
    
    expect(response.status).toBe(400);
  });
  
  it('should return 401 for invalid credentials', async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      })
    });
    
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
    expect(data.error.message).toBe('Invalid email or password');
  });
  
  it('should login successfully with valid credentials', async () => {
    // First register a user
    await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPass123'
      })
    });
    
    // Then login
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPass123'
      }),
      credentials: 'include'
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('test@example.com');
    expect(data.session.access_token).toBeDefined();
    
    // Check refresh token cookie
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('sb-refresh-token');
  });
  
  it('should enforce rate limiting', async () => {
    const email = 'ratelimit@example.com';
    
    // Make 10 failed attempts
    for (let i = 0; i < 10; i++) {
      await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'wrongpassword'
        })
      });
    }
    
    // 11th attempt should be rate limited
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'wrongpassword'
      })
    });
    
    expect(response.status).toBe(429);
    const data = await response.json();
    expect(data.error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

#### 6.3. Manual Testing Checklist

- [ ] **Happy Path**
  - [ ] Login with valid credentials → 200
  - [ ] Verify user and session in response
  - [ ] Verify refresh token cookie set
  - [ ] Can use access_token for protected endpoints

- [ ] **Invalid Credentials**
  - [ ] Wrong password → 401 with generic message
  - [ ] Non-existent email → 401 with generic message
  - [ ] Both return same message (security)

- [ ] **Validation Errors**
  - [ ] Invalid email format → 400
  - [ ] Empty email → 400
  - [ ] Empty password → 400
  - [ ] Missing fields → 400

- [ ] **Rate Limiting**
  - [ ] 10 failed attempts work
  - [ ] 11th attempt → 429
  - [ ] Rate limit per IP+Email combination
  - [ ] Different emails not affected
  - [ ] Different IPs tracked separately

- [ ] **Security**
  - [ ] Error messages don't reveal if email exists
  - [ ] Password never logged
  - [ ] Refresh token is httpOnly
  - [ ] Refresh token is Secure (prod)

---

## 10. Dokumentacja

### API Endpoint Documentation

```markdown
## POST /api/auth/login

Authenticate existing user.

### Request

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "UserPassword123"
}
```

### Response

**Success (200 OK):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2025-10-10T10:00:00Z"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": "2025-10-12T11:00:00Z"
  }
}
```

**Errors:**
- `400` - Validation error
- `401` - Invalid credentials
- `429` - Rate limit (10 per 15 min per IP+email)
- `500` - Internal error

### Security
- Generic error messages (no email enumeration)
- Aggressive rate limiting (10/15min per IP+email)
- httpOnly cookie for refresh token
```

---

## 11. Checklist końcowy

### Pre-deployment
- [ ] AuthService.login method implemented
- [ ] UnauthorizedError class created
- [ ] Rate limiting extended for login
- [ ] Middleware updated
- [ ] Route handler implemented
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Security review done
- [ ] Code review complete

### Security Verification
- [ ] Generic error messages
- [ ] No password logging
- [ ] Rate limiting working
- [ ] httpOnly cookies
- [ ] HTTPS enforced (prod)
- [ ] No information leakage

### Post-deployment
- [ ] Monitor login success rate
- [ ] Monitor failed login attempts
- [ ] Track rate limit hits
- [ ] Alert on brute force patterns
- [ ] User feedback

---

## 12. Notatki dodatkowe

### Kluczowe różnice vs Register

| Aspekt | Register | Login |
|--------|----------|-------|
| Password Validation | Strong requirements | No validation |
| Rate Limit | 5/hour per IP | 10/15min per IP+email |
| Error Messages | Specific | Generic (security) |
| Status Code | 201 Created | 200 OK |

### Security Best Practices
- ✅ Generic error messages
- ✅ Aggressive rate limiting
- ✅ IP + Email combination tracking
- ✅ No password logging
- ✅ httpOnly cookies
- ✅ Account lockout (future)

**Autor:** AI Architecture Team  
**Data:** 2025-10-12  
**Wersja:** 1.0  
**Status:** Ready for Implementation

