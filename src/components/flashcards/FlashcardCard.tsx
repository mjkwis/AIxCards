/**
 * Flashcard Card Component
 *
 * Individual flashcard display with actions
 */

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/hooks/use-toast";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FlashcardEditor } from "@/components/generate/FlashcardEditor";
import type { FlashcardDTO } from "@/types";

interface FlashcardCardProps {
  flashcard: FlashcardDTO;
}

export function FlashcardCard({ flashcard }: FlashcardCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/flashcards/${flashcard.id}`);
    },
    onSuccess: () => {
      toast({
        title: "Usunięto",
        description: "Fiszka została usunięta.",
      });
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Nie udało się usunąć fiszki.",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/flashcards/${flashcard.id}/approve`);
    },
    onSuccess: () => {
      toast({
        title: "Zatwierdzono",
        description: "Fiszka została zatwierdzona.",
      });
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(`/flashcards/${flashcard.id}/reject`);
    },
    onSuccess: () => {
      toast({
        title: "Odrzucono",
        description: "Fiszka została odrzucona.",
      });
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
    },
  });

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
    pending_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  };

  const sourceLabels: Record<string, string> = {
    manual: "Ręczna",
    ai_generated: "AI",
  };

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <Badge className={statusColors[flashcard.status] || ""}>
              {flashcard.status === "active"
                ? "Aktywna"
                : flashcard.status === "pending_review"
                  ? "Oczekuje"
                  : "Odrzucona"}
            </Badge>
            <Badge variant="outline">{sourceLabels[flashcard.source] || flashcard.source}</Badge>
          </div>
        </CardHeader>

        <CardContent className="flex-1 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Pytanie:</p>
            <p className="text-sm font-medium">{flashcard.front}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Odpowiedź:</p>
            <p className="text-sm text-muted-foreground">{flashcard.back}</p>
          </div>
          {flashcard.next_review_at && (
            <div>
              <p className="text-xs text-muted-foreground">
                Następna powtórka: {new Date(flashcard.next_review_at).toLocaleDateString("pl-PL")}
              </p>
            </div>
          )}
        </CardContent>

        <CardFooter className="gap-2 flex-wrap pt-3">
          <Button size="sm" variant="outline" onClick={() => setShowEditor(true)} className="flex-1">
            Edytuj
          </Button>

          {flashcard.status === "pending_review" && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
              >
                Zatwierdź
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate()}
                disabled={rejectMutation.isPending}
              >
                Odrzuć
              </Button>
            </>
          )}

          <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)}>
            Usuń
          </Button>
        </CardFooter>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno usunąć tę fiszkę?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja jest nieodwracalna. Fiszka zostanie trwale usunięta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate();
                setShowDeleteDialog(false);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Usuwanie..." : "Usuń"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Modal */}
      {showEditor && <FlashcardEditor flashcard={flashcard} open={showEditor} onOpenChange={setShowEditor} />}
    </>
  );
}
