# API Endpoint Implementation Plan: DELETE /api/generation-requests/:id

## 1. Przegląd
**Endpoint:** `DELETE /api/generation-requests/:id`  
**Cel:** Usunięcie generation request (flashcards powiązane mają ON DELETE SET NULL, więc pozostają)

## 2. Request
```
DELETE /api/generation-requests/{uuid}
Authorization: Bearer {access_token}
```

## 3. Response (204 No Content)
Empty body

## 4. Implementation

### Service
```typescript
async delete(userId: string, requestId: string): Promise<void> {
  const { error } = await this.supabase
    .from('generation_requests')
    .delete()
    .eq('id', requestId)
    .eq('user_id', userId);
  
  if (error) {
    if (error.code === 'PGRST116') {
      throw new NotFoundError('Generation request not found');
    }
    throw new DatabaseError('Failed to delete generation request', error);
  }
}
```

### Route Handler
```typescript
// src/pages/api/generation-requests/[id].ts
export async function DELETE(context: APIContext) {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  const requestId = context.params.id;
  
  if (!user || !supabase) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  try {
    const service = new GenerationRequestService(supabase);
    await service.delete(user.id, requestId);
    
    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return errorResponse(404, 'NOT_FOUND', error.message);
    }
    return errorResponse(500, 'INTERNAL_ERROR', 'Failed to delete generation request');
  }
}
```

## 5. CASCADE Behavior
**Important:** `flashcards.generation_request_id` has `ON DELETE SET NULL`
- Generation request deleted
- Flashcards remain but generation_request_id → NULL
- Flashcards nie są usuwane (user może chcieć je zatrzymać)

## 6. Errors
- **404:** Request not found or belongs to other user
- **401:** Not authenticated
- **500:** Database error

**Status:** Ready for Implementation

