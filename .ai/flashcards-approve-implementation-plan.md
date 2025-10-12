# API Endpoint Implementation Plan: POST /api/flashcards/:id/approve

## 1. Przegląd

**Endpoint:** `POST /api/flashcards/:id/approve`  
**Cel:** Akceptacja fiszki AI (pending_review → active)

## 2. Request

```
POST /api/flashcards/{uuid}/approve
Authorization: Bearer {access_token}
```

No body required

## 3. Response (200 OK)

```json
{
  "flashcard": {
    "id": "uuid",
    "status": "active",
    "next_review_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T10:05:00Z",
    ...
  }
}
```

## 4. Implementation

### Service

```typescript
async approve(userId: string, flashcardId: string): Promise<FlashcardDTO> {
  // Get flashcard
  const flashcard = await this.getById(userId, flashcardId);

  // Verify can be approved
  if (flashcard.status !== 'pending_review') {
    throw new ValidationError('Flashcard must be in pending_review status to approve');
  }

  // Update to active
  const { data, error } = await this.supabase
    .from('flashcards')
    .update({
      status: 'active',
      next_review_at: new Date().toISOString(),
      interval: 0
    })
    .eq('id', flashcardId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new DatabaseError('Failed to approve flashcard', error);
  }

  return this.mapToDTO(data);
}
```

### Route Handler

```typescript
export async function POST(context: APIContext) {
  const user = context.locals.user;
  const flashcardId = context.params.id;

  if (!user) {
    return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  }

  try {
    const service = new FlashcardService(context.locals.supabase);
    const flashcard = await service.approve(user.id, flashcardId);

    return new Response(JSON.stringify({ flashcard }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }
    throw error;
  }
}
```

## 5. Business Logic

- Only `pending_review` → `active`
- Sets `next_review_at` to NOW (due immediately)
- Resets `interval` to 0 (first review)
- Updates `updated_at`

**Status:** Ready for Implementation
