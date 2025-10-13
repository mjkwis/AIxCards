/**
 * Study Page Component
 *
 * Complete page component for study sessions
 */

import { Providers } from "@/components/providers/Providers";
import { StudySession } from "@/components/study/StudySession";

export function StudyPage() {
  return (
    <Providers>
      <StudySession />
    </Providers>
  );
}
