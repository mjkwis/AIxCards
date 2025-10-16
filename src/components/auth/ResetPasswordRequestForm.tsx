/**
 * Reset Password Request Form Component
 *
 * Form for requesting a password reset link via email
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/components/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AxiosError } from "axios";
import type { ErrorResponse } from "@/types";

const resetPasswordRequestSchema = z.object({
  email: z.string().email("Nieprawidłowy adres email").trim().toLowerCase().max(255, "Email jest zbyt długi"),
});

type ResetPasswordRequestFormData = z.infer<typeof resetPasswordRequestSchema>;

export function ResetPasswordRequestForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordRequestFormData>({
    resolver: zodResolver(resetPasswordRequestSchema),
  });

  const onSubmit = async (data: ResetPasswordRequestFormData) => {
    console.log("🔧 FRONTEND DEBUG: Reset form submitted", { email: data.email });
    setIsLoading(true);
    try {
      console.log("🔧 FRONTEND DEBUG: Calling API /auth/password/reset-request");
      await apiClient.post("/auth/password/reset-request", { email: data.email });
      console.log("🔧 FRONTEND DEBUG: API call successful");

      setIsSuccess(true);
      toast({
        title: "Link wysłany",
        description: "Jeśli podany email istnieje w systemie, wysłaliśmy na niego link do resetowania hasła.",
      });
    } catch (error) {
      console.log("🔧 FRONTEND DEBUG: API call failed", error);
      const axiosError = error as AxiosError<ErrorResponse>;
      const status = axiosError.response?.status;
      const errorCode = axiosError.response?.data?.error?.code;
      console.log("🔧 FRONTEND DEBUG: Error details", { status, errorCode, responseData: axiosError.response?.data });

      let message = "Nie udało się wysłać linku. Spróbuj ponownie.";

      // Handle specific error codes
      if (status === 429 || errorCode === "RATE_LIMIT_EXCEEDED") {
        message = "Zbyt wiele prób resetowania hasła. Spróbuj ponownie później.";
      } else if (status === 400) {
        message = "Nieprawidłowy adres email.";
      }

      toast({
        variant: "destructive",
        title: "Błąd",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-green-600 dark:text-green-400"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-lg">Sprawdź swoją skrzynkę</h3>
          <p className="text-sm text-muted-foreground">
            Jeśli podany email istnieje w naszym systemie, wysłaliśmy na niego link do resetowania hasła.
          </p>
          <p className="text-sm text-muted-foreground">Nie otrzymałeś emaila? Sprawdź folder spam.</p>
        </div>

        <div className="pt-4">
          <Button variant="outline" onClick={() => (window.location.href = "/login")} className="w-full">
            Powrót do logowania
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Adres email</Label>
        <Input
          id="email"
          type="email"
          placeholder="twoj@email.pl"
          autoComplete="email"
          {...register("email")}
          aria-invalid={errors.email ? "true" : "false"}
          aria-describedby={errors.email ? "email-error" : undefined}
        />
        {errors.email && (
          <p id="email-error" className="text-sm text-destructive">
            {errors.email.message}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Wprowadź swój adres email, a my wyślemy Ci link do resetowania hasła.
        </p>
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Wysyłanie..." : "Wyślij link resetujący"}
      </Button>

      <div className="space-y-2">
        <p className="text-sm text-center text-muted-foreground">
          Pamiętasz hasło?{" "}
          <a href="/login" className="text-primary hover:underline">
            Zaloguj się
          </a>
        </p>

        <p className="text-sm text-center text-muted-foreground">
          Nie masz konta?{" "}
          <a href="/register" className="text-primary hover:underline">
            Zarejestruj się
          </a>
        </p>
      </div>
    </form>
  );
}

