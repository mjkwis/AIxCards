/**
 * Progress Bar Component
 * 
 * Displays progress through the study session
 */

import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Postęp sesji</span>
        <span className="text-muted-foreground">
          {current} / {total}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}

