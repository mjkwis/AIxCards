/**
 * Study Session Component
 * 
 * Main component for managing study sessions
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/components/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { StudyCard } from './StudyCard';
import { ProgressBar } from './ProgressBar';
import { SessionSummary } from './SessionSummary';
import { Skeleton } from '@/components/ui/skeleton';
import type { StudySessionResponse, FlashcardDTO } from '@/types';

export function StudySession() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [sessionFinished, setSessionFinished] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['study-session'],
    queryFn: async () => {
      const response = await apiClient.get<StudySessionResponse>('/study-sessions/current');
      return response.data;
    },
    refetchOnWindowFocus: false,
    staleTime: Infinity, // Don't refetch during session
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ flashcard_id, quality }: { flashcard_id: string; quality: number }) => {
      const response = await apiClient.post('/study-sessions/review', {
        flashcard_id,
        quality,
      });
      return response.data;
    },
    onSuccess: () => {
      setReviewedCount(prev => prev + 1);
      
      // Move to next card or finish session
      if (data && currentIndex < data.flashcards.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setSessionFinished(true);
        queryClient.invalidateQueries({ queryKey: ['statistics'] });
        queryClient.invalidateQueries({ queryKey: ['flashcards'] });
      }
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Błąd',
        description: 'Nie udało się zapisać oceny. Spróbuj ponownie.',
      });
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (reviewMutation.isPending || !data?.flashcards[currentIndex]) return;

      const key = e.key;
      if (['0', '1', '2', '3', '4', '5'].includes(key)) {
        const quality = parseInt(key);
        handleRate(quality);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, data, reviewMutation.isPending]);

  const handleRate = (quality: number) => {
    const flashcard = data?.flashcards[currentIndex];
    if (!flashcard) return;

    reviewMutation.mutate({ flashcard_id: flashcard.id, quality });
  };

  const handleFinish = () => {
    window.location.href = '/dashboard/flashcards';
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-2 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-muted-foreground"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Błąd ładowania sesji</h2>
        <p className="text-muted-foreground mb-6">
          Nie udało się załadować sesji nauki. Spróbuj ponownie.
        </p>
        <Button onClick={() => window.location.reload()}>
          Odśwież stronę
        </Button>
      </div>
    );
  }

  if (data.flashcards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mx-auto text-muted-foreground"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2">Brak fiszek do powtórki</h2>
        <p className="text-muted-foreground mb-6">
          Świetnie! Nie masz żadnych fiszek zaplanowanych na dziś.
          Wróć później lub dodaj nowe fiszki.
        </p>
        <div className="flex gap-4 justify-center">
          <Button onClick={() => window.location.href = '/dashboard/generate'}>
            Generuj fiszki
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.href = '/dashboard/flashcards'}
          >
            Moje fiszki
          </Button>
        </div>
      </div>
    );
  }

  if (sessionFinished) {
    return <SessionSummary totalReviewed={reviewedCount} onFinish={handleFinish} />;
  }

  const currentFlashcard = data.flashcards[currentIndex];
  const totalFlashcards = data.session.flashcards_due;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sesja nauki</h1>
        <p className="text-sm text-muted-foreground">
          {totalFlashcards} {totalFlashcards === 1 ? 'fiszka' : 'fiszek'} do powtórki
        </p>
      </div>

      {/* Progress */}
      <ProgressBar current={currentIndex + 1} total={data.flashcards.length} />

      {/* Study Card */}
      <StudyCard flashcard={currentFlashcard} onRate={handleRate} />

      {/* Skip Button */}
      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (currentIndex < data.flashcards.length - 1) {
              setCurrentIndex(prev => prev + 1);
            } else {
              setSessionFinished(true);
            }
          }}
          disabled={reviewMutation.isPending}
        >
          Pomiń tę fiszkę
        </Button>
      </div>
    </div>
  );
}

