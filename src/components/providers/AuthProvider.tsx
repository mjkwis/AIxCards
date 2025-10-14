/**
 * Authentication Context Provider
 *
 * Manages user authentication state across the application
 * Integrates with Supabase Auth and provides access token management
 */

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserDTO } from "@/types";
import { apiClient, initializeApiClient } from "@/lib/api-client";
import { supabaseClient } from "@/db/supabase.client";

interface AuthContextValue {
  user: UserDTO | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  initialUser?: UserDTO | null;
}

export function AuthProvider({ children, initialUser = null }: AuthProviderProps) {
  const [user, setUser] = useState<UserDTO | null>(initialUser);
  const [isLoading, setIsLoading] = useState(!initialUser);

  /**
   * Get current access token from Supabase session
   * Used by apiClient interceptor to add Bearer token to requests
   */
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();
      return session?.access_token ?? null;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to get access token:", error);
      return null;
    }
  };

  const fetchCurrentUser = useCallback(async () => {
    try {
      const response = await apiClient.get<{ user: UserDTO }>("/auth/account");
      setUser(response.data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkSessionAndFetchUser = useCallback(async () => {
    try {
      // First check if we have a valid session
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      // Only fetch user if we have a session
      if (session?.access_token) {
        await fetchCurrentUser();
      } else {
        // No session, user is not logged in
        setUser(null);
        setIsLoading(false);
      }
    } catch {
      setUser(null);
      setIsLoading(false);
    }
  }, [fetchCurrentUser]);

  useEffect(() => {
    // Initialize API client with access token provider
    initializeApiClient(getAccessToken);

    // If we don't have initial user, try to fetch current user
    // Only do this if we potentially have a session (check for access token first)
    if (!initialUser) {
      checkSessionAndFetchUser();
    }
  }, [initialUser, checkSessionAndFetchUser]);

  const login = async (email: string, password: string) => {
    const response = await apiClient.post("/auth/login", { email, password });

    // Set session in Supabase client for client-side auth
    const { session } = response.data;
    if (session?.access_token && session?.refresh_token) {
      await supabaseClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    setUser(response.data.user);
  };

  const register = async (email: string, password: string) => {
    const response = await apiClient.post("/auth/register", { email, password });

    // Set session in Supabase client for client-side auth
    const { session } = response.data;
    if (session?.access_token && session?.refresh_token) {
      await supabaseClient.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    setUser(response.data.user);
  };

  const logout = async () => {
    await apiClient.post("/auth/logout");
    // Clear session in Supabase client
    await supabaseClient.auth.signOut();
    setUser(null);
    window.location.href = "/login";
  };

  const deleteAccount = async () => {
    await apiClient.delete("/auth/account");
    setUser(null);
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
