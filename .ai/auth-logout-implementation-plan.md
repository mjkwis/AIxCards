# API Endpoint Implementation Plan: POST /api/auth/logout

## 1. Przegląd punktu końcowego

**Endpoint:** `POST /api/auth/logout`

**Cel:** Wylogowanie aktualnie zalogowanego użytkownika z systemu 10x-cards. Endpoint invaliduje aktualną sesję użytkownika, usuwa tokeny JWT i czyści cookies. Jest to kluczowa operacja bezpieczeństwa, która kończy dostęp użytkownika do chronionych zasobów.

**Funkcjonalność:**
- Wymaganie validnego JWT tokenu (użytkownik musi być zalogowany)
- Invalidacja aktualnej sesji w Supabase Auth
- Usunięcie refresh token z httpOnly cookie
- Opcjonalne: Blacklist access token (jeśli implementowane)
- Zwrócenie pustej odpowiedzi 204 No Content

**User Stories:** Wymagane dla bezpiecznego zakończenia sesji użytkownika

**Bezpieczeństwo:** Endpoint chroniony (wymaga autentykacji), brak rate limiting (użytkownik może się wylogować ile razy chce)

---

## 2. Szczegóły żądania

### HTTP Method
`POST`

### URL Structure
```
/api/auth/logout
```

### Headers (Required)
```http
Authorization: Bearer {access_token}
```

**Uwaga:** Ten endpoint WYMAGA autentykacji

### Request Body
Brak - endpoint nie przyjmuje body

**Przykład:**
```http
POST /api/auth/logout
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Parametry

#### Z Authorization Header
| Parametr | Typ | Źródło | Opis |
|----------|-----|--------|------|
| `access_token` | JWT | Authorization header | Token zalogowanego użytkownika |
| `user_id` | UUID | Extracted from JWT | ID użytkownika (automatycznie) |

---

## 3. Wykorzystywane typy

### DTOs

```typescript
// Request: Brak body

// Response: Brak body (204 No Content)

// Error Response (jeśli błąd)
ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }
}
```

**Uwaga:** Success response nie ma body - tylko status 204 No Content

---

## 4. Szczegóły odpowiedzi

### Success Response (204 No Content)

**Headers:**
```http
Set-Cookie: sb-refresh-token=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax
```

**Body:**
```
(empty)
```

**Uwaga:** 
- Status 204 oznacza sukces bez zwracania contentu
- Cookie `sb-refresh-token` jest usuwany przez ustawienie Max-Age=0

### Error Responses

#### 401 Unauthorized - AUTH_REQUIRED
**Scenariusze:**
- Brak Authorization header
- Invalid JWT token
- Token wygasły
- Token already invalidated

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

**Uwaga:** Nawet jeśli token jest wygasły/invalid, można uznać to za "już wylogowany" i zwrócić 204, ale dla consistency zwracamy 401.

#### 500 Internal Server Error - INTERNAL_ERROR
**Scenariusze:**
- Błąd Supabase Auth service
- Błąd przy invalidacji sesji
- Nieoczekiwany exception

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Logout failed. Please try again.",
    "details": {}
  }
}
```

**Uwaga:** W razie błędu przy logout, i tak usuń cookie po stronie klienta

---

## 5. Przepływ danych

### Diagram przepływu

```
Client Request
      ↓
[1] Astro Middleware
      ├─→ Verify JWT Token
      ├─→ Extract user_id
      └─→ Inject supabase + user to context
      ↓
[2] API Route Handler (POST)
      ├─→ Verify user exists in context
      └─→ Call AuthService.logout()
      ↓
[3] AuthService.logout()
      ├─→ Supabase Auth signOut()
      └─→ Invalidate current session
      ↓
[4] Clear Cookie
      ├─→ Set sb-refresh-token Max-Age=0
      └─→ Effectively deletes cookie
      ↓
[5] Return Response
      └─→ 204 No Content (empty body)
      ↓
Client Response (204)
```

### Szczegółowy przepływ krok po kroku

#### Krok 1: Middleware (src/middleware/index.ts)
- **Authentication:** 
  - Ekstrakcja JWT z Authorization header
  - Walidacja tokenu przez Supabase Auth
  - Ustawienie `context.locals.user`
- **Authorization:** Sprawdzenie czy token jest valid
- **No Rate Limiting:** Logout nie wymaga rate limiting

```typescript
// Middleware już istnieje dla protected endpoints
// Logout używa standardowego auth flow
```

#### Krok 2: Route Handler (src/pages/api/auth/logout.ts)
```typescript
export const prerender = false;

export async function POST(context: APIContext) {
  // 1. Verify user is authenticated
  const user = context.locals.user;
  if (!user) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  // 2. Call AuthService.logout()
  await authService.logout();
  
  // 3. Clear refresh token cookie
  context.cookies.delete('sb-refresh-token', {
    path: '/'
  });
  
  // 4. Return 204 No Content
  return new Response(null, { status: 204 });
}
```

#### Krok 3: AuthService (src/lib/services/auth.service.ts)
```typescript
class AuthService {
  async logout(): Promise<void> {
    // Call Supabase Auth signOut
    const { error } = await this.supabase.auth.signOut();
    
    if (error) {
      // Log but może nie throwować - logout powinien zawsze succeed po stronie klienta
      logger.warning('Supabase signOut error', { error: error.message });
    }
  }
}
```

**Uwaga:** Nawet jeśli Supabase zwróci błąd, logout po stronie klienta (usunięcie cookie) powinien się udać.

### Interakcje z zewnętrznymi serwisami

#### Supabase Auth
- **Service:** Supabase Auth
- **Operation:** `signOut()`
- **Automatyczne akcje:**
  - Invalidacja aktualnej sesji
  - Oznaczenie refresh token jako used/invalid
  - Opcjonalnie: Usunięcie sesji z database
- **Error Handling:** Logujemy ale nie blokujemy logout

---

## 6. Względy bezpieczeństwa

### 6.1. Session Invalidation

#### Server-Side Invalidation
```typescript
// Supabase Auth signOut() invaliduje sesję po stronie serwera
await supabase.auth.signOut();

// Session jest usuwana z auth.sessions table
// Refresh token jest oznaczany jako invalid
// Próba użycia starego refresh token → error
```

#### Client-Side Cleanup
```typescript
// Usunięcie refresh token cookie
context.cookies.delete('sb-refresh-token');

// Frontend powinien dodatkowo:
// - Usunąć access token z memory/state
// - Wyczyścić user data z state
// - Redirect do login page
```

### 6.2. Token Blacklisting (Optional - Future)

**Problem:** Access token jest ważny przez 1h, nawet po logout

**Rozwiązania:**

**Option 1: Short-lived tokens (Current)**
- Access token ważny 1h
- Po logout token technicznie jeszcze działa
- Ale user nie ma go już w aplikacji
- Risk window: 1h

**Option 2: Token Blacklist (Future)**
```typescript
// Przy logout dodaj token do blacklist
await redis.setex(`blacklist:${accessToken}`, 3600, '1');

// Przy każdym request sprawdź blacklist
const isBlacklisted = await redis.exists(`blacklist:${accessToken}`);
if (isBlacklisted) {
  return 401;
}
```

**Option 3: Very short tokens + frequent refresh**
- Access token ważny 5 min
- Auto-refresh w tle
- Po logout, token wygasa szybko
- Risk window: 5 min

**Decyzja dla MVP:** Option 1 (short-lived tokens bez blacklist)

### 6.3. Refresh Token Security

#### Cookie Deletion
```typescript
// Prawidłowe usunięcie cookie
context.cookies.delete('sb-refresh-token', {
  path: '/'  // Must match path used when setting
});

// Alternative: Set Max-Age=0
context.cookies.set('sb-refresh-token', '', {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 0  // Immediate expiry
});
```

#### Supabase Session Management
- Refresh token jest single-use
- Po użyciu, nowy refresh token jest generowany
- Stare refresh tokeny są invalidowane
- Po signOut(), wszystkie refresh tokeny dla sesji są invalidowane

### 6.4. Concurrent Logouts

**Scenario:** User loguje się na wielu devices, wylogowuje na jednym

**Behavior:**
```typescript
// Option 1: Logout tylko current session (Default)
await supabase.auth.signOut(); // Only current session

// Option 2: Logout all sessions (Future)
await supabase.auth.signOut({ scope: 'global' }); // All devices
```

**Decyzja dla MVP:** Logout only current session

### 6.5. Error Handling Strategy

**Philosophy:** Logout should always succeed from client perspective

```typescript
try {
  await supabase.auth.signOut();
} catch (error) {
  // Log error but don't fail request
  logger.warning('Supabase signOut failed', { error });
  // Continue with client-side cleanup
}

// Always clear cookie
context.cookies.delete('sb-refresh-token');

// Always return 204
return new Response(null, { status: 204 });
```

**Rationale:**
- User intent is clear: they want to logout
- Server error shouldn't prevent client cleanup
- Worst case: session remains in DB but client can't use it

### 6.6. CSRF Protection

**Not Needed:** POST /api/auth/logout wymaga JWT token w header

```typescript
// JWT token in Authorization header serves as CSRF protection
// Attacker can't read token from another domain (CORS)
// Cookie alone (without JWT) won't work for logout
```

**Uwaga:** Jeśli byśmy używali tylko cookie-based auth, logout wymagałby CSRF token

---

## 7. Obsługa błędów

### 7.1. Kategoryzacja błędów

#### Client Errors (4xx)

**401 Unauthorized - AUTH_REQUIRED**
- **Przyczyny:**
  - Brak Authorization header
  - Invalid JWT token
  - Token expired
  - Token already invalidated
- **User Message:** "Authentication required"
- **Logging:** Info level
- **Action:** Client should redirect to login

#### Server Errors (5xx)

**500 Internal Server Error - INTERNAL_ERROR**
- **Przyczyny:**
  - Supabase Auth service error
  - Database error during session cleanup
  - Unexpected exception
- **User Message:** "Logout failed. Please try again."
- **Logging:** Warning level (nie critical - logout nie jest critical operation)
- **Action:** Log error, ale spróbuj kontynuować z client cleanup

### 7.2. Error Handling Strategy

#### Graceful Degradation
```typescript
export async function POST(context: APIContext) {
  try {
    const user = context.locals.user;
    
    if (!user) {
      return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
    }
    
    // Try to logout from Supabase
    try {
      const authService = createAuthService(context.locals.supabase);
      await authService.logout();
      logger.info('User logged out successfully', { userId: user.id });
    } catch (error) {
      // Log but don't fail - client cleanup is more important
      logger.warning('Supabase logout error', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
    
    // Always clear cookie (even if Supabase failed)
    context.cookies.delete('sb-refresh-token', { path: '/' });
    
    // Always return success
    return new Response(null, { status: 204 });
    
  } catch (error) {
    // Unexpected error
    logger.error('Unexpected error in logout', error as Error);
    
    // Still try to clear cookie
    try {
      context.cookies.delete('sb-refresh-token', { path: '/' });
    } catch (e) {
      // Cookie delete failed - log but continue
      logger.error('Failed to delete cookie', e as Error);
    }
    
    // Return 500 but client should still cleanup locally
    return errorResponse(500, 'INTERNAL_ERROR', 'Logout failed');
  }
}
```

**Philosophy:** Prefer client-side cleanup over server-side cleanup. Logout succeeds if cookie is deleted, even if Supabase call fails.

---

## 8. Rozważania dotyczące wydajności

### 8.1. Performance Characteristics

#### Response Time
- **Target:** < 100ms
- **Typical:** 50-150ms
- **Breakdown:**
  - Middleware auth check: 10-20ms
  - Supabase signOut call: 30-100ms
  - Cookie deletion: < 1ms
  - Response: < 1ms

#### Optimization Opportunities

**1. Async Supabase Cleanup (Optional)**
```typescript
// Don't wait for Supabase if it's slow
const logoutPromise = authService.logout();

// Delete cookie immediately
context.cookies.delete('sb-refresh-token');

// Return fast response
const response = new Response(null, { status: 204 });

// Cleanup in background (fire and forget)
logoutPromise.catch(error => {
  logger.warning('Async logout failed', { error });
});

return response;
```

**Pros:**
- Faster response to user
- Better UX

**Cons:**
- Session might not be cleaned up immediately
- Harder to track errors

**Decision:** For MVP, wait for Supabase call (more reliable)

### 8.2. Caching Considerations

**No Caching:** Logout responses should never be cached

```typescript
// Response headers
return new Response(null, {
  status: 204,
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Pragma': 'no-cache'
  }
});
```

### 8.3. Monitoring

**Key Metrics:**
- Logout success rate (should be ~100%)
- Logout response time (P95 < 200ms)
- Supabase signOut error rate
- Cookie deletion failures

---

## 9. Etapy wdrożenia

### Faza 1: Rozszerzenie AuthService

#### 1.1. Dodanie metody logout
**Plik:** `src/lib/services/auth.service.ts` (extend existing)

```typescript
export class AuthService {
  // ... existing methods ...
  
  /**
   * Logout current user
   * Invalidates Supabase session
   */
  async logout(): Promise<void> {
    try {
      logger.info('Logging out user');
      
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        logger.warning('Supabase signOut returned error', {
          error: error.message
        });
        // Don't throw - logout should succeed from client perspective
      }
      
      logger.info('Logout successful');
      
    } catch (error) {
      // Log but don't throw
      logger.warning('Unexpected error during logout', {
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
  }
}
```

**Uwaga:** Metoda nie rzuca błędów - logout zawsze "succeeds" z perspektywy service

### Faza 2: Implementacja API Route Handler

#### 2.1. POST /api/auth/logout handler
**Plik:** `src/pages/api/auth/logout.ts`

```typescript
import type { APIContext } from 'astro';
import { errorResponse } from '../../../lib/helpers/error-response';
import { createAuthService } from '../../../lib/services/auth.service';
import { Logger } from '../../../lib/services/logger.service';

const logger = new Logger('POST /api/auth/logout');

export const prerender = false;

export async function POST(context: APIContext): Promise<Response> {
  try {
    // 1. Verify user is authenticated (set by middleware)
    const user = context.locals.user;
    const supabase = context.locals.supabase;
    
    if (!user || !supabase) {
      logger.info('Logout attempt without authentication');
      return errorResponse(
        401,
        'AUTH_REQUIRED',
        'Valid authentication token is required'
      );
    }
    
    logger.info('Processing logout request', {
      userId: user.id,
      email: user.email
    });
    
    // 2. Logout via AuthService (best effort)
    try {
      const authService = createAuthService(supabase);
      await authService.logout();
    } catch (error) {
      // Log but continue with client cleanup
      logger.warning('AuthService.logout error', {
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown'
      });
    }
    
    // 3. Clear refresh token cookie (critical step)
    try {
      context.cookies.delete('sb-refresh-token', {
        path: '/'
      });
      logger.info('Refresh token cookie cleared', { userId: user.id });
    } catch (error) {
      logger.error('Failed to clear cookie', error as Error, {
        userId: user.id
      });
      // This is more serious - return error
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'Failed to complete logout. Please clear your browser cookies.'
      );
    }
    
    logger.info('User logged out successfully', {
      userId: user.id,
      email: user.email
    });
    
    // 4. Return 204 No Content
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      }
    });
    
  } catch (error) {
    // Unexpected error
    logger.critical('Unexpected error in logout endpoint', error as Error);
    
    // Still try to clear cookie as last resort
    try {
      context.cookies.delete('sb-refresh-token', { path: '/' });
    } catch (cookieError) {
      logger.error('Cookie cleanup in error handler failed', cookieError as Error);
    }
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred during logout'
    );
  }
}
```

### Faza 3: Testing

#### 3.1. Unit Tests

```typescript
// tests/lib/services/auth.service.logout.test.ts
describe('AuthService.logout', () => {
  it('should call Supabase signOut', async () => {
    const mockSignOut = jest.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      auth: {
        signOut: mockSignOut
      }
    } as any;
    
    const authService = new AuthService(mockSupabase);
    await authService.logout();
    
    expect(mockSignOut).toHaveBeenCalled();
  });
  
  it('should not throw on Supabase error', async () => {
    const mockSupabase = {
      auth: {
        signOut: jest.fn().mockResolvedValue({
          error: { message: 'Session not found' }
        })
      }
    } as any;
    
    const authService = new AuthService(mockSupabase);
    
    // Should not throw
    await expect(authService.logout()).resolves.toBeUndefined();
  });
});
```

#### 3.2. Integration Tests

```typescript
// tests/api/auth/logout.test.ts
describe('POST /api/auth/logout', () => {
  it('should return 401 without authentication', async () => {
    const response = await fetch('/api/auth/logout', {
      method: 'POST'
    });
    
    expect(response.status).toBe(401);
  });
  
  it('should logout successfully with valid token', async () => {
    // First login to get token
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPass123'
      }),
      credentials: 'include'
    });
    
    const { session } = await loginResponse.json();
    
    // Then logout
    const logoutResponse = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`
      },
      credentials: 'include'
    });
    
    expect(logoutResponse.status).toBe(204);
    
    // Verify cookie was cleared
    const cookies = logoutResponse.headers.get('set-cookie');
    expect(cookies).toContain('sb-refresh-token=');
    expect(cookies).toContain('Max-Age=0');
  });
  
  it('should invalidate token after logout', async () => {
    // Login
    const loginResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@example.com',
        password: 'TestPass123'
      })
    });
    
    const { session } = await loginResponse.json();
    const token = session.access_token;
    
    // Logout
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Try to use token after logout (should fail eventually)
    // Note: Token might still work for a bit if not blacklisted
    const protectedResponse = await fetch('/api/flashcards', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    // Behavior depends on implementation:
    // - Without blacklist: might still work until expiry
    // - With blacklist: should fail immediately
  });
});
```

#### 3.3. Manual Testing Checklist

- [ ] **Happy Path**
  - [ ] Login user
  - [ ] Logout user → 204
  - [ ] Verify cookie cleared (DevTools)
  - [ ] Verify can't access protected endpoints
  - [ ] Verify can login again

- [ ] **Unauthorized Access**
  - [ ] Logout without token → 401
  - [ ] Logout with expired token → 401
  - [ ] Logout with invalid token → 401

- [ ] **Cookie Handling**
  - [ ] Cookie deleted after logout
  - [ ] Max-Age=0 in Set-Cookie header
  - [ ] Path matches original cookie

- [ ] **Multiple Sessions**
  - [ ] Login on device A
  - [ ] Login on device B
  - [ ] Logout on device A
  - [ ] Verify device B still works (or not, depending on scope)

- [ ] **Error Handling**
  - [ ] Supabase error doesn't break logout
  - [ ] Cookie still cleared on Supabase error

---

## 10. Dokumentacja

### API Endpoint Documentation

```markdown
## POST /api/auth/logout

Logout current user and invalidate session.

### Request

```http
POST /api/auth/logout
Authorization: Bearer {access_token}
```

### Response

**Success (204 No Content):**
```http
HTTP/1.1 204 No Content
Set-Cookie: sb-refresh-token=; Max-Age=0; Path=/; HttpOnly; Secure
```

**Errors:**
- `401` - Not authenticated
- `500` - Logout failed

### Behavior
- Invalidates current session
- Clears refresh token cookie
- Does not affect other active sessions
```

### Frontend Integration

```typescript
// Logout function
async function logout() {
  try {
    const token = getAccessToken(); // From state/memory
    
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      credentials: 'include' // Important for cookie deletion
    });
    
    if (response.status === 204 || response.status === 401) {
      // Success or already logged out
      // Clear client state
      clearAccessToken();
      clearUserData();
      
      // Redirect to login
      window.location.href = '/login';
    } else {
      // Server error - still cleanup client
      console.error('Logout failed, cleaning up client anyway');
      clearAccessToken();
      clearUserData();
      window.location.href = '/login';
    }
    
  } catch (error) {
    // Network error - still cleanup client
    console.error('Network error during logout:', error);
    clearAccessToken();
    clearUserData();
    window.location.href = '/login';
  }
}
```

---

## 11. Checklist końcowy

### Pre-deployment
- [ ] AuthService.logout method implemented
- [ ] Route handler implemented
- [ ] Cookie deletion working
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Manual testing complete
- [ ] Frontend logout flow tested

### Security Verification
- [ ] JWT token required
- [ ] Session invalidated
- [ ] Cookie deleted
- [ ] No sensitive data in logs
- [ ] Error handling graceful

### Post-deployment
- [ ] Monitor logout success rate
- [ ] Monitor Supabase errors
- [ ] Verify cookie deletion
- [ ] User feedback

---

## 12. Notatki dodatkowe

### Design Decisions

**1. Always succeed philosophy:**
- Client cleanup > Server cleanup
- User intent clear: logout
- Failing logout frustrating for users

**2. No rate limiting:**
- User może się wylogować ile razy chce
- Logout nie jest attack vector

**3. No blacklist (MVP):**
- Short-lived tokens (1h)
- Complexity vs risk trade-off
- Can add later if needed

### Future Enhancements

**1. Global logout:**
```typescript
// Logout from all devices
await supabase.auth.signOut({ scope: 'global' });
```

**2. Token blacklist:**
```typescript
// Add to Redis on logout
await redis.setex(`blacklist:${accessToken}`, 3600, '1');
```

**3. Logout audit:**
```typescript
// Track logout events
await db.insert('audit_log', {
  user_id,
  action: 'logout',
  ip_address,
  user_agent,
  timestamp
});
```

**Autor:** AI Architecture Team  
**Data:** 2025-10-12  
**Wersja:** 1.0  
**Status:** Ready for Implementation

