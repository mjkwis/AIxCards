# API Endpoint Implementation Plan: POST /api/flashcards/batch-approve

## 1. Przegląd

**Endpoint:** `POST /api/flashcards/batch-approve`  
**Cel:** Akceptacja wielu fiszek AI jednocześnie

## 2. Request

```json
POST /api/flashcards/batch-approve
Authorization: Bearer {access_token}

{
  "flashcard_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### Validation (Zod)

```typescript
export const BatchApproveSchema = z.object({
  flashcard_ids: z.array(z.string().uuid()).min(1).max(50),
});
```

## 3. Response (200 OK)

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

## 4. Implementation

### Service

```typescript
async batchApprove(userId: string, flashcardIds: string[]): Promise<BatchApproveResponse> {
  const approved: string[] = [];
  const failed: BatchApprovalFailure[] = [];

  for (const id of flashcardIds) {
    try {
      await this.approve(userId, id);
      approved.push(id);
    } catch (error) {
      failed.push({
        id,
        reason: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return { approved, failed };
}
```

### Route Handler

```typescript
export async function POST(context: APIContext) {
  const user = context.locals.user;

  if (!user) {
    return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  }

  const body = await context.request.json();
  const validationResult = BatchApproveSchema.safeParse(body);

  if (!validationResult.success) {
    return errorResponse(400, "VALIDATION_ERROR", validationResult.error.errors[0].message);
  }

  const service = new FlashcardService(context.locals.supabase);
  const result = await service.batchApprove(user.id, validationResult.data.flashcard_ids);

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

## 5. Key Points

- Max 50 flashcards per batch
- Partial success (some may fail)
- Returns both approved and failed lists
- Each approval is independent transaction
- Failed items don't stop processing

**Status:** Ready for Implementation
