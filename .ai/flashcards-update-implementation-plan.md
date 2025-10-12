# API Endpoint Implementation Plan: PATCH /api/flashcards/:id

## 1. Przegląd
**Endpoint:** `PATCH /api/flashcards/:id`  
**Cel:** Aktualizacja fiszki (front, back, status)

## 2. Request
```json
PATCH /api/flashcards/{uuid}
Authorization: Bearer {access_token}

{
  "front": "Updated question?",
  "back": "Updated answer.",
  "status": "active"
}
```

### Validation (Zod)
```typescript
export const UpdateFlashcardSchema = z.object({
  front: z.string().min(1).max(1000).trim().optional(),
  back: z.string().min(1).max(2000).trim().optional(),
  status: z.enum(['active', 'pending_review', 'rejected']).optional()
}).refine(data => Object.keys(data).length > 0, {
  message: "At least one field must be provided"
});
```

## 3. Response (200 OK)
```json
{
  "flashcard": {
    "id": "uuid",
    "front": "Updated question?",
    "back": "Updated answer.",
    "status": "active",
    "updated_at": "2025-10-12T10:05:00Z",
    ...
  }
}
```

## 4. Implementation

### Service
```typescript
async update(userId: string, flashcardId: string, command: UpdateFlashcardCommand): Promise<FlashcardDTO> {
  // Verify ownership
  const existing = await this.getById(userId, flashcardId);
  
  const { data, error } = await this.supabase
    .from('flashcards')
    .update(command)
    .eq('id', flashcardId)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error || !data) {
    throw new DatabaseError('Failed to update flashcard', error);
  }
  
  return this.mapToDTO(data);
}
```

### Route Handler
```typescript
export async function PATCH(context: APIContext) {
  const user = context.locals.user;
  const flashcardId = context.params.id;
  
  if (!user) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  const body = await context.request.json();
  const validationResult = UpdateFlashcardSchema.safeParse(body);
  
  if (!validationResult.success) {
    return errorResponse(400, 'VALIDATION_ERROR', validationResult.error.errors[0].message);
  }
  
  const service = new FlashcardService(context.locals.supabase);
  const flashcard = await service.update(user.id, flashcardId, validationResult.data);
  
  return new Response(JSON.stringify({ flashcard }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 5. Use Cases
- Edytuj treść fiszki przed zaakceptowaniem
- Popraw błędy w fiszce
- Zmień status (reactivate rejected)

**Status:** Ready for Implementation

