# REST API Plan for 10x-cards

## 1. Resources

The API is organized around the following main resources:

| Resource              | Database Table        | Description                                         |
| --------------------- | --------------------- | --------------------------------------------------- |
| `users`               | `auth.users`          | User accounts (managed by Supabase Auth)            |
| `generation-requests` | `generation_requests` | AI flashcard generation requests                    |
| `flashcards`          | `flashcards`          | Flashcards (both AI-generated and manual)           |
| `study-sessions`      | N/A (derived)         | Study sessions based on spaced repetition algorithm |

## 2. API Endpoints

### 2.1. Authentication Endpoints

#### POST /api/auth/register

Register a new user account.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success Response (201 Created):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2025-10-11T10:00:00Z"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": "2025-10-11T11:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid email format or weak password
- `409 Conflict`: Email already registered

---

#### POST /api/auth/login

Authenticate an existing user.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success Response (200 OK):**

```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2025-10-11T10:00:00Z"
  },
  "session": {
    "access_token": "jwt_token",
    "refresh_token": "refresh_token",
    "expires_at": "2025-10-11T11:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Missing credentials
- `401 Unauthorized`: Invalid credentials

---

#### POST /api/auth/logout

Log out the current user.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (204 No Content)**

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token

---

#### DELETE /api/auth/account

Delete the current user's account and all associated data.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (204 No Content)**

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token

---

### 2.2. Generation Requests Endpoints

#### POST /api/generation-requests

Create a new AI flashcard generation request.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "source_text": "String containing the text to generate flashcards from (1000-10000 characters)"
}
```

**Success Response (201 Created):**

```json
{
  "generation_request": {
    "id": "uuid",
    "user_id": "uuid",
    "source_text": "Original text...",
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:00:00Z"
  },
  "flashcards": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "generation_request_id": "uuid",
      "front": "Question text",
      "back": "Answer text",
      "source": "ai_generated",
      "status": "pending_review",
      "created_at": "2025-10-11T10:00:00Z",
      "updated_at": "2025-10-11T10:00:00Z"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request`: Invalid text length (must be 1000-10000 characters)
- `401 Unauthorized`: Invalid or missing token
- `422 Unprocessable Entity`: AI service error (MVP: unlikely with MockAIService, important for production)
- `429 Too Many Requests`: Rate limit exceeded

---

#### GET /api/generation-requests

List all generation requests for the current user.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `sort` (optional): Sort field (default: "created_at")
- `order` (optional): Sort order - "asc" or "desc" (default: "desc")

**Success Response (200 OK):**

```json
{
  "generation_requests": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "source_text": "Original text...",
      "flashcard_count": 5,
      "created_at": "2025-10-11T10:00:00Z",
      "updated_at": "2025-10-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `400 Bad Request`: Invalid query parameters

---

#### GET /api/generation-requests/:id

Get a specific generation request with its flashcards.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (200 OK):**

```json
{
  "generation_request": {
    "id": "uuid",
    "user_id": "uuid",
    "source_text": "Original text...",
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:00:00Z"
  },
  "flashcards": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "generation_request_id": "uuid",
      "front": "Question text",
      "back": "Answer text",
      "source": "ai_generated",
      "status": "pending_review",
      "created_at": "2025-10-11T10:00:00Z",
      "updated_at": "2025-10-11T10:00:00Z"
    }
  ]
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Generation request belongs to another user
- `404 Not Found`: Generation request not found

---

#### DELETE /api/generation-requests/:id

Delete a specific generation request.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (204 No Content)**

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Generation request belongs to another user
- `404 Not Found`: Generation request not found

---

### 2.3. Flashcards Endpoints

#### POST /api/flashcards

Create one or more flashcards manually or from AI generation (full or edited).

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Request Body:**
Create a new flashcard manually.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "front": "Question text",
  "back": "Answer text"
}
```

**Success Response (201 Created):**

```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": null,
    "front": "Question text",
    "back": "Answer text",
    "source": "manual",
    "status": "active",
    "next_review_at": "2025-10-11T10:00:00Z",
    "interval": 0,
    "ease_factor": 2.5,
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Missing or invalid front/back text
- `401 Unauthorized`: Invalid or missing token

---

#### GET /api/flashcards

List all flashcards for the current user.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20, max: 100)
- `status` (optional): Filter by status - "active", "pending_review", "rejected"
- `source` (optional): Filter by source - "manual", "ai_generated"
- `sort` (optional): Sort field (default: "created_at")
- `order` (optional): Sort order - "asc" or "desc" (default: "desc")

**Success Response (200 OK):**

```json
{
  "flashcards": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "generation_request_id": "uuid",
      "front": "Question text",
      "back": "Answer text",
      "source": "ai_generated",
      "status": "active",
      "next_review_at": "2025-10-11T10:00:00Z",
      "interval": 1,
      "ease_factor": 2.5,
      "created_at": "2025-10-11T10:00:00Z",
      "updated_at": "2025-10-11T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `400 Bad Request`: Invalid query parameters

---

#### GET /api/flashcards/:id

Get a specific flashcard.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (200 OK):**

```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": "uuid",
    "front": "Question text",
    "back": "Answer text",
    "source": "ai_generated",
    "status": "active",
    "next_review_at": "2025-10-11T10:00:00Z",
    "interval": 1,
    "ease_factor": 2.5,
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:00:00Z"
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Flashcard belongs to another user
- `404 Not Found`: Flashcard not found

---

#### PATCH /api/flashcards/:id

Update a specific flashcard.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Request Body (all fields optional):**

```json
{
  "front": "Updated question text",
  "back": "Updated answer text",
  "status": "active"
}
```

**Success Response (200 OK):**

```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": "uuid",
    "front": "Updated question text",
    "back": "Updated answer text",
    "source": "ai_generated",
    "status": "active",
    "next_review_at": "2025-10-11T10:00:00Z",
    "interval": 1,
    "ease_factor": 2.5,
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:05:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid field values
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Flashcard belongs to another user
- `404 Not Found`: Flashcard not found

---

#### DELETE /api/flashcards/:id

Delete a specific flashcard.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (204 No Content)**

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Flashcard belongs to another user
- `404 Not Found`: Flashcard not found

---

#### POST /api/flashcards/:id/approve

Approve an AI-generated flashcard (changes status from pending_review to active).

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (200 OK):**

```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": "uuid",
    "front": "Question text",
    "back": "Answer text",
    "source": "ai_generated",
    "status": "active",
    "next_review_at": "2025-10-11T10:00:00Z",
    "interval": 0,
    "ease_factor": 2.5,
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:05:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Flashcard is not in pending_review status
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Flashcard belongs to another user
- `404 Not Found`: Flashcard not found

---

#### POST /api/flashcards/:id/reject

Reject an AI-generated flashcard (changes status from pending_review to rejected).

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (200 OK):**

```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": "uuid",
    "front": "Question text",
    "back": "Answer text",
    "source": "ai_generated",
    "status": "rejected",
    "next_review_at": null,
    "interval": 0,
    "ease_factor": 2.5,
    "created_at": "2025-10-11T10:00:00Z",
    "updated_at": "2025-10-11T10:05:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Flashcard is not in pending_review status
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Flashcard belongs to another user
- `404 Not Found`: Flashcard not found

---

#### POST /api/flashcards/batch-approve

Approve multiple AI-generated flashcards at once.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "flashcard_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Success Response (200 OK):**

```json
{
  "approved": ["uuid1", "uuid2"],
  "failed": [
    {
      "id": "uuid3",
      "reason": "Flashcard not found or already approved"
    }
  ]
}
```

**Error Responses:**

- `400 Bad Request`: Invalid request body or empty flashcard_ids array
- `401 Unauthorized`: Invalid or missing token

---

### 2.4. Study Session Endpoints

#### GET /api/study-sessions/current

Get flashcards due for review in the current study session.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Query Parameters:**

- `limit` (optional): Maximum number of flashcards to return (default: 20, max: 50)

**Success Response (200 OK):**

```json
{
  "session": {
    "flashcards_due": 15,
    "flashcards_in_session": 15
  },
  "flashcards": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "generation_request_id": "uuid",
      "front": "Question text",
      "back": "Answer text",
      "source": "ai_generated",
      "status": "active",
      "next_review_at": "2025-10-11T09:00:00Z",
      "interval": 1,
      "ease_factor": 2.5,
      "created_at": "2025-10-11T08:00:00Z",
      "updated_at": "2025-10-11T08:00:00Z"
    }
  ]
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token
- `400 Bad Request`: Invalid query parameters

---

#### POST /api/study-sessions/review

Submit a review for a flashcard during a study session.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Request Body:**

```json
{
  "flashcard_id": "uuid",
  "quality": 3
}
```

**Notes:**

- `quality`: Integer from 0-5 representing recall quality (SM-2 algorithm standard):
  - 0: Complete blackout
  - 1: Incorrect response; correct one remembered
  - 2: Incorrect response; correct one seemed easy to recall
  - 3: Correct response recalled with serious difficulty
  - 4: Correct response after hesitation
  - 5: Perfect response

**Success Response (200 OK):**

```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": "uuid",
    "front": "Question text",
    "back": "Answer text",
    "source": "ai_generated",
    "status": "active",
    "next_review_at": "2025-10-13T10:00:00Z",
    "interval": 2,
    "ease_factor": 2.6,
    "created_at": "2025-10-11T08:00:00Z",
    "updated_at": "2025-10-11T10:00:00Z"
  }
}
```

**Error Responses:**

- `400 Bad Request`: Invalid quality value or missing fields
- `401 Unauthorized`: Invalid or missing token
- `403 Forbidden`: Flashcard belongs to another user
- `404 Not Found`: Flashcard not found

---

### 2.5. Statistics Endpoints

#### GET /api/statistics/overview

Get overview statistics for the current user.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (200 OK):**

```json
{
  "statistics": {
    "total_flashcards": 150,
    "active_flashcards": 120,
    "pending_review_flashcards": 15,
    "rejected_flashcards": 15,
    "manual_flashcards": 50,
    "ai_generated_flashcards": 100,
    "ai_acceptance_rate": 0.85,
    "flashcards_due_today": 25,
    "total_generation_requests": 10,
    "total_reviews_completed": 500
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token

---

#### GET /api/statistics/generation

Get detailed statistics about AI flashcard generation.

**Headers Required:**

- `Authorization: Bearer {access_token}`

**Success Response (200 OK):**

```json
{
  "statistics": {
    "total_generated": 100,
    "total_approved": 85,
    "total_rejected": 15,
    "approval_rate": 0.85,
    "average_flashcards_per_request": 10,
    "recent_requests": [
      {
        "date": "2025-10-11",
        "requests": 2,
        "flashcards_generated": 20,
        "flashcards_approved": 17
      }
    ]
  }
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing token

---

## 3. Authentication and Authorization

### 3.1. Authentication Method

The API uses **JWT (JSON Web Tokens)** for authentication, managed by Supabase Auth.

**Implementation Details:**

- Authentication is handled by Supabase Auth service
- Users receive an `access_token` and `refresh_token` upon successful login/registration
- Access tokens expire after 1 hour (configurable in Supabase)
- Refresh tokens are used to obtain new access tokens
- All protected endpoints require the `Authorization` header with Bearer token

**Header Format:**

```
Authorization: Bearer {access_token}
```

### 3.2. Authorization Strategy

Authorization is enforced at two levels:

1. **API Level:**
   - All endpoints (except auth endpoints) require valid JWT token
   - Token validation is performed by Astro middleware
   - User ID is extracted from JWT and used for data access control

2. **Database Level:**
   - Row-Level Security (RLS) policies ensure users can only access their own data
   - RLS policies are defined in the database schema
   - Policies use `auth.uid()` function to compare with `user_id` columns

### 3.3. Session Management

- Sessions are managed by Supabase Auth
- Refresh tokens are stored securely (httpOnly cookies recommended)
- Access tokens should be stored in memory (not localStorage for security)
- Token refresh is handled automatically by Supabase client SDK

---

## 4. Validation and Business Logic

### 4.1. Input Validation Rules

#### Generation Requests

- `source_text`:
  - **Required**: Yes
  - **Type**: String
  - **Min Length**: 1000 characters
  - **Max Length**: 10000 characters
  - **Error Message**: "Source text must be between 1000 and 10000 characters"

#### Flashcards

- `front`:
  - **Required**: Yes
  - **Type**: String
  - **Min Length**: 1 character
  - **Max Length**: 1000 characters (recommended)
  - **Error Message**: "Front text is required and must not exceed 1000 characters"

- `back`:
  - **Required**: Yes
  - **Type**: String
  - **Min Length**: 1 character
  - **Max Length**: 2000 characters (recommended)
  - **Error Message**: "Back text is required and must not exceed 2000 characters"

- `status`:
  - **Type**: Enum
  - **Allowed Values**: "active", "pending_review", "rejected"
  - **Error Message**: "Invalid status value"

- `source`:
  - **Type**: Enum (set automatically)
  - **Allowed Values**: "manual", "ai_generated"
  - **Note**: Cannot be changed after creation

- `interval`:
  - **Type**: Integer (nullable)
  - **Default**: 0 for new flashcards
  - **Note**: Days until next review (SM-2 algorithm)

- `ease_factor`:
  - **Type**: Float (nullable)
  - **Default**: 2.5 for new flashcards
  - **Note**: Difficulty multiplier (SM-2 algorithm)

- `next_review_at`:
  - **Type**: ISO 8601 timestamp (nullable)
  - **Default**:
    - Manual flashcards: current timestamp (due immediately)
    - AI-generated (pending_review): null (not yet scheduled)
    - Rejected: null (not scheduled)

#### Study Session Review

- `quality`:
  - **Required**: Yes
  - **Type**: FlashcardQuality (union type: 0 | 1 | 2 | 3 | 4 | 5)
  - **Min Value**: 0
  - **Max Value**: 5
  - **Error Message**: "Quality must be an integer between 0 and 5"
  - **Note**: See FlashcardQuality type definition in src/types.ts

### 4.2. Business Logic Implementation

#### AI Flashcard Generation Flow (US-003, US-004)

1. User submits text via `POST /api/generation-requests`
2. API validates text length (1000-10000 chars)
3. API calls AI Service to generate flashcards
   - **MVP:** MockAIService (deterministic test data)
   - **Future:** OpenRouter.ai with configured prompt
4. AI response is parsed into flashcard objects
5. Flashcards are created with:
   - `source` = "ai_generated"
   - `status` = "pending_review"
   - `generation_request_id` = current request ID
6. Both generation request and flashcards are returned
7. User reviews flashcards and can:
   - Approve: `POST /api/flashcards/:id/approve` (status → "active")
   - Reject: `POST /api/flashcards/:id/reject` (status → "rejected")
   - Edit: `PATCH /api/flashcards/:id` (can modify front/back before/after approval)

#### Manual Flashcard Creation (US-007)

1. User submits flashcard via `POST /api/flashcards`
2. Flashcard is created with:
   - `source` = "manual"
   - `status` = "active" (no review needed)
   - `generation_request_id` = null
   - `next_review_at` = current timestamp (due immediately)
   - `interval` = 0
   - `ease_factor` = 2.5 (SM-2 default)

#### Spaced Repetition Algorithm (US-008)

The API integrates with the SM-2 (SuperMemo 2) algorithm:

1. **Get Due Flashcards**: `GET /api/study-sessions/current`
   - Returns flashcards where:
     - `status` = "active"
     - `next_review_at` <= current timestamp
   - Ordered by `next_review_at` ASC
   - Limited by query parameter (default: 20)

2. **Submit Review**: `POST /api/study-sessions/review`
   - Receives flashcard ID and quality rating (0-5)
   - Algorithm calculates new values:
     - If quality < 3: Reset interval to 0 (repeat today)
     - If quality >= 3: Increase interval based on ease factor
     - Adjust ease factor based on quality
   - Updates flashcard:
     - `interval`: New interval in days
     - `ease_factor`: New ease factor
     - `next_review_at`: Current time + interval
     - `updated_at`: Current timestamp

3. **SM-2 Algorithm Implementation**:

   ```
   If quality < 3:
     interval = 0
     ease_factor unchanged
   Else:
     If interval = 0:
       interval = 1
     Else if interval = 1:
       interval = 6
     Else:
       interval = interval * ease_factor

     ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
     ease_factor = max(1.3, ease_factor)

   next_review_at = now() + interval days
   ```

#### Flashcard Lifecycle

1. **AI-Generated**:
   - Created → `pending_review`
   - User approves → `active`
   - User rejects → `rejected`

2. **Manual**:
   - Created → `active` (skip review)

3. **Active Flashcards**:
   - Available in study sessions
   - Can be edited
   - Can be deleted

4. **Rejected Flashcards**:
   - Not shown in study sessions
   - Kept for statistics
   - Can be edited and reactivated if needed

#### Statistics Collection (PRD Section 6)

Statistics are calculated on-demand from flashcard and generation_requests tables:

1. **AI Acceptance Rate**:
   - Formula: (approved AI flashcards) / (total AI flashcards) \* 100
   - Approved = `source = 'ai_generated' AND status = 'active'`
   - Total AI = `source = 'ai_generated' AND status IN ('active', 'rejected')`

2. **AI vs Manual Ratio**:
   - AI: `COUNT(*) WHERE source = 'ai_generated' AND status = 'active'`
   - Manual: `COUNT(*) WHERE source = 'manual' AND status = 'active'`

3. **Engagement Metrics**:
   - Tracked through review submissions
   - Can be expanded with additional review_history table in future

### 4.3. Error Handling Strategy

All API errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  }
}
```

**Common Error Codes:**

- `AUTH_REQUIRED`: Missing or invalid authentication token
- `FORBIDDEN`: User lacks permission for this resource
- `NOT_FOUND`: Resource not found
- `VALIDATION_ERROR`: Input validation failed
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `AI_SERVICE_ERROR`: AI generation service unavailable
- `INTERNAL_ERROR`: Unexpected server error

### 4.4. Rate Limiting

To protect the AI generation endpoint and prevent abuse:

- **AI Generation**: 10 requests per hour per user
- **Other Endpoints**: 1000 requests per hour per user
- Rate limit headers included in responses:
  ```
  X-RateLimit-Limit: 10
  X-RateLimit-Remaining: 7
  X-RateLimit-Reset: 1696942800
  ```

### 4.5. Data Privacy and GDPR Compliance (PRD Section 7)

- **Data Ownership**: Users own all their flashcards and generation requests
- **Data Access**: Users can export all their data via statistics endpoints
- **Data Deletion**: `DELETE /api/auth/account` removes:
  - User account
  - All flashcards (CASCADE)
  - All generation requests (CASCADE)
- **Row-Level Security**: Ensures users cannot access others' data
- **Audit Trail**: `created_at` and `updated_at` timestamps on all records

---

## 5. Additional Considerations

### 5.1. Performance Optimization

1. **Database Indexes** (from schema):
   - User-based queries optimized with `idx_flashcards_user_id`
   - Study session queries optimized with `idx_flashcards_user_next_review`
   - Status filtering optimized with `idx_flashcards_status`

2. **Pagination**:
   - All list endpoints support pagination
   - Default page size: 20 items
   - Maximum page size: 100 items

3. **Caching Strategy**:
   - Statistics can be cached for 5 minutes
   - User session data cached in Supabase Auth
   - No caching for flashcard lists (real-time updates important)

### 5.2. API Versioning

- Current version: `v1` (implicit in `/api/` prefix)
- Future versions would use: `/api/v2/`
- Version included in response headers: `X-API-Version: 1.0.0`

### 5.3. Content Type

- All requests with body must include: `Content-Type: application/json`
- All responses return: `Content-Type: application/json`

### 5.4. CORS Configuration

- Configured in Astro middleware
- Allowed origins based on deployment environment
- Development: `http://localhost:*`
- Production: Configured domain only

### 5.5. Webhook Support (Future)

Not included in MVP, but API structure supports future webhook integration for:

- Study reminders
- Daily flashcard due notifications
- Achievement milestones

---

## 6. Implementation Notes for Astro + Supabase

### 6.1. API Endpoints Structure

API endpoints are implemented as Astro API routes in `src/pages/api/`:

```
src/pages/api/
├── auth/
│   ├── register.ts
│   ├── login.ts
│   ├── logout.ts
│   └── account.ts
├── generation-requests/
│   ├── index.ts
│   └── [id].ts
├── flashcards/
│   ├── index.ts
│   ├── [id].ts
│   ├── [id]/approve.ts
│   ├── [id]/reject.ts
│   └── batch-approve.ts
├── study-sessions/
│   ├── current.ts
│   └── review.ts
└── statistics/
    ├── overview.ts
    └── generation.ts
```

### 6.2. Supabase Client Usage

- **Server-side**: Use Supabase service role client for admin operations
- **Client-side**: Use Supabase anon key with RLS for user operations
- Authentication handled by `@supabase/ssr` for Astro

### 6.3. Middleware Implementation

Middleware (`src/middleware/index.ts`) handles:

1. CORS headers
2. JWT validation
3. User context injection
4. Rate limiting
5. Error handling standardization

### 6.4. TypeScript Types

Shared types defined in `src/types.ts`:

- Database types imported from `src/db/database.types.ts`
- API request/response DTOs
- Enum types matching database enums
- Union types for type safety (e.g., FlashcardQuality: 0 | 1 | 2 | 3 | 4 | 5)
- Type guards for runtime validation (isFlashcardStatus, isFlashcardSource, isValidQuality)

---

## 7. Testing Considerations

### 7.1. Test Coverage Areas

1. **Authentication**:
   - Registration with valid/invalid data
   - Login with correct/incorrect credentials
   - Token expiration and refresh
   - Account deletion

2. **Authorization**:
   - Access to own resources only
   - Rejection of access to other users' resources
   - RLS policy enforcement

3. **Business Logic**:
   - AI generation with various text lengths
   - Flashcard approval/rejection workflow
   - Spaced repetition algorithm calculations
   - Statistics accuracy

4. **Validation**:
   - Input validation for all endpoints
   - Error message consistency
   - Edge cases (empty strings, special characters, etc.)

5. **Performance**:
   - Large flashcard collections
   - Pagination functionality
   - Query optimization with indexes
   - Rate limiting enforcement

### 7.2. Mock Data Strategy

For development and testing:

- Mock AI responses for consistent testing
- Seed database with sample users and flashcards
- Test rate limiting without waiting
- Mock date/time for spaced repetition testing

---

This API plan provides a complete, production-ready specification for the 10x-cards application, addressing all requirements from the PRD while leveraging the full capabilities of the database schema and tech stack.
