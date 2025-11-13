/**
 * Update Password Form Component
 *
 * Form for setting a new password after clicking reset link
 */

import { useState, useEffect } from "react";
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

const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Hasło musi mieć co najmniej 8 znaków")
      .max(128, "Hasło nie może przekraczać 128 znaków")
      .regex(/[A-Z]/, "Hasło musi zawierać co najmniej jedną wielką literę")
      .regex(/[a-z]/, "Hasło musi zawierać co najmniej jedną małą literę")
      .regex(/[0-9]/, "Hasło musi zawierać co najmniej jedną cyfrę"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Hasła muszą być identyczne",
    path: ["confirmPassword"],
  });

type UpdatePasswordFormData = z.infer<typeof updatePasswordSchema>;

export function UpdatePasswordForm() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UpdatePasswordFormData>({
    resolver: zodResolver(updatePasswordSchema),
    mode: "onChange",
  });

  const password = watch("password", "");

  // Password requirements validation
  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  // Handle redirect after successful password update
  useEffect(() => {
    if (shouldRedirect) {
      const timer = setTimeout(() => {
        window.location.href = "/login";
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [shouldRedirect]);

  const onSubmit = async (data: UpdatePasswordFormData) => {
    setIsLoading(true);
    try {
      await apiClient.post("/auth/password/update", { password: data.password });

      toast({
        title: "Hasło zmienione!",
        description: "Twoje hasło zostało zaktualizowane. Przekierowujemy Cię do logowania...",
      });

      // Trigger redirect after successful password update
      setShouldRedirect(true);
    } catch (error) {
      const axiosError = error as AxiosError<ErrorResponse>;
      const status = axiosError.response?.status;
      const errorCode = axiosError.response?.data?.error?.code;
      let message = "Nie udało się zaktualizować hasła. Spróbuj ponownie.";

      // Handle specific error codes
      if (status === 401 || errorCode === "UNAUTHORIZED") {
        message = "Link resetujący wygasł lub jest nieprawidłowy. Poproś o nowy link.";
      } else if (status === 400) {
        message = "Hasło nie spełnia wymagań bezpieczeństwa.";
      }

      toast({
        variant: "destructive",
        title: "Błąd",
        description: message,
      });
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="password">Nowe hasło</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("password")}
            aria-invalid={errors.password ? "true" : "false"}
            aria-describedby="password-requirements"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
            <span className="sr-only">{showPassword ? "Ukryj hasło" : "Pokaż hasło"}</span>
          </Button>
        </div>
        <ul id="password-requirements" className="text-xs space-y-1">
          <li className={requirements.minLength ? "text-green-600" : "text-muted-foreground"}>
            {requirements.minLength ? "✓" : "○"} Co najmniej 8 znaków
          </li>
          <li className={requirements.hasUpperCase ? "text-green-600" : "text-muted-foreground"}>
            {requirements.hasUpperCase ? "✓" : "○"} Jedna wielka litera
          </li>
          <li className={requirements.hasLowerCase ? "text-green-600" : "text-muted-foreground"}>
            {requirements.hasLowerCase ? "✓" : "○"} Jedna mała litera
          </li>
          <li className={requirements.hasNumber ? "text-green-600" : "text-muted-foreground"}>
            {requirements.hasNumber ? "✓" : "○"} Jedna cyfra
          </li>
        </ul>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Powtórz nowe hasło</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="new-password"
            {...register("confirmPassword")}
            aria-invalid={errors.confirmPassword ? "true" : "false"}
            aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            {showConfirmPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
            <span className="sr-only">{showConfirmPassword ? "Ukryj hasło" : "Pokaż hasło"}</span>
          </Button>
        </div>
        {errors.confirmPassword && (
          <p id="confirm-error" className="text-sm text-destructive">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Aktualizowanie hasła..." : "Ustaw nowe hasło"}
      </Button>

      <p className="text-sm text-center text-muted-foreground">
        <a href="/login" className="text-primary hover:underline">
          Powrót do logowania
        </a>
      </p>
    </form>
  );
}
