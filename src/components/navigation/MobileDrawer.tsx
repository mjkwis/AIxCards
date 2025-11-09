/**
 * Mobile Drawer Component
 *
 * Mobile navigation drawer with hamburger menu
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/hooks/use-toast";
import { supabaseClient } from "@/db/supabase.client";
import type { UserDTO } from "@/types";

interface MobileDrawerProps {
  links: {
    href: string;
    label: string;
    active: boolean;
  }[];
  user?: UserDTO | null;
}

export function MobileDrawer({ links, user }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      // Get session for auth token
      const { data: sessionData } = await supabaseClient.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        // If no token, just redirect to home
        window.location.href = "/";
        return;
      }

      // Call logout API endpoint to clear cookies
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Nie udało się wylogować");
      }

      // Sign out from Supabase client
      await supabaseClient.auth.signOut();

      // Redirect to home page
      window.location.href = "/";
    } catch {
      toast({
        variant: "destructive",
        title: "Błąd",
        description: "Nie udało się wylogować. Spróbuj ponownie.",
      });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" data-testid="mobile-menu-trigger">
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
            aria-hidden="true"
          >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
          </svg>
          <span className="sr-only">Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-2 mt-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`block px-4 py-2 rounded-md transition-colors ${
                link.active ? "bg-primary text-primary-foreground" : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => setOpen(false)}
            >
              {link.label}
            </a>
          ))}

          {user && (
            <>
              <Separator className="my-2" />
              <div className="px-4 py-2">
                <p className="text-xs text-muted-foreground mb-1">Zalogowany jako:</p>
                <p className="text-sm font-medium truncate">{user.email}</p>
              </div>
              <Button
                variant="ghost"
                className="justify-start px-4 py-2 h-auto font-normal"
                onClick={handleLogout}
                data-testid="mobile-logout-button"
              >
                Wyloguj się
              </Button>
            </>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
