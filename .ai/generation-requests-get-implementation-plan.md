# API Endpoint Implementation Plan: GET /api/generation-requests/:id

## 1. Przegląd
**Endpoint:** `GET /api/generation-requests/:id`  
**Cel:** Pobranie szczegółów konkretnego generation request wraz z listą wygenerowanych fiszek

## 2. Request
```
GET /api/generation-requests/{uuid}
Authorization: Bearer {access_token}
```

## 3. Response (200 OK)
```json
{
  "generation_request": {
    "id": "uuid",
    "user_id": "uuid",
    "source_text": "...",
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T10:00:00Z"
  },
  "flashcards": [
    {
      "id": "uuid",
      "front": "Question",
      "back": "Answer",
      "status": "pending_review",
      "source": "ai_generated",
      ...
    }
  ]
}
```

## 4. Implementation

### Service
```typescript
async getById(userId: string, requestId: string): Promise<GenerationRequestDetailResponse> {
  const { data: request, error: reqError } = await this.supabase
    .from('generation_requests')
    .select('*')
    .eq('id', requestId)
    .eq('user_id', userId)
    .single();
  
  if (reqError || !request) {
    if (reqError?.code === 'PGRST116') {
      throw new NotFoundError('Generation request not found');
    }
    throw new DatabaseError('Failed to fetch generation request', reqError);
  }
  
  const { data: flashcards, error: fcError } = await this.supabase
    .from('flashcards')
    .select('*')
    .eq('generation_request_id', requestId)
    .order('created_at', { ascending: true });
  
  if (fcError) {
    throw new DatabaseError('Failed to fetch flashcards', fcError);
  }
  
  return {
    generation_request: this.mapToDTO(request),
    flashcards: (flashcards || []).map(this.mapFlashcardToDTO)
  };
}
```

### Route Handler
```typescript
// src/pages/api/generation-requests/[id].ts
export async function GET(context: APIContext) {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  const requestId = context.params.id;
  
  if (!user || !supabase) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  if (!requestId) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Request ID is required');
  }
  
  try {
    const service = new GenerationRequestService(supabase);
    const result = await service.getById(user.id, requestId);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse(404, 'NOT_FOUND', error.message);
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to fetch generation request');
  }
}
```

## 5. Error Responses
- **404 Not Found:** Request nie istnieje lub belongs to innego usera
- **401 Unauthorized:** Brak autentykacji
- **500 Internal Error:** Database error

## 6. Security
- RLS enforces user_id check
- UUID validation prevents injection
- Authorization required

**Status:** Ready for Implementation

