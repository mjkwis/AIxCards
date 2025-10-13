/**
 * Flashcards Page Component
 *
 * Complete page component for flashcards management
 */

import { Providers } from "@/components/providers/Providers";
import { FlashcardList } from "@/components/flashcards/FlashcardList";

export function FlashcardsPage() {
  return (
    <Providers>
      <FlashcardList />
    </Providers>
  );
}
