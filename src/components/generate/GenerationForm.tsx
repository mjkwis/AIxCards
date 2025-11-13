/**
 * Generation Form Component
 *
 * Form for submitting text to generate flashcards
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useToast } from "@/components/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { CreateGenerationRequestResponse } from "@/types";

const generationSchema = z.object({
  source_text: z
    .string()
    .min(1000, "Tekst musi mieć co najmniej 1000 znaków")
    .max(10000, "Tekst może mieć maksymalnie 10000 znaków"),
});

type GenerationFormData = z.infer<typeof generationSchema>;

interface GenerationFormProps {
  onSuccess?: (data: CreateGenerationRequestResponse) => void;
}

export function GenerationForm({ onSuccess }: GenerationFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [charCount, setCharCount] = useState(0);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<GenerationFormData>({
    resolver: zodResolver(generationSchema),
  });

  const sourceText = watch("source_text", "");

  // Update character count when text changes
  useState(() => {
    setCharCount(sourceText.length);
  });

  const generateMutation = useMutation({
    mutationFn: async (data: GenerationFormData) => {
      const response = await apiClient.post<CreateGenerationRequestResponse>("/generation-requests", data);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Fiszki wygenerowane!",
        description: `Utworzono ${data.flashcards.length} fiszek. Przejrzyj i zatwierdź je poniżej.`,
      });

      // Invalidate queries to refresh lists
      queryClient.invalidateQueries({ queryKey: ["generation-requests"] });
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });

      // Clear form
      reset();
      setCharCount(0);

      // Call onSuccess callback
      onSuccess?.(data);
    },
    onError: (error: unknown) => {
      const axiosError = error as {
        response?: { data?: { error?: { message?: string; details?: { reset_at?: string } } }; status?: number };
      };
      const message = axiosError.response?.data?.error?.message || "Nie udało się wygenerować fiszek";
      const isRateLimit = axiosError.response?.status === 429;

      if (isRateLimit) {
        const resetAt = axiosError.response?.data?.error?.details?.reset_at;
        const resetDate = resetAt ? new Date(resetAt) : null;
        const countdown = resetDate ? Math.ceil((resetDate.getTime() - Date.now()) / 1000 / 60) : null;

        toast({
          variant: "destructive",
          title: "Przekroczono limit",
          description: countdown ? `Możesz wygenerować więcej fiszek za ${countdown} minut.` : message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Błąd",
          description: message,
        });
      }
    },
  });

  const onSubmit = (data: GenerationFormData) => {
    generateMutation.mutate(data);
  };

  const isWithinRange = charCount >= 1000 && charCount <= 10000;
  const isDisabled = !isWithinRange || generateMutation.isPending;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="source_text">Tekst źródłowy</Label>
          <span
            className={`text-sm ${
              charCount < 1000 ? "text-muted-foreground" : charCount > 10000 ? "text-destructive" : "text-green-600"
            }`}
          >
            {charCount.toLocaleString()} / 10,000 znaków
          </span>
        </div>
        <Textarea
          id="source_text"
          placeholder="Wklej tutaj tekst, z którego chcesz wygenerować fiszki (1000-10000 znaków)..."
          className="min-h-[300px] font-mono text-sm"
          {...register("source_text", {
            onChange: (e) => setCharCount(e.target.value.length),
          })}
          aria-invalid={errors.source_text ? "true" : "false"}
          aria-describedby={errors.source_text ? "text-error" : "text-hint"}
        />
        {errors.source_text ? (
          <p id="text-error" className="text-sm text-destructive">
            {errors.source_text.message}
          </p>
        ) : (
          <p id="text-hint" className="text-sm text-muted-foreground">
            Wklej notatki, artykuł lub dowolny materiał do nauki. AI wygeneruje z niego pytania i odpowiedzi.
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isDisabled}>
        {generateMutation.isPending ? "Generowanie..." : "Generuj fiszki"}
      </Button>

      {!isWithinRange && charCount > 0 && (
        <p className="text-sm text-center text-muted-foreground">
          {charCount < 1000
            ? `Potrzebujesz jeszcze ${1000 - charCount} znaków`
            : `Przekroczono limit o ${charCount - 10000} znaków`}
        </p>
      )}
    </form>
  );
}
