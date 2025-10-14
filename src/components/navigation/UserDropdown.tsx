/**
 * User Dropdown Component
 *
 * Displays user menu with email, logout and delete account options
 * Standalone component - doesn't require AuthProvider context
 */

import { useState } from "react";
import type { UserDTO } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useToast } from "@/components/hooks/use-toast";
import { supabaseClient } from "@/db/supabase.client";

interface UserDropdownProps {
  user: UserDTO | null;
}

export function UserDropdown({ user }: UserDropdownProps) {
  const { toast } = useToast();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = async () => {
    try {
      console.log("🔵 Starting logout process...");

      // Get session for auth token
      const { data: sessionData } = await supabaseClient.auth.getSession();
      console.log("🔵 Session data:", sessionData);
      const token = sessionData.session?.access_token;
      console.log("🔵 Token exists:", !!token);

      if (!token) {
        console.log("🔴 No token found, redirecting to home");
        // If no token, just redirect to home
        window.location.href = "/";
        return;
      }

      console.log("🔵 Calling /api/auth/logout...");
      // Call logout API endpoint to clear cookies
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      console.log("🔵 Logout API response status:", response.status);

      if (!response.ok) {
        throw new Error("Nie udało się wylogować");
      }

      console.log("🔵 Signing out from Supabase client...");
      // Sign out from Supabase client
      await supabaseClient.auth.signOut();

      console.log("🔵 Redirecting to home page...");
      // Redirect to home page
      window.location.href = "/";
    } catch (error) {
      console.error("🔴 Logout error:", error);
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Nie udało się wylogować. Spróbuj ponownie.",
      });
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // Get session for auth token
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("Brak tokenu autoryzacji");
      }

      // Call delete account API
      const response = await fetch("/api/auth/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Nie udało się usunąć konta");
      }

      // Sign out and redirect
      await supabaseClient.auth.signOut();

      toast({
        title: "Konto usunięte",
        description: "Twoje konto zostało trwale usunięte.",
      });

      // Redirect to home page
      window.location.href = "/";
    } catch (error) {
      console.error("Delete account error:", error);
      toast({
        variant: "destructive",
        title: "Błąd",
        description: error instanceof Error ? error.message : "Nie udało się usunąć konta. Spróbuj ponownie.",
      });
      setIsDeleting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2">
            <span className="hidden sm:inline-block">{user.email}</span>
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
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4" />
              <path d="M12 8h.01" />
            </svg>
            <span className="sr-only">Menu użytkownika</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">Konto</p>
              <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>Wyloguj się</DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            Usuń konto
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Czy na pewno chcesz usunąć konto?</AlertDialogTitle>
            <AlertDialogDescription>
              Ta akcja jest nieodwracalna. Wszystkie Twoje fiszki i dane zostaną trwale usunięte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Usuwanie..." : "Usuń konto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
