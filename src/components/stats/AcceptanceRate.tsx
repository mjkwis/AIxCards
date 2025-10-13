/**
 * Acceptance Rate Component
 * 
 * Displays AI flashcard acceptance rate with breakdown
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { GenerationStatistics } from '@/types';

interface AcceptanceRateProps {
  statistics: GenerationStatistics;
}

export function AcceptanceRate({ statistics }: AcceptanceRateProps) {
  const approvalPercentage = Math.round(statistics.approval_rate * 100);
  const rejectionPercentage = statistics.total_generated > 0
    ? Math.round((statistics.total_rejected / statistics.total_generated) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Akceptacja AI</CardTitle>
        <CardDescription>
          Jak często zatwierdzasz fiszki wygenerowane przez AI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Circular Progress */}
        <div className="flex items-center justify-center">
          <div className="relative w-40 h-40">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                className="text-muted-foreground/20"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="12"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - statistics.approval_rate)}`}
                className="text-primary transition-all duration-500"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold">{approvalPercentage}%</div>
                <div className="text-xs text-muted-foreground">zatwierdzonych</div>
              </div>
            </div>
          </div>
        </div>

        {/* Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-600">Zatwierdzone</span>
            <span className="font-medium">{statistics.total_approved}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-red-600">Odrzucone</span>
            <span className="font-medium">{statistics.total_rejected}</span>
          </div>
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Łącznie wygenerowanych</span>
              <span>{statistics.total_generated}</span>
            </div>
          </div>
        </div>

        {/* Average per request */}
        {statistics.average_flashcards_per_request > 0 && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">
              Średnio {statistics.average_flashcards_per_request.toFixed(1)} fiszek na request
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

