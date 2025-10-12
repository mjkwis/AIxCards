# API Endpoint Implementation Plan: GET /api/generation-requests

## 1. Przegląd punktu końcowego

**Endpoint:** `GET /api/generation-requests`

**Cel:** Pobranie listy wszystkich generation requests dla zalogowanego użytkownika z paginacją i sortowaniem. Endpoint zwraca uproszczone dane generation requests wraz z licznikiem wygenerowanych fiszek.

**Funkcjonalność:**

- Paginacja (page, limit)
- Sortowanie (sort, order)
- Licznik flashcards per request
- Filtrowanie per user (automatic via RLS)
- Query parameters validation

---

## 2. Szczegóły żądania

### HTTP Method

`GET`

### URL Structure

```
/api/generation-requests?page=1&limit=20&sort=created_at&order=desc
```

### Headers (Required)

```http
Authorization: Bearer {access_token}
```

### Query Parameters

| Parameter | Type   | Required | Default    | Validation             | Description    |
| --------- | ------ | -------- | ---------- | ---------------------- | -------------- |
| `page`    | number | No       | 1          | >= 1                   | Page number    |
| `limit`   | number | No       | 20         | 1-100                  | Items per page |
| `sort`    | string | No       | created_at | created_at, updated_at | Sort field     |
| `order`   | string | No       | desc       | asc, desc              | Sort order     |

---

## 3. Wykorzystywane typy

```typescript
// From src/types.ts
GenerationRequestListQuery {
  page?: number;
  limit?: number;
  sort?: 'created_at' | 'updated_at';
  order?: 'asc' | 'desc';
}

GenerationRequestListItem {
  id: string;
  user_id: string;
  source_text: string;
  flashcard_count: number;
  created_at: string;
  updated_at: string;
}

GenerationRequestListResponse {
  generation_requests: GenerationRequestListItem[];
  pagination: Pagination;
}

Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}
```

### Zod Schema

```typescript
// src/lib/validation/generation-requests.ts
export const GenerationRequestListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["created_at", "updated_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
});
```

---

## 4. Szczegóły odpowiedzi

### Success Response (200 OK)

```json
{
  "generation_requests": [
    {
      "id": "uuid-1",
      "user_id": "user-uuid",
      "source_text": "Lorem ipsum dolor sit amet...",
      "flashcard_count": 15,
      "created_at": "2025-10-12T10:00:00Z",
      "updated_at": "2025-10-12T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "total_pages": 3
  }
}
```

### Error Responses

#### 400 Bad Request

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameter: limit must be between 1 and 100",
    "details": {
      "field": "limit"
    }
  }
}
```

#### 401 Unauthorized

```json
{
  "error": {
    "code": "AUTH_REQUIRED",
    "message": "Authentication required"
  }
}
```

---

## 5. Przepływ danych

### Diagram

```
Client Request
      ↓
[1] Middleware: Verify JWT
      ↓
[2] Route Handler
      ├─→ Parse query params
      ├─→ Validate with Zod
      └─→ Call GenerationRequestService.list()
      ↓
[3] Service
      ├─→ Count total (for pagination)
      ├─→ Query with JOIN to count flashcards
      ├─→ Apply pagination & sorting
      └─→ Map to DTOs
      ↓
[4] Return 200 + JSON
```

### SQL Query (Conceptual)

```sql
-- Count total
SELECT COUNT(*)
FROM generation_requests
WHERE user_id = $user_id;

-- Get page with flashcard counts
SELECT
  gr.*,
  COUNT(f.id) as flashcard_count
FROM generation_requests gr
LEFT JOIN flashcards f ON f.generation_request_id = gr.id
WHERE gr.user_id = $user_id
GROUP BY gr.id
ORDER BY gr.${sort} ${order}
LIMIT $limit OFFSET $offset;
```

---

## 6. Implementacja

### Service Method

**Plik:** `src/lib/services/generation-request.service.ts`

```typescript
export class GenerationRequestService {
  async list(userId: string, query: GenerationRequestListQuery): Promise<GenerationRequestListResponse> {
    const { page = 1, limit = 20, sort = "created_at", order = "desc" } = query;
    const offset = (page - 1) * limit;

    // Count total
    const { count, error: countError } = await this.supabase
      .from("generation_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) {
      throw new DatabaseError("Failed to count generation requests", countError);
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    // Get page with flashcard counts
    const { data, error } = await this.supabase
      .from("generation_requests")
      .select(
        `
        *,
        flashcards(count)
      `
      )
      .eq("user_id", userId)
      .order(sort, { ascending: order === "asc" })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new DatabaseError("Failed to fetch generation requests", error);
    }

    // Map to list items
    const generationRequests = (data || []).map((item) => ({
      ...this.mapToDTO(item),
      flashcard_count: item.flashcards?.[0]?.count || 0,
    }));

    return {
      generation_requests: generationRequests,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    };
  }
}
```

### Route Handler

**Plik:** `src/pages/api/generation-requests/index.ts`

```typescript
import type { APIContext } from "astro";
import { GenerationRequestListQuerySchema } from "../../../lib/validation/generation-requests";
import { errorResponse } from "../../../lib/helpers/error-response";
import { GenerationRequestService } from "../../../lib/services/generation-request.service";
import { Logger } from "../../../lib/services/logger.service";

const logger = new Logger("GET /api/generation-requests");

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  try {
    const user = context.locals.user;
    const supabase = context.locals.supabase;

    if (!user || !supabase) {
      return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
    }

    // Parse & validate query params
    const url = new URL(context.request.url);
    const queryParams = {
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
      sort: url.searchParams.get("sort"),
      order: url.searchParams.get("order"),
    };

    const validationResult = GenerationRequestListQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return errorResponse(400, "VALIDATION_ERROR", firstError.message, {
        field: firstError.path.join("."),
      });
    }

    // Fetch list
    const service = new GenerationRequestService(supabase);
    const result = await service.list(user.id, validationResult.data);

    logger.info("Generation requests list fetched", {
      userId: user.id,
      count: result.generation_requests.length,
      page: result.pagination.page,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    logger.error("Error fetching generation requests list", error as Error, {
      userId: context.locals.user?.id,
    });

    return errorResponse(500, "INTERNAL_ERROR", "Failed to fetch generation requests");
  }
}
```

---

## 7. Testing

```typescript
describe("GET /api/generation-requests", () => {
  it("should return paginated list", async () => {
    const token = await getAuthToken();

    const response = await fetch("/api/generation-requests?page=1&limit=10", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.generation_requests).toBeInstanceOf(Array);
    expect(data.pagination).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(10);
  });

  it("should validate query parameters", async () => {
    const token = await getAuthToken();

    const response = await fetch("/api/generation-requests?limit=200", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(400);
  });

  it("should apply sorting", async () => {
    const token = await getAuthToken();

    const response = await fetch("/api/generation-requests?sort=created_at&order=asc", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    // Verify ascending order
    const dates = data.generation_requests.map((gr) => new Date(gr.created_at));
    expect(dates).toEqual([...dates].sort((a, b) => a - b));
  });
});
```

---

## 8. Checklist

- [ ] Zod schema for query validation
- [ ] Service method with pagination
- [ ] JOIN query for flashcard counts
- [ ] Route handler implemented
- [ ] Tests passing
- [ ] RLS enforced (user can only see own requests)

**Autor:** AI Architecture Team  
**Data:** 2025-10-12  
**Wersja:** 1.0  
**Status:** Ready for Implementation
