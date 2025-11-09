/**
 * Login Form Wrapper
 *
 * Wraps LoginForm with Providers and UI components
 * Used for client-only rendering to avoid SSR issues
 */

import { Providers } from "@/components/providers/Providers";
import { LoginForm } from "./LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginFormWrapper() {
  return (
    <Providers initialUser={null}>
      <Card>
        <CardHeader>
          <CardTitle>Logowanie</CardTitle>
          <CardDescription>Wprowadź swój email i hasło, aby się zalogować</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </Providers>
  );
}