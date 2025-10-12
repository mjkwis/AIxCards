# API Endpoint Implementation Plan: POST /api/flashcards

## 1. Przegląd
**Endpoint:** `POST /api/flashcards`  
**Cel:** Ręczne utworzenie fiszki przez użytkownika (manual source)

## 2. Request
```json
POST /api/flashcards
Authorization: Bearer {access_token}

{
  "front": "Question text?",
  "back": "Answer text."
}
```

## 3. Types
```typescript
CreateFlashcardCommand {
  front: string;
  back: string;
}
```

### Validation (Zod)
```typescript
export const CreateFlashcardSchema = z.object({
  front: z.string().min(1).max(1000).trim(),
  back: z.string().min(1).max(2000).trim()
});
```

## 4. Response (201 Created)
```json
{
  "flashcard": {
    "id": "uuid",
    "user_id": "uuid",
    "generation_request_id": null,
    "front": "Question text?",
    "back": "Answer text.",
    "source": "manual",
    "status": "active",
    "next_review_at": "2025-10-12T10:00:00Z",
    "interval": 0,
    "ease_factor": 2.5,
    "created_at": "2025-10-12T10:00:00Z",
    "updated_at": "2025-10-12T10:00:00Z"
  }
}
```

## 5. Implementation

### Service
```typescript
async create(userId: string, command: CreateFlashcardCommand): Promise<FlashcardDTO> {
  const { data, error } = await this.supabase
    .from('flashcards')
    .insert({
      user_id: userId,
      generation_request_id: null,
      front: command.front,
      back: command.back,
      source: 'manual',
      status: 'active',
      next_review_at: new Date().toISOString(),
      interval: 0,
      ease_factor: 2.5
    })
    .select()
    .single();
  
  if (error || !data) {
    throw new DatabaseError('Failed to create flashcard', error);
  }
  
  return this.mapToDTO(data);
}
```

### Route Handler
```typescript
export async function POST(context: APIContext) {
  const user = context.locals.user;
  const supabase = context.locals.supabase;
  
  if (!user || !supabase) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  const body = await context.request.json();
  const validationResult = CreateFlashcardSchema.safeParse(body);
  
  if (!validationResult.success) {
    return errorResponse(400, 'VALIDATION_ERROR', validationResult.error.errors[0].message);
  }
  
  const service = new FlashcardService(supabase);
  const flashcard = await service.create(user.id, validationResult.data);
  
  return new Response(JSON.stringify({ flashcard }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 6. Key Points
- **source:** Always 'manual' for this endpoint
- **status:** Always 'active' (no review needed)
- **next_review_at:** Set to NOW (due immediately for first review)
- **interval:** 0 (first time)
- **ease_factor:** 2.5 (SM-2 default)
- **generation_request_id:** NULL (not from AI)

**Status:** Ready for Implementation

