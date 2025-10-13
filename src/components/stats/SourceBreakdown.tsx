/**
 * Source Breakdown Component
 *
 * Displays breakdown of flashcards by source (AI vs Manual)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { StatisticsOverview } from "@/types";

interface SourceBreakdownProps {
  statistics: StatisticsOverview;
}

export function SourceBreakdown({ statistics }: SourceBreakdownProps) {
  const total = statistics.total_flashcards;
  const aiPercentage = total > 0 ? (statistics.ai_generated_flashcards / total) * 100 : 0;
  const manualPercentage = total > 0 ? (statistics.manual_flashcards / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Źródło fiszek</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* AI Generated */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Wygenerowane AI</span>
            <span className="text-muted-foreground">
              {statistics.ai_generated_flashcards} ({Math.round(aiPercentage)}%)
            </span>
          </div>
          <Progress value={aiPercentage} className="h-2" />
        </div>

        {/* Manual */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Utworzone ręcznie</span>
            <span className="text-muted-foreground">
              {statistics.manual_flashcards} ({Math.round(manualPercentage)}%)
            </span>
          </div>
          <Progress value={manualPercentage} className="h-2" />
        </div>

        {/* Total */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Razem</span>
            <span>{total}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
