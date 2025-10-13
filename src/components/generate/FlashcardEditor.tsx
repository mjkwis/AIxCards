/**
 * Flashcard Editor Component
 *
 * Modal for editing flashcard front and back
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FlashcardDTO } from "@/types";

const flashcardSchema = z.object({
  front: z.string().min(1, "Pytanie jest wymagane").max(500, "Pytanie może mieć maksymalnie 500 znaków"),
  back: z.string().min(1, "Odpowiedź jest wymagana").max(2000, "Odpowiedź może mieć maksymalnie 2000 znaków"),
});

type FlashcardFormData = z.infer<typeof flashcardSchema>;

interface FlashcardEditorProps {
  flashcard: FlashcardDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function FlashcardEditor({ flashcard, open, onOpenChange, onSuccess }: FlashcardEditorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FlashcardFormData>({
    resolver: zodResolver(flashcardSchema),
    defaultValues: {
      front: flashcard.front,
      back: flashcard.back,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FlashcardFormData) => {
      const response = await apiClient.patch(`/flashcards/${flashcard.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Zapisano",
        description: "Fiszka została zaktualizowana.",
      });

      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["generation-requests"] });

      onOpenChange(false);
      onSuccess?.();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Nie udało się zapisać zmian.",
      });
    },
  });

  const onSubmit = (data: FlashcardFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edytuj fiszkę</DialogTitle>
          <DialogDescription>Wprowadź zmiany w pytaniu lub odpowiedzi.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="front">Pytanie (przód)</Label>
            <Textarea
              id="front"
              placeholder="Pytanie..."
              className="min-h-[100px]"
              {...register("front")}
              aria-invalid={errors.front ? "true" : "false"}
              aria-describedby={errors.front ? "front-error" : undefined}
            />
            {errors.front && (
              <p id="front-error" className="text-sm text-destructive">
                {errors.front.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="back">Odpowiedź (tył)</Label>
            <Textarea
              id="back"
              placeholder="Odpowiedź..."
              className="min-h-[150px]"
              {...register("back")}
              aria-invalid={errors.back ? "true" : "false"}
              aria-describedby={errors.back ? "back-error" : undefined}
            />
            {errors.back && (
              <p id="back-error" className="text-sm text-destructive">
                {errors.back.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Zapisywanie..." : "Zapisz"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
