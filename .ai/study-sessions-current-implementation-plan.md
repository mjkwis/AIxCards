# API Endpoint Implementation Plan: GET /api/study-sessions/current

## 1. Przegląd punktu końcowego

**Endpoint:** `GET /api/study-sessions/current`

**Cel:** Pobranie fiszek należnych do powtórki (spaced repetition). Endpoint zwraca listę aktywnych fiszek, których `next_review_at` jest <= current timestamp, posortowane według daty review (najstarsze najpierw). Jest to kluczowy endpoint dla systemu spaced repetition (SM-2 algorithm).

**Funkcjonalność:**
- Zwraca tylko fiszki ze statusem `active`
- Filtruje fiszki gdzie `next_review_at <= NOW()`
- Sortuje po `next_review_at` ASC (najstarsze najpierw)
- Limit: max 50 fiszek per request (query param)
- Zwraca metadata: total due vs returned count
- Filtrowanie per user (automatic via RLS)

**User Stories:** US-008 (Spaced Repetition System)

**Bezpieczeństwo:** Endpoint chroniony (wymaga auth), read-only

---

## 2. Szczegóły żądania

### HTTP Method
`GET`

### URL Structure
```
/api/study-sessions/current?limit=20
```

### Headers (Required)
```http
Authorization: Bearer {access_token}
```

### Query Parameters

| Parametr | Typ | Wymagany | Default | Walidacja | Opis |
|----------|-----|----------|---------|-----------|------|
| `limit` | number | No | 20 | 1-50 | Max liczba fiszek do zwrócenia |

---

## 3. Wykorzystywane typy

### DTOs (z src/types.ts)

```typescript
// Request - Query Parameters
StudySessionQuery {
  limit?: number;  // Default: 20, Max: 50
}

// Response - Success
StudySessionResponse {
  session: StudySessionInfo;
  flashcards: FlashcardDTO[];
}

StudySessionInfo {
  flashcards_due: number;        // Total count of due flashcards
  flashcards_in_session: number; // Count returned in this response
}

FlashcardDTO {
  id: string;
  user_id: string;
  generation_request_id: string | null;
  front: string;
  back: string;
  source: FlashcardSource;
  status: FlashcardStatus;  // Will be "active"
  next_review_at: string | null;  // Will be <= NOW
  interval: number | null;
  ease_factor: number | null;
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
// src/lib/validation/study-sessions.ts
import { z } from 'zod';

export const StudySessionQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(50, "Limit must not exceed 50")
    .default(20)
});

export type StudySessionQueryInput = z.infer<typeof StudySessionQuerySchema>;
```

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

**Headers:**
```http
Content-Type: application/json
Cache-Control: private, no-cache
```

**Body - Case 1: Flashcards due**
```json
{
  "session": {
    "flashcards_due": 25,
    "flashcards_in_session": 20
  },
  "flashcards": [
    {
      "id": "uuid-1",
      "user_id": "user-uuid",
      "generation_request_id": "gr-uuid",
      "front": "What is photosynthesis?",
      "back": "A process to convert light energy into chemical energy.",
      "source": "ai_generated",
      "status": "active",
      "next_review_at": "2025-10-10T10:00:00Z",
      "interval": 1,
      "ease_factor": 2.5,
      "created_at": "2025-10-09T10:00:00Z",
      "updated_at": "2025-10-09T10:00:00Z"
    },
    {
      "id": "uuid-2",
      "user_id": "user-uuid",
      "generation_request_id": null,
      "front": "What is the capital of France?",
      "back": "Paris",
      "source": "manual",
      "status": "active",
      "next_review_at": "2025-10-11T14:00:00Z",
      "interval": 3,
      "ease_factor": 2.6,
      "created_at": "2025-10-08T10:00:00Z",
      "updated_at": "2025-10-08T10:00:00Z"
    }
    // ... up to 20 flashcards (or limit param)
  ]
}
```

**Body - Case 2: No flashcards due**
```json
{
  "session": {
    "flashcards_due": 0,
    "flashcards_in_session": 0
  },
  "flashcards": []
}
```

**Uwagi:**
- `flashcards_due` = total count (może być > limit)
- `flashcards_in_session` = actual count returned (≤ limit)
- Flashcards sortowane po `next_review_at` ASC (oldest first)
- Wszystkie flashcards mają `status` = "active"
- Wszystkie flashcards mają `next_review_at` ≤ current timestamp

### Error Responses

#### 400 Bad Request - VALIDATION_ERROR
**Scenariusze:**
- Invalid limit value (< 1 lub > 50)
- Invalid query parameter format

**Response:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Limit must not exceed 50",
    "details": {
      "field": "limit",
      "value": 100,
      "max": 50
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

#### 500 Internal Server Error - INTERNAL_ERROR
**Scenariusze:**
- Database error
- Unexpected exception

**Response:**
```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to fetch study session. Please try again later."
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
      └─→ Inject supabase + user to context
      ↓
[2] API Route Handler (GET)
      ├─→ Parse query params
      └─→ Validate with Zod
      ↓
[3] StudySessionService.getCurrent()
      ├─→ [3a] Count total due flashcards
      ├─→ [3b] Query flashcards (with limit)
      ├─→     WHERE status = 'active'
      ├─→     AND next_review_at <= NOW()
      ├─→     ORDER BY next_review_at ASC
      ├─→     LIMIT {limit}
      └─→ [3c] Build StudySessionResponse
      ↓
[4] Return Response
      └─→ 200 OK + JSON
      ↓
Client Response (200)
```

### SQL Query (Conceptual)

```sql
-- Step 1: Count total due flashcards
SELECT COUNT(*)
FROM flashcards
WHERE user_id = $userId
  AND status = 'active'
  AND next_review_at <= NOW();

-- Step 2: Get limited flashcards for session
SELECT *
FROM flashcards
WHERE user_id = $userId
  AND status = 'active'
  AND next_review_at <= NOW()
ORDER BY next_review_at ASC
LIMIT $limit;
```

---

## 6. Implementacja

### Service Method

**Plik:** `src/lib/services/study-session.service.ts`

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../db/database.types';
import type {
  StudySessionQuery,
  StudySessionResponse,
  StudySessionInfo,
  FlashcardDTO
} from '../../types';
import { Logger } from './logger.service';
import { DatabaseError } from '../errors/database.error';

const logger = new Logger('StudySessionService');

export class StudySessionService {
  constructor(private supabase: SupabaseClient<Database>) {}
  
  /**
   * Get current study session (flashcards due for review)
   * 
   * Returns flashcards where:
   * - status = 'active'
   * - next_review_at <= NOW()
   * 
   * Ordered by next_review_at ASC (oldest first)
   * Limited by query param (default: 20, max: 50)
   */
  async getCurrent(
    userId: string,
    query: StudySessionQuery
  ): Promise<StudySessionResponse> {
    try {
      const limit = query.limit ?? 20;
      const now = new Date().toISOString();
      
      logger.info('Fetching study session', {
        userId,
        limit,
        timestamp: now
      });
      
      // Step 1: Count total due flashcards
      const { count: totalDue, error: countError } = await this.supabase
        .from('flashcards')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'active')
        .lte('next_review_at', now);
      
      if (countError) {
        logger.error('Failed to count due flashcards', countError, { userId });
        throw new DatabaseError('Failed to count due flashcards', countError);
      }
      
      const flashcardsDue = totalDue || 0;
      
      logger.info('Flashcards due count', {
        userId,
        flashcardsDue
      });
      
      // Step 2: Get limited flashcards for session
      const { data: flashcards, error: queryError } = await this.supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .lte('next_review_at', now)
        .order('next_review_at', { ascending: true })
        .limit(limit);
      
      if (queryError) {
        logger.error('Failed to fetch flashcards', queryError, { userId });
        throw new DatabaseError('Failed to fetch flashcards', queryError);
      }
      
      const flashcardsInSession = flashcards?.length || 0;
      
      logger.info('Study session fetched', {
        userId,
        flashcardsDue,
        flashcardsInSession
      });
      
      // Step 3: Build response
      const session: StudySessionInfo = {
        flashcards_due: flashcardsDue,
        flashcards_in_session: flashcardsInSession
      };
      
      const response: StudySessionResponse = {
        session,
        flashcards: (flashcards || []).map(this.mapToDTO)
      };
      
      return response;
      
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error;
      }
      
      logger.error('Unexpected error in getCurrent', error as Error, { userId });
      throw new DatabaseError('Unexpected error fetching study session', error);
    }
  }
  
  /**
   * Map database entity to FlashcardDTO
   */
  private mapToDTO(entity: any): FlashcardDTO {
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
      updated_at: entity.updated_at
    };
  }
}

/**
 * Create StudySessionService instance
 */
export function createStudySessionService(
  supabase: SupabaseClient<Database>
): StudySessionService {
  return new StudySessionService(supabase);
}
```

### Route Handler

**Plik:** `src/pages/api/study-sessions/current.ts`

```typescript
import type { APIContext } from 'astro';
import { StudySessionQuerySchema } from '../../../lib/validation/study-sessions';
import { errorResponse } from '../../../lib/helpers/error-response';
import { createStudySessionService } from '../../../lib/services/study-session.service';
import { DatabaseError } from '../../../lib/errors/database.error';
import { Logger } from '../../../lib/services/logger.service';

const logger = new Logger('GET /api/study-sessions/current');

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  try {
    // 1. Verify authentication
    const user = context.locals.user;
    const supabase = context.locals.supabase;
    
    if (!user || !supabase) {
      logger.info('Unauthorized access attempt');
      return errorResponse(
        401,
        'AUTH_REQUIRED',
        'Valid authentication token is required'
      );
    }
    
    // 2. Parse and validate query parameters
    const url = new URL(context.request.url);
    const queryParams = {
      limit: url.searchParams.get('limit')
    };
    
    const validationResult = StudySessionQuerySchema.safeParse(queryParams);
    
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      logger.info('Validation error', {
        field: firstError.path.join('.'),
        message: firstError.message
      });
      
      return errorResponse(
        400,
        'VALIDATION_ERROR',
        firstError.message,
        {
          field: firstError.path.join('.'),
          value: queryParams.limit
        }
      );
    }
    
    logger.info('Fetching study session', {
      userId: user.id,
      limit: validationResult.data.limit
    });
    
    // 3. Get current study session
    const service = createStudySessionService(supabase);
    const result = await service.getCurrent(user.id, validationResult.data);
    
    logger.info('Study session fetched successfully', {
      userId: user.id,
      flashcardsDue: result.session.flashcards_due,
      flashcardsInSession: result.session.flashcards_in_session
    });
    
    // 4. Return response (200 OK)
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'private, no-cache' // Don't cache - due flashcards change over time
        }
      }
    );
    
  } catch (error) {
    if (error instanceof DatabaseError) {
      logger.error('Database error fetching study session', error, {
        userId: context.locals.user?.id
      });
      return errorResponse(
        500,
        'INTERNAL_ERROR',
        'Failed to fetch study session. Please try again later.'
      );
    }
    
    logger.critical('Unexpected error in study session endpoint', error as Error, {
      userId: context.locals.user?.id
    });
    
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      'An unexpected error occurred. Please try again later.'
    );
  }
}
```

---

## 7. Business Logic

### 7.1. Spaced Repetition Logic

**Query Criteria:**
```typescript
WHERE 
  user_id = $userId 
  AND status = 'active'              // Only active flashcards
  AND next_review_at <= NOW()        // Due now or overdue
ORDER BY 
  next_review_at ASC                 // Oldest (most overdue) first
LIMIT 
  $limit                             // Batch size (default 20, max 50)
```

**Why this matters:**
- **Active only:** `pending_review` and `rejected` flashcards excluded
- **Due now:** Based on SM-2 algorithm calculation
- **Oldest first:** Most overdue flashcards reviewed first (priority)
- **Limited batches:** Don't overwhelm user with too many cards at once

### 7.2. Flashcard States and Review Eligibility

**Eligible for review:**
```typescript
status = 'active' AND next_review_at <= NOW()
```

**Not eligible:**
```typescript
// Pending approval (AI-generated, not yet approved)
status = 'pending_review'

// Rejected (not in study rotation)
status = 'rejected'

// Future review (not due yet)
status = 'active' AND next_review_at > NOW()
```

### 7.3. Empty Session Handling

**Case: No flashcards due**
```json
{
  "session": {
    "flashcards_due": 0,
    "flashcards_in_session": 0
  },
  "flashcards": []
}
```

**Frontend should:**
- Show "All caught up!" message
- Display next review time (query for MIN(next_review_at))
- Suggest creating new flashcards

### 7.4. Pagination Strategy

**Not implemented (intentionally):**
- No page parameter
- No cursor-based pagination

**Rationale:**
- Study session is a snapshot in time
- User should complete current batch before getting more
- After review, flashcards are rescheduled (next_review_at changes)
- Pagination would cause confusing state

**User flow:**
1. Get current session (e.g., 20 cards)
2. Review all 20 cards
3. Get new current session (different 20 cards)
4. Repeat

---

## 8. Względy bezpieczeństwa

### 8.1. Authorization

**RLS (Row-Level Security):**
```sql
-- Supabase RLS policy ensures users only see their own flashcards
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read their own flashcards"
ON flashcards FOR SELECT
USING (auth.uid() = user_id);
```

**Middleware Check:**
- JWT token required
- User ID extracted from token
- All queries filtered by user_id

### 8.2. Rate Limiting

**Not implemented (intentionally):**
- Study session is read-only
- Low computational cost
- User can refresh as often as needed

**If abuse becomes issue:**
```typescript
// Could add: 100 requests per hour per user
await rateLimitService.checkStudySessionRateLimit(userId);
```

### 8.3. Data Privacy

**Safe to expose:**
- User's own flashcards
- Review metadata (due count)

**Never expose:**
- Other users' flashcards
- System-wide statistics
- Database performance metrics

---

## 9. Rozważania dotyczące wydajności

### 9.1. Query Performance

**Indexes required:**
```sql
-- Composite index for study session query
CREATE INDEX idx_flashcards_user_next_review 
ON flashcards(user_id, status, next_review_at);

-- Already exists in schema (migrations/20251010120400_create_indexes.sql)
```

**Query efficiency:**
- **With index:** O(log n) lookup + O(m) retrieval (m = limit)
- **Without index:** O(n) full table scan (slow for large datasets)

**Expected performance:**
- < 50ms for typical user (< 1000 flashcards)
- < 100ms for power user (< 10000 flashcards)

### 9.2. Caching Strategy

**Should NOT cache:**
- Study session results (stale data problem)
- Flashcards can be reviewed and rescheduled
- next_review_at changes frequently

**Could cache:**
- User's total flashcard count (5 min TTL)
- User's study streak (5 min TTL)

**Decision:** No caching for MVP

### 9.3. Optimization Opportunities

**Option 1: Precompute due count**
```typescript
// Could use materialized view or cached count
// But adds complexity - not worth it for MVP
```

**Option 2: Combine count + query**
```typescript
// Could use window function to get count + data in one query
// But Supabase client makes separate queries easier
```

**Decision:** Two separate queries (simpler, fast enough)

### 9.4. Monitoring

**Key Metrics:**
1. **Average Due Flashcards**
   - Track: Mean flashcards_due per user
   - Alert: Sudden drop (users disengaging?)

2. **Response Time**
   - P50: < 50ms
   - P95: < 100ms
   - P99: < 200ms

3. **Empty Session Rate**
   - Track: % of requests with flashcards_due = 0
   - High rate = users caught up (good!)

4. **Session Size Distribution**
   - Track: histogram of flashcards_in_session
   - Understand user study habits

---

## 10. Frontend Integration

### Example Usage

```typescript
// React component
import { useState, useEffect } from 'react';

interface StudySession {
  session: {
    flashcards_due: number;
    flashcards_in_session: number;
  };
  flashcards: Flashcard[];
}

export function StudySessionView() {
  const [session, setSession] = useState<StudySession | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchStudySession();
  }, []);
  
  async function fetchStudySession() {
    try {
      const token = getAccessToken();
      const response = await fetch('/api/study-sessions/current?limit=20', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch study session');
      }
      
      const data = await response.json();
      setSession(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }
  
  if (loading) return <div>Loading...</div>;
  
  if (!session || session.session.flashcards_due === 0) {
    return (
      <div className="empty-state">
        <h2>🎉 All caught up!</h2>
        <p>No flashcards due for review right now.</p>
        <p>Check back later or create new flashcards.</p>
      </div>
    );
  }
  
  return (
    <div className="study-session">
      <div className="session-header">
        <h2>Study Session</h2>
        <p>
          Reviewing {session.session.flashcards_in_session} of {session.session.flashcards_due} due flashcards
        </p>
      </div>
      
      <FlashcardReviewComponent flashcards={session.flashcards} />
    </div>
  );
}
```

---

## 11. Testing

### Unit Tests

```typescript
// tests/lib/services/study-session.service.test.ts
describe('StudySessionService', () => {
  it('should return due flashcards', async () => {
    const mockSupabase = createMockSupabase({
      countQuery: { count: 5, error: null },
      selectQuery: { data: mockFlashcards, error: null }
    });
    
    const service = new StudySessionService(mockSupabase);
    const result = await service.getCurrent('user-id', { limit: 20 });
    
    expect(result.session.flashcards_due).toBe(5);
    expect(result.session.flashcards_in_session).toBe(5);
    expect(result.flashcards).toHaveLength(5);
  });
  
  it('should handle empty session', async () => {
    const mockSupabase = createMockSupabase({
      countQuery: { count: 0, error: null },
      selectQuery: { data: [], error: null }
    });
    
    const service = new StudySessionService(mockSupabase);
    const result = await service.getCurrent('user-id', { limit: 20 });
    
    expect(result.session.flashcards_due).toBe(0);
    expect(result.session.flashcards_in_session).toBe(0);
    expect(result.flashcards).toEqual([]);
  });
  
  it('should respect limit parameter', async () => {
    const mockSupabase = createMockSupabase({
      countQuery: { count: 100, error: null },
      selectQuery: { data: mockFlashcards.slice(0, 10), error: null }
    });
    
    const service = new StudySessionService(mockSupabase);
    const result = await service.getCurrent('user-id', { limit: 10 });
    
    expect(result.session.flashcards_due).toBe(100);
    expect(result.session.flashcards_in_session).toBe(10);
    expect(result.flashcards).toHaveLength(10);
  });
});
```

### Integration Tests

```typescript
// tests/api/study-sessions/current.test.ts
describe('GET /api/study-sessions/current', () => {
  it('should return 401 without authentication', async () => {
    const response = await fetch('/api/study-sessions/current');
    expect(response.status).toBe(401);
  });
  
  it('should return study session with due flashcards', async () => {
    const token = await getAuthToken();
    
    // Create some flashcards that are due
    await createFlashcard({
      front: 'Q1',
      back: 'A1',
      next_review_at: new Date(Date.now() - 1000).toISOString() // Past
    });
    
    const response = await fetch('/api/study-sessions/current', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.session.flashcards_due).toBeGreaterThan(0);
    expect(data.flashcards).toBeInstanceOf(Array);
  });
  
  it('should return empty session when no flashcards due', async () => {
    const token = await getAuthToken();
    
    const response = await fetch('/api/study-sessions/current', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.session.flashcards_due).toBe(0);
    expect(data.flashcards).toEqual([]);
  });
  
  it('should validate limit parameter', async () => {
    const token = await getAuthToken();
    
    const response = await fetch('/api/study-sessions/current?limit=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
  
  it('should respect limit parameter', async () => {
    const token = await getAuthToken();
    
    // Create 30 due flashcards
    for (let i = 0; i < 30; i++) {
      await createFlashcard({
        front: `Q${i}`,
        back: `A${i}`,
        next_review_at: new Date(Date.now() - 1000).toISOString()
      });
    }
    
    const response = await fetch('/api/study-sessions/current?limit=10', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.session.flashcards_due).toBe(30);
    expect(data.session.flashcards_in_session).toBe(10);
    expect(data.flashcards).toHaveLength(10);
  });
  
  it('should order flashcards by next_review_at ASC', async () => {
    const token = await getAuthToken();
    
    // Create flashcards with different review times
    await createFlashcard({
      front: 'Q3',
      back: 'A3',
      next_review_at: new Date('2025-10-12T12:00:00Z').toISOString()
    });
    await createFlashcard({
      front: 'Q1',
      back: 'A1',
      next_review_at: new Date('2025-10-12T10:00:00Z').toISOString()
    });
    await createFlashcard({
      front: 'Q2',
      back: 'A2',
      next_review_at: new Date('2025-10-12T11:00:00Z').toISOString()
    });
    
    const response = await fetch('/api/study-sessions/current', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    expect(data.flashcards[0].front).toBe('Q1'); // Oldest first
    expect(data.flashcards[1].front).toBe('Q2');
    expect(data.flashcards[2].front).toBe('Q3');
  });
});
```

---

## 12. Checklist końcowy

### Pre-deployment
- [ ] StudySessionService implemented
- [ ] Query parameters validation working
- [ ] Index `idx_flashcards_user_next_review` exists
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Error handling comprehensive
- [ ] Logging implemented

### Functionality
- [ ] Returns only active flashcards
- [ ] Filters by next_review_at <= NOW()
- [ ] Orders by next_review_at ASC
- [ ] Respects limit parameter (1-50)
- [ ] Returns accurate metadata (due vs in session)
- [ ] Handles empty session correctly

### Security
- [ ] Authentication required
- [ ] RLS policies enforced
- [ ] User can only see own flashcards

### Performance
- [ ] Query uses index
- [ ] Response time < 100ms (P95)
- [ ] No N+1 queries
- [ ] No unnecessary data fetched

### Post-deployment
- [ ] Monitor query performance
- [ ] Track empty session rate
- [ ] Monitor average due flashcards
- [ ] User feedback on UX

---

## 13. Notatki dodatkowe

### Ważne decyzje projektowe

1. **Two separate queries (count + select):**
   - **Chosen:** Yes, separate queries
   - **Rationale:** Simpler code, Supabase client pattern, fast enough

2. **No pagination:**
   - **Chosen:** No page parameter
   - **Rationale:** Study session is snapshot; user should complete batch

3. **Default limit 20, max 50:**
   - **Chosen:** 20 default, 50 max
   - **Rationale:** Balance between "enough to study" and "not overwhelming"

4. **Oldest first ordering:**
   - **Chosen:** ORDER BY next_review_at ASC
   - **Rationale:** Most overdue flashcards reviewed first (priority)

5. **No caching:**
   - **Chosen:** Cache-Control: no-cache
   - **Rationale:** Data changes frequently after reviews

### Integration with SM-2 Algorithm

This endpoint is **read-only** - it shows what's due.

The **write operation** (updating next_review_at) happens in:
- `POST /api/study-sessions/review` (after user reviews a flashcard)

**Flow:**
1. GET /api/study-sessions/current → Get 20 flashcards
2. User reviews flashcard #1 → POST /api/study-sessions/review
3. Server calculates new next_review_at using SM-2
4. Flashcard #1 rescheduled for future
5. GET /api/study-sessions/current → Get next batch (doesn't include #1 anymore)

### Future Enhancements

1. **Next Review Time:** Add `next_review_time` to response (when is next flashcard due)
2. **Study Streak:** Track consecutive days studied
3. **Session History:** Track completed sessions per day
4. **Smart Batching:** Adjust batch size based on user behavior
5. **Study Reminders:** Notify when flashcards are due
6. **Difficulty Filtering:** Option to review only "hard" flashcards

**Autor:** AI Architecture Team  
**Data:** 2025-10-12  
**Wersja:** 1.0  
**Status:** Ready for Implementation  
**Priority:** CRITICAL - Core Spaced Repetition Feature
