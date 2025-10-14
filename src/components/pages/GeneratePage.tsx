/**
 * Generate Page Component
 *
 * Complete page component for flashcard generation
 */

import { useState } from "react";
import { Providers } from "@/components/providers/Providers";
import { GenerationForm } from "@/components/generate/GenerationForm";
import { GenerationHistory } from "@/components/generate/GenerationHistory";
import { GeneratedFlashcardList } from "@/components/generate/GeneratedFlashcardList";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CreateGenerationRequestResponse, FlashcardDTO } from "@/types";

export function GeneratePage() {
  const [generatedFlashcards, setGeneratedFlashcards] = useState<FlashcardDTO[]>([]);

  const handleGenerationSuccess = (data: CreateGenerationRequestResponse) => {
    // Filter only pending flashcards for review
    const pendingFlashcards = data.flashcards.filter((f) => f.status === "pending_review");
    setGeneratedFlashcards(pendingFlashcards);
  };

  return (
    <Providers>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Generation Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nowe generowanie</CardTitle>
              <CardDescription>Wklej tekst (1000-10000 znaków) z którego chcesz wygenerować fiszki</CardDescription>
            </CardHeader>
            <CardContent>
              <GenerationForm onSuccess={handleGenerationSuccess} />
            </CardContent>
          </Card>

          <GenerationHistory />
        </div>

        {/* Right Column - Generated Flashcards */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Wygenerowane fiszki</CardTitle>
              <CardDescription>Przejrzyj, edytuj i zatwierdź fiszki wygenerowane przez AI</CardDescription>
            </CardHeader>
            <CardContent>
              {generatedFlashcards.length > 0 ? (
                <GeneratedFlashcardList flashcards={generatedFlashcards} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Wygenerowane fiszki pojawią się tutaj.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Providers>
  );
}
