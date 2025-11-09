/**
 * Navbar Actions Component
 *
 * Client-side navigation actions (user dropdown and mobile menu)
 * Standalone React island - doesn't require AuthProvider context
 */

import { UserDropdown } from "./UserDropdown";
import { MobileDrawer } from "./MobileDrawer";
import { Toaster } from "@/components/ui/toaster";
import type { UserDTO } from "@/types";

interface Link {
  href: string;
  label: string;
  active: boolean;
}

interface NavbarActionsProps {
  user: UserDTO | null;
  links: Link[];
}

export function NavbarActions({ user, links }: NavbarActionsProps) {
  return (
    <>
      <div className="hidden md:block">
        <UserDropdown user={user} />
      </div>
      <MobileDrawer links={links} user={user} />
      <Toaster />
    </>
  );
}