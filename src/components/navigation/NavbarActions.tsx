/**
 * Navbar Actions Component
 *
 * Client-side navigation actions (user dropdown and mobile menu)
 * Must be used within Providers
 */

import { UserDropdown } from "./UserDropdown";
import { MobileDrawer } from "./MobileDrawer";

interface Link {
  href: string;
  label: string;
  active: boolean;
}

interface NavbarActionsProps {
  links: Link[];
}

export function NavbarActions({ links }: NavbarActionsProps) {
  return (
    <>
      <div className="hidden md:block">
        <UserDropdown />
      </div>
      <MobileDrawer links={links} />
    </>
  );
}

