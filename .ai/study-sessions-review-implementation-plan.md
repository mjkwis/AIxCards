# API Endpoint Implementation Plan: POST /api/study-sessions/review

## 1. Przegląd
**Endpoint:** `POST /api/study-sessions/review`  
**Cel:** Zapisanie wyniku powtórki i obliczenie następnej daty review (SM-2 algorithm)

## 2. Request
```json
POST /api/study-sessions/review
Authorization: Bearer {access_token}

{
  "flashcard_id": "uuid",
  "quality": 4
}
```

### Quality Scale (SM-2)
- **0:** Complete blackout
- **1:** Incorrect; correct one remembered
- **2:** Incorrect; correct one seemed easy
- **3:** Correct with serious difficulty
- **4:** Correct after hesitation
- **5:** Perfect response

### Validation (Zod)
```typescript
export const ReviewFlashcardSchema = z.object({
  flashcard_id: z.string().uuid(),
  quality: z.number().int().min(0).max(5)
});
```

## 3. Response (200 OK)
```json
{
  "flashcard": {
    "id": "uuid",
    "next_review_at": "2025-10-14T10:00:00Z",
    "interval": 3,
    "ease_factor": 2.6,
    "updated_at": "2025-10-12T10:00:00Z",
    ...
  }
}
```

## 4. Implementation

### SM-2 Algorithm
```typescript
function calculateNextReview(
  currentInterval: number,
  currentEaseFactor: number,
  quality: number
): { interval: number; easeFactor: number; nextReviewAt: Date } {
  let newInterval: number;
  let newEaseFactor = currentEaseFactor;
  
  if (quality < 3) {
    // Failed - reset
    newInterval = 0;
  } else {
    // Passed - calculate new interval
    if (currentInterval === 0) {
      newInterval = 1;
    } else if (currentInterval === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * currentEaseFactor);
    }
    
    // Update ease factor
    newEaseFactor = currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    newEaseFactor = Math.max(1.3, newEaseFactor);
  }
  
  const nextReviewAt = new Date();
  nextReviewAt.setDate(nextReviewAt.getDate() + newInterval);
  
  return {
    interval: newInterval,
    easeFactor: newEaseFactor,
    nextReviewAt
  };
}
```

### Service
```typescript
async review(userId: string, flashcardId: string, quality: number): Promise<FlashcardDTO> {
  // Get flashcard
  const flashcard = await this.flashcardService.getById(userId, flashcardId);
  
  // Calculate next review
  const { interval, easeFactor, nextReviewAt } = calculateNextReview(
    flashcard.interval || 0,
    flashcard.ease_factor || 2.5,
    quality
  );
  
  // Update flashcard
  const { data, error } = await this.supabase
    .from('flashcards')
    .update({
      interval,
      ease_factor: easeFactor,
      next_review_at: nextReviewAt.toISOString()
    })
    .eq('id', flashcardId)
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error || !data) {
    throw new DatabaseError('Failed to update flashcard', error);
  }
  
  return this.flashcardService.mapToDTO(data);
}
```

### Route Handler
```typescript
export async function POST(context: APIContext) {
  const user = context.locals.user;
  
  if (!user) {
    return errorResponse(401, 'AUTH_REQUIRED', 'Authentication required');
  }
  
  const body = await context.request.json();
  const validationResult = ReviewFlashcardSchema.safeParse(body);
  
  if (!validationResult.success) {
    return errorResponse(400, 'VALIDATION_ERROR', validationResult.error.errors[0].message);
  }
  
  const { flashcard_id, quality } = validationResult.data;
  
  const service = new StudySessionService(context.locals.supabase);
  const flashcard = await service.review(user.id, flashcard_id, quality);
  
  return new Response(JSON.stringify({ flashcard }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
```

## 5. SM-2 Examples

**First review (quality 4):**
- interval: 0 → 1 day
- ease_factor: 2.5 → 2.5
- next_review: tomorrow

**Second review (quality 4):**
- interval: 1 → 6 days
- ease_factor: 2.5 → 2.5
- next_review: in 6 days

**Third review (quality 5):**
- interval: 6 → 15 days (6 * 2.5)
- ease_factor: 2.5 → 2.6
- next_review: in 15 days

**Failed review (quality 2):**
- interval: any → 0 (reset)
- ease_factor: unchanged
- next_review: today

## 6. Key Points
- SM-2 algorithm implementation
- Quality 0-5 scale
- Failed reviews (< 3) reset interval
- Ease factor adjusts over time
- Next review date calculated automatically

**Status:** Ready for Implementation

