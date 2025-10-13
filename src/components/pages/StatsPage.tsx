/**
 * Statistics Page Component
 *
 * Complete page component for statistics
 */

import { Providers } from "@/components/providers/Providers";
import { Statistics } from "@/components/stats/Statistics";

export function StatsPage() {
  return (
    <Providers>
      <Statistics />
    </Providers>
  );
}
