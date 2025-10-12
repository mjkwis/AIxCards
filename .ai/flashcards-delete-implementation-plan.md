# API Endpoint Implementation Plan: DELETE /api/flashcards/:id

## 1. Przegląd
**Endpoint:** `DELETE /api/flashcards/:id`  
**Cel:** Usunięcie fiszki

## 2. Request
```
DELETE /api/flashcards/{uuid}
Authorization: Bearer {access_token}
```

## 3. Response (204 No Content)
Empty body

## 4. Implementation

### Service
```typescript
async delete(userId: string, flashcardId: string): Promise<void> {
  const { error } = await this.supabase
    .from('flashcards')
    .delete()
    .eq('id', flashcardId)
    .eq('user_id', userId);
  
  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Flashcard not found');
    }
    throw new DatabaseError('Failed to delete flashcard', error);
  }
}
```

### Route Handler
```typescript
export async function DELETE(context: APIContext) {
  const user = context.locals.user;
  const flashcardId = context.params.id;
  
  if (!user) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  const service = new FlashcardService(context.locals.supabase);
  await service.delete(user.id, flashcardId);
  
  return new Response(null, { status: 204 });
}
```

## 5. Errors
- **404:** Flashcard not found or belongs to other user
- **401:** Not authenticated

**Status:** Ready for Implementation

