/**
 * Combined Providers Component
 * 
 * Wraps application with all necessary providers
 */

import type { ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { AuthProvider } from './AuthProvider';
import { Toaster } from '@/components/ui/toaster';
import type { UserDTO } from '@/types';

interface ProvidersProps {
  children: ReactNode;
  initialUser?: UserDTO | null;
}

export function Providers({ children, initialUser }: ProvidersProps) {
  return (
    <QueryProvider>
      <AuthProvider initialUser={initialUser}>
        {children}
        <Toaster />
      </AuthProvider>
    </QueryProvider>
  );
}

