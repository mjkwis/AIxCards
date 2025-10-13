/**
 * Recent Activity Component
 * 
 * Displays recent generation activity timeline
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { GenerationStatistics } from '@/types';

interface RecentActivityProps {
  statistics: GenerationStatistics;
}

export function RecentActivity({ statistics }: RecentActivityProps) {
  const requests = statistics.recent_requests.slice(0, 7); // Last 7 days

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Ostatnia aktywność</CardTitle>
          <CardDescription>Generowanie fiszek w ostatnich dniach</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Brak aktywności w ostatnich dniach
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxFlashcards = Math.max(...requests.map(r => r.flashcards_generated), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ostatnia aktywność</CardTitle>
        <CardDescription>Generowanie fiszek w ostatnich dniach</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {requests.map((request, index) => {
            const date = new Date(request.date);
            const barHeight = (request.flashcards_generated / maxFlashcards) * 100;
            
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">
                    {date.toLocaleDateString('pl-PL', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span>{request.requests} request{request.requests !== 1 ? 'y' : ''}</span>
                    <span>{request.flashcards_generated} fiszek</span>
                    <span className="text-green-600">{request.flashcards_approved} ✓</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${barHeight}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

