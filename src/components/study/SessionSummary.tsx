/**
 * Session Summary Component
 *
 * Displays summary after completing a study session
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SessionSummaryProps {
  totalReviewed: number;
  onFinish: () => void;
}

export function SessionSummary({ totalReviewed, onFinish }: SessionSummaryProps) {
  return (
    <div className="max-w-2xl mx-auto text-center space-y-6">
      <div className="mb-8">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-primary"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold mb-2">Świetna robota!</h2>
        <p className="text-muted-foreground">Ukończyłeś sesję nauki</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Podsumowanie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2 border-b">
            <span className="text-muted-foreground">Przejrzane fiszki:</span>
            <span className="text-2xl font-bold">{totalReviewed}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Następne fiszki do powtórki będą dostępne zgodnie z algorytmem SM-2. Powróć później, aby kontynuować naukę.
          </p>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Button onClick={onFinish}>Zakończ sesję</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/dashboard/stats")}>
          Zobacz statystyki
        </Button>
      </div>
    </div>
  );
}
