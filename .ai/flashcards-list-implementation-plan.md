# API Endpoint Implementation Plan: GET /api/flashcards

## 1. Przegląd
**Endpoint:** `GET /api/flashcards`  
**Cel:** Lista fiszek użytkownika z paginacją, filtrowaniem i sortowaniem

## 2. Request
```
GET /api/flashcards?page=1&limit=20&status=active&source=manual&sort=created_at&order=desc
Authorization: Bearer {access_token}
```

### Query Parameters
| Param | Type | Default | Validation |
|-------|------|---------|------------|
| page | number | 1 | >= 1 |
| limit | number | 20 | 1-100 |
| status | string | - | active, pending_review, rejected |
| source | string | - | manual, ai_generated |
| sort | string | created_at | created_at, updated_at, next_review_at |
| order | string | desc | asc, desc |

### Validation (Zod)
```typescript
export const FlashcardsListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'pending_review', 'rejected']).optional(),
  source: z.enum(['manual', 'ai_generated']).optional(),
  sort: z.enum(['created_at', 'updated_at', 'next_review_at']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc')
});
```

## 3. Response (200 OK)
```json
{
  "flashcards": [
    {
      "id": "uuid",
      "front": "Question?",
      "back": "Answer.",
      "source": "manual",
      "status": "active",
      ...
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

## 4. Implementation

### Service
```typescript
async list(userId: string, query: FlashcardsListQuery): Promise<FlashcardsListResponse> {
  const { page = 1, limit = 20, status, source, sort = 'created_at', order = 'desc' } = query;
  const offset = (page - 1) * limit;
  
  // Build query
  let queryBuilder = this.supabase
    .from('flashcards')
    .select('*', { count: 'exact' })
    .eq('user_id', userId);
  
  if (status) queryBuilder = queryBuilder.eq('status', status);
  if (source) queryBuilder = queryBuilder.eq('source', source);
  
  // Count total
  const { count } = await queryBuilder;
  const total = count || 0;
  
  // Get page
  const { data, error } = await queryBuilder
    .order(sort, { ascending: order === 'asc' })
    .range(offset, offset + limit - 1);
  
  if (error) {
    throw new DatabaseError('Failed to fetch flashcards', error);
  }
  
  return {
    flashcards: (data || []).map(this.mapToDTO),
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  };
}
```

## 5. Use Cases
- **My Flashcards:** `?status=active`
- **Pending Review:** `?status=pending_review`
- **Manual Only:** `?source=manual`
- **AI Generated:** `?source=ai_generated`
- **Due for Review:** `?status=active&sort=next_review_at&order=asc`

**Status:** Ready for Implementation

