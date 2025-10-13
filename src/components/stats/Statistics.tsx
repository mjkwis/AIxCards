/**
 * Statistics Component
 * 
 * Main statistics dashboard component
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { OverviewStats } from './OverviewStats';
import { SourceBreakdown } from './SourceBreakdown';
import { AcceptanceRate } from './AcceptanceRate';
import { RecentActivity } from './RecentActivity';
import type { StatisticsOverviewResponse, GenerationStatisticsResponse } from '@/types';

export function Statistics() {
  const { data: overviewData, isLoading: isLoadingOverview } = useQuery({
    queryKey: ['statistics', 'overview'],
    queryFn: async () => {
      const response = await apiClient.get<StatisticsOverviewResponse>('/statistics/overview');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: generationData, isLoading: isLoadingGeneration } = useQuery({
    queryKey: ['statistics', 'generation'],
    queryFn: async () => {
      const response = await apiClient.get<GenerationStatisticsResponse>('/statistics/generation');
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const isLoading = isLoadingOverview || isLoadingGeneration;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!overviewData || !generationData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">
          Nie udało się załadować statystyk
        </p>
        <Button onClick={() => window.location.reload()}>
          Odśwież stronę
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Statystyki</h1>
          <p className="text-muted-foreground">
            Przegląd Twojej aktywności i postępów w nauce
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => window.location.href = '/dashboard/study'}
            disabled={overviewData.statistics.flashcards_due_today === 0}
          >
            {overviewData.statistics.flashcards_due_today > 0
              ? `Rozpocznij sesję (${overviewData.statistics.flashcards_due_today})`
              : 'Brak fiszek do powtórki'}
          </Button>
          <Button onClick={() => window.location.href = '/dashboard/generate'}>
            Generuj fiszki
          </Button>
        </div>
      </div>

      {/* Overview Stats */}
      <OverviewStats statistics={overviewData.statistics} />

      {/* Charts and Details */}
      <div className="grid gap-6 md:grid-cols-2">
        <SourceBreakdown statistics={overviewData.statistics} />
        <AcceptanceRate statistics={generationData.statistics} />
      </div>

      {/* Recent Activity */}
      <RecentActivity statistics={generationData.statistics} />
    </div>
  );
}

