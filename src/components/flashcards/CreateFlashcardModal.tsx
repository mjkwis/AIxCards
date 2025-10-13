/**
 * Create Flashcard Modal Component
 *
 * Modal for creating a new manual flashcard
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { FlashcardResponse } from "@/types";

const createFlashcardSchema = z.object({
  front: z.string().min(1, "Pytanie jest wymagane").max(500, "Pytanie może mieć maksymalnie 500 znaków"),
  back: z.string().min(1, "Odpowiedź jest wymagana").max(2000, "Odpowiedź może mieć maksymalnie 2000 znaków"),
});

type CreateFlashcardFormData = z.infer<typeof createFlashcardSchema>;

interface CreateFlashcardModalProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CreateFlashcardModal({ trigger, open, onOpenChange }: CreateFlashcardModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFlashcardFormData>({
    resolver: zodResolver(createFlashcardSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFlashcardFormData) => {
      const response = await apiClient.post<FlashcardResponse>("/flashcards", data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        title: "Utworzono",
        description: "Nowa fiszka została dodana.",
      });

      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      reset();
      onOpenChange?.(false);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Nie udało się utworzyć fiszki.",
      });
    },
  });

  const onSubmit = (data: CreateFlashcardFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Utwórz fiszkę</DialogTitle>
          <DialogDescription>Dodaj własną fiszkę z pytaniem i odpowiedzią.</DialogDescription>
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
              onClick={() => {
                reset();
                onOpenChange?.(false);
              }}
              disabled={createMutation.isPending}
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Tworzenie..." : "Utwórz fiszkę"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
