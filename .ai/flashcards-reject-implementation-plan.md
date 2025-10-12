# API Endpoint Implementation Plan: POST /api/flashcards/:id/reject

## 1. Przegląd

**Endpoint:** `POST /api/flashcards/:id/reject`  
**Cel:** Odrzucenie fiszki AI (pending_review → rejected)

## 2. Request

```
POST /api/flashcards/{uuid}/reject
Authorization: Bearer {access_token}
```

No body required

## 3. Response (200 OK)

```json
{
  "flashcard": {
    "id": "uuid",
    "status": "rejected",
    "next_review_at": null,
    "updated_at": "2025-10-12T10:05:00Z",
    ...
  }
}
```

## 4. Implementation

### Service

```typescript
async reject(userId: string, flashcardId: string): Promise<FlashcardDTO> {
  const flashcard = await this.getById(userId, flashcardId);

  if (flashcard.status !== 'pending_review') {
    throw new ValidationError('Flashcard must be in pending_review status to reject');
  }

  const { data, error } = await this.supabase
    .from('flashcards')
    .update({
      status: 'rejected',
      next_review_at: null
    })
    .eq('id', flashcardId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    throw new DatabaseError('Failed to reject flashcard', error);
  }

  return this.mapToDTO(data);
}
```

## 5. Business Logic

- Only `pending_review` → `rejected`
- Sets `next_review_at` to NULL (not scheduled)
- Keeps flashcard in DB (for statistics)
- Can be reactivated later via PATCH endpoint

**Status:** Ready for Implementation
