/**
 * Register Form Wrapper
 *
 * Wraps RegisterForm with Providers and UI components
 * Used for client-only rendering to avoid SSR issues
 */

import { Providers } from "@/components/providers/Providers";
import { RegisterForm } from "./RegisterForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function RegisterFormWrapper() {
  return (
    <Providers initialUser={null}>
      <Card>
        <CardHeader>
          <CardTitle>Rejestracja</CardTitle>
          <CardDescription>Wprowadź swoje dane, aby utworzyć konto</CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </Providers>
  );
}