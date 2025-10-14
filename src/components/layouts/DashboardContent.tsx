/**
 * Dashboard Content Component
 *
 * React wrapper for entire dashboard content
 * Ensures single Providers instance for Navbar and page content
 * Uses Portal to render NavbarActions in correct DOM location
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Providers } from "@/components/providers/Providers";
import { NavbarActions } from "@/components/navigation/NavbarActions";
import type { UserDTO } from "@/types";

interface Link {
  href: string;
  label: string;
  active: boolean;
}

interface DashboardContentProps {
  user: UserDTO | null;
  links: Link[];
  children: ReactNode;
}

export function DashboardContent({ user, links, children }: DashboardContentProps) {
  const [navbarContainer, setNavbarContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Find navbar actions container in DOM
    const container = document.getElementById("navbar-actions-container");
    setNavbarContainer(container);
  }, []);

  return (
    <Providers initialUser={user}>
      {/* Portal NavbarActions to navbar container */}
      {navbarContainer && createPortal(<NavbarActions links={links} />, navbarContainer)}

      {/* Main content */}
      {children}
    </Providers>
  );
}

