/**
 * Study Card Component
 *
 * Flashcard with flip animation for study sessions
 */

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { FlashcardDTO } from "@/types";

interface StudyCardProps {
  flashcard: FlashcardDTO;
  onRate: (quality: number) => void;
}

export function StudyCard({ flashcard, onRate }: StudyCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleFlip();
    }
  };

  return (
    <div className="space-y-6">
      {/* Flashcard */}
      <div
        className="perspective-1000 cursor-pointer"
        onClick={handleFlip}
        onKeyDown={handleKeyPress}
        tabIndex={0}
        role="button"
        aria-label={isFlipped ? "Kliknij aby zobaczyć pytanie" : "Kliknij aby zobaczyć odpowiedź"}
      >
        <div
          className={`relative w-full min-h-[400px] transition-transform duration-600 preserve-3d ${
            isFlipped ? "rotate-y-180" : ""
          }`}
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <Card
            className="absolute inset-0 backface-hidden flex items-center justify-center p-8"
            style={{ backfaceVisibility: "hidden" }}
          >
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">Pytanie:</p>
              <p className="text-2xl font-medium">{flashcard.front}</p>
              <p className="text-sm text-muted-foreground mt-8">Kliknij aby zobaczyć odpowiedź</p>
            </CardContent>
          </Card>

          {/* Back */}
          <Card
            className="absolute inset-0 backface-hidden flex items-center justify-center p-8"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Pytanie:</p>
              <p className="text-lg mb-6">{flashcard.front}</p>
              <p className="text-sm text-muted-foreground mb-2">Odpowiedź:</p>
              <p className="text-xl font-medium text-primary">{flashcard.back}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Rating Buttons (only visible when flipped) */}
      {isFlipped && (
        <div className="space-y-4" role="group" aria-label="Oceń swoją odpowiedź">
          <p className="text-sm text-center text-muted-foreground">Jak dobrze znałeś odpowiedź?</p>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Button variant="outline" size="lg" onClick={() => onRate(0)} className="flex flex-col gap-1 h-auto py-4">
              <span className="text-2xl">0</span>
              <span className="text-xs">Blackout</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => onRate(1)} className="flex flex-col gap-1 h-auto py-4">
              <span className="text-2xl">1</span>
              <span className="text-xs">Źle</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => onRate(2)} className="flex flex-col gap-1 h-auto py-4">
              <span className="text-2xl">2</span>
              <span className="text-xs">Trudno</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => onRate(3)} className="flex flex-col gap-1 h-auto py-4">
              <span className="text-2xl">3</span>
              <span className="text-xs">Dobrze</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => onRate(4)} className="flex flex-col gap-1 h-auto py-4">
              <span className="text-2xl">4</span>
              <span className="text-xs">Łatwo</span>
            </Button>
            <Button variant="outline" size="lg" onClick={() => onRate(5)} className="flex flex-col gap-1 h-auto py-4">
              <span className="text-2xl">5</span>
              <span className="text-xs">Perfekcyjnie</span>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">Lub użyj klawiszy 0-5 na klawiaturze</p>
        </div>
      )}

      {/* Flip prompt when not flipped */}
      {!isFlipped && (
        <div className="text-center">
          <Button onClick={handleFlip} size="lg">
            Pokaż odpowiedź
          </Button>
          <p className="text-xs text-muted-foreground mt-2">Lub naciśnij spację</p>
        </div>
      )}
    </div>
  );
}
