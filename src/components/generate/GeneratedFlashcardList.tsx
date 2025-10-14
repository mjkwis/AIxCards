/**
 * Generated Flashcard List Component
 *
 * Displays list of generated flashcards with approve/reject/edit actions
 */

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FlashcardEditor } from "./FlashcardEditor";
import type { FlashcardDTO } from "@/types";

interface GeneratedFlashcardListProps {
  flashcards: FlashcardDTO[];
}

export function GeneratedFlashcardList({ flashcards: initialFlashcards }: GeneratedFlashcardListProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [flashcards, setFlashcards] = useState(initialFlashcards);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingFlashcard, setEditingFlashcard] = useState<FlashcardDTO | null>(null);

  // Sync local state with props when new flashcards are generated
  useEffect(() => {
    setFlashcards(initialFlashcards);
    setSelectedIds(new Set()); // Clear selections when new flashcards arrive
  }, [initialFlashcards]);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/flashcards/${id}/approve`);
    },
    onSuccess: (_, id) => {
      setFlashcards((prev) => prev.filter((f) => f.id !== id));
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));

      toast({
        title: "Zatwierdzono",
        description: "Fiszka została dodana do aktywnych.",
      });

      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.post(`/flashcards/${id}/reject`);
    },
    onSuccess: (_, id) => {
      setFlashcards((prev) => prev.filter((f) => f.id !== id));
      selectedIds.delete(id);
      setSelectedIds(new Set(selectedIds));

      toast({
        title: "Odrzucono",
        description: "Fiszka została odrzucona.",
      });

      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
    },
  });

  const batchApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiClient.post("/flashcards/batch-approve", { flashcard_ids: ids });
    },
    onSuccess: () => {
      const approvedCount = selectedIds.size;
      setFlashcards((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setSelectedIds(new Set());

      toast({
        title: "Zatwierdzono",
        description: `${approvedCount} fiszek zostało dodanych do aktywnych.`,
      });

      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
    },
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(flashcards.map((f) => f.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBatchApprove = () => {
    if (selectedIds.size === 0) return;
    batchApproveMutation.mutate(Array.from(selectedIds));
  };

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Wszystkie fiszki zostały przetworzone.</p>
      </div>
    );
  }

  const allSelected = flashcards.length > 0 && selectedIds.size === flashcards.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < flashcards.length;

  return (
    <div className="space-y-4">
      {/* Batch Actions */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Zaznacz wszystkie"
            className={someSelected ? "data-[state=checked]:bg-primary/50" : ""}
          />
          <span className="text-sm font-medium">
            {selectedIds.size > 0 ? `Zaznaczono ${selectedIds.size}` : "Zaznacz wszystkie"}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <Button onClick={handleBatchApprove} disabled={batchApproveMutation.isPending}>
            {batchApproveMutation.isPending ? "Zatwierdzanie..." : `Zatwierdź zaznaczone (${selectedIds.size})`}
          </Button>
        )}
      </div>

      {/* Flashcards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {flashcards.map((flashcard) => (
          <Card key={flashcard.id} className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <Checkbox
                  checked={selectedIds.has(flashcard.id)}
                  onCheckedChange={(checked) => handleSelect(flashcard.id, checked as boolean)}
                  aria-label={`Zaznacz fiszkę: ${flashcard.front.substring(0, 50)}`}
                />
                <Badge variant="secondary" className="ml-auto">
                  {flashcard.status}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Pytanie:</p>
                <p className="text-sm">{flashcard.front}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Odpowiedź:</p>
                <p className="text-sm text-muted-foreground">{flashcard.back}</p>
              </div>
            </CardContent>

            <CardFooter className="gap-2 flex-wrap">
              <Button
                size="sm"
                variant="default"
                onClick={() => approveMutation.mutate(flashcard.id)}
                disabled={approveMutation.isPending}
                className="flex-1"
              >
                Zatwierdź
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditingFlashcard(flashcard)}>
                Edytuj
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate(flashcard.id)}
                disabled={rejectMutation.isPending}
              >
                Odrzuć
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Editor Modal */}
      {editingFlashcard && (
        <FlashcardEditor
          flashcard={editingFlashcard}
          open={!!editingFlashcard}
          onOpenChange={(open) => !open && setEditingFlashcard(null)}
          onSuccess={() => {
            // Refresh the list
            queryClient.invalidateQueries({ queryKey: ["generation-requests"] });
          }}
        />
      )}
    </div>
  );
}
