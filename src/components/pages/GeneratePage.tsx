/**
 * Generate Page Component
 *
 * Complete page component for flashcard generation
 */

import { Providers } from "@/components/providers/Providers";
import { GenerationForm } from "@/components/generate/GenerationForm";
import { GenerationHistory } from "@/components/generate/GenerationHistory";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function GeneratePage() {
  return (
    <Providers>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Generation Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nowe generowanie</CardTitle>
              <CardDescription>
                Wklej tekst (1000-10000 znaków) z którego chcesz wygenerować fiszki
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GenerationForm />
            </CardContent>
          </Card>

          <GenerationHistory />
        </div>

        {/* Right Column - Generated Flashcards */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Wygenerowane fiszki</CardTitle>
              <CardDescription>
                Przejrzyj, edytuj i zatwierdź fiszki wygenerowane przez AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <p>Wygenerowane fiszki pojawią się tutaj.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Providers>
  );
}
