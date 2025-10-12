# API Endpoint Implementation Plan: GET /api/flashcards/:id

## 1. Przegląd

**Endpoint:** `GET /api/flashcards/:id`  
**Cel:** Szczegóły konkretnej fiszki

## 2. Request

```
GET /api/flashcards/{uuid}
Authorization: Bearer {access_token}
```

## 3. Response (200 OK)

```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": "uuid",
    "front": "Question?",
    "back": "Answer.",
    "source": "ai_generated",
    "status": "active",
    "next_review_at": "2025-10-13T10:00:00Z",
    "interval": 1,
    "ease_factor": 2.6,
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T10:00:00Z"
  }
}
```

## 4. Implementation

### Service

```typescript
async getById(userId: string, flashcardId: string): Promise<FlashcardDTO> {
  const { data, error } = await this.supabase
    .from('flashcards')
    .select('*')
    .eq('id', flashcardId)
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    if (error?.code === 'PGRST116') {
      throw new NotFoundError('Flashcard not found');
    }
    throw new DatabaseError('Failed to fetch flashcard', error);
  }

  return this.mapToDTO(data);
}
```

### Route Handler

```typescript
export async function GET(context: APIContext) {
  const user = context.locals.user;
  const flashcardId = context.params.id;

  if (!user) {
    return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  }

  const service = new FlashcardService(context.locals.supabase);
  const flashcard = await service.getById(user.id, flashcardId);

  return new Response(JSON.stringify({ flashcard }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

## 5. Errors

- **404:** Flashcard not found or belongs to other user
- **401:** Not authenticated

**Status:** Ready for Implementation
