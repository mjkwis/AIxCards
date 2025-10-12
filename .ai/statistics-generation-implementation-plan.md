# API Endpoint Implementation Plan: GET /api/statistics/generation

## 1. Przegląd

**Endpoint:** `GET /api/statistics/generation`  
**Cel:** Szczegółowe statystyki AI generation (metryki sukcesu AI)

## 2. Request

```
GET /api/statistics/generation
Authorization: Bearer {access_token}
```

## 3. Response (200 OK)

```json
{
  "statistics": {
    "total_generated": 100,
    "total_approved": 85,
    "total_rejected": 15,
    "approval_rate": 0.85,
    "average_flashcards_per_request": 10.5,
    "recent_requests": [
      {
        "date": "2025-10-12",
        "requests": 2,
        "flashcards_generated": 20,
        "flashcards_approved": 17
      },
      {
        "date": "2025-10-11",
        "requests": 1,
        "flashcards_generated": 10,
        "flashcards_approved": 8
      }
    ]
  }
}
```

## 4. Implementation

### Service

```typescript
async getGenerationStatistics(userId: string): Promise<GenerationStatistics> {
  // Count AI flashcards
  const totalGenerated = await this.countAIFlashcards(userId);
  const totalApproved = await this.countAIFlashcards(userId, 'active');
  const totalRejected = await this.countAIFlashcards(userId, 'rejected');

  // Calculate approval rate (excluding pending)
  const evaluated = totalApproved + totalRejected;
  const approvalRate = evaluated > 0 ? totalApproved / evaluated : 0;

  // Average flashcards per request
  const totalRequests = await this.countGenerationRequests(userId);
  const averagePerRequest = totalRequests > 0
    ? totalGenerated / totalRequests
    : 0;

  // Recent requests (last 30 days)
  const recentRequests = await this.getRecentRequestsHistory(userId, 30);

  return {
    total_generated: totalGenerated,
    total_approved: totalApproved,
    total_rejected: totalRejected,
    approval_rate: Math.round(approvalRate * 100) / 100,
    average_flashcards_per_request: Math.round(averagePerRequest * 10) / 10,
    recent_requests: recentRequests
  };
}

private async countAIFlashcards(
  userId: string,
  status?: string
): Promise<number> {
  let query = this.supabase
    .from('flashcards')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'ai_generated');

  if (status) query = query.eq('status', status);

  const { count } = await query;
  return count || 0;
}

private async getRecentRequestsHistory(
  userId: string,
  days: number
): Promise<RecentRequest[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get generation requests
  const { data: requests } = await this.supabase
    .from('generation_requests')
    .select(`
      id,
      created_at,
      flashcards (
        id,
        status
      )
    `)
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false });

  if (!requests) return [];

  // Group by date
  const grouped = new Map<string, RecentRequest>();

  for (const request of requests) {
    const date = request.created_at.split('T')[0]; // YYYY-MM-DD

    if (!grouped.has(date)) {
      grouped.set(date, {
        date,
        requests: 0,
        flashcards_generated: 0,
        flashcards_approved: 0
      });
    }

    const stat = grouped.get(date)!;
    stat.requests++;
    stat.flashcards_generated += request.flashcards?.length || 0;
    stat.flashcards_approved += request.flashcards?.filter(
      f => f.status === 'active'
    ).length || 0;
  }

  return Array.from(grouped.values())
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 30);
}
```

### Route Handler

```typescript
export async function GET(context: APIContext) {
  const user = context.locals.user;

  if (!user) {
    return errorResponse(401, "AUTH_REQUIRED", "Authentication required");
  }

  const service = new StatisticsService(context.locals.supabase);
  const statistics = await service.getGenerationStatistics(user.id);

  return new Response(JSON.stringify({ statistics }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300", // Cache 5 minutes
    },
  });
}
```

## 5. Metrics Explained

- **total_generated:** All AI flashcards ever generated
- **total_approved:** AI flashcards with status 'active'
- **total_rejected:** AI flashcards with status 'rejected'
- **approval_rate:** approved / (approved + rejected)
- **average_flashcards_per_request:** total / number of requests
- **recent_requests:** Daily breakdown for last 30 days

## 6. Use Cases

- Measure AI quality/usefulness
- Track user satisfaction with AI
- Identify trends over time
- Optimize AI prompts based on acceptance

**Status:** Ready for Implementation
