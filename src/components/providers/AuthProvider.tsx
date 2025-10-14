/**
 * Authentication Context Provider
 *
 * Manages user authentication state across the application
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { UserDTO } from "@/types";
import { apiClient } from "@/lib/api-client";

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
  // DEV MODE: Use mock user when authentication is not implemented
  const DEV_MOCK_AUTH = import.meta.env.DEV;

  const mockUser: UserDTO | null = DEV_MOCK_AUTH
    ? {
        id: "2c87435e-48a2-4467-9a6b-e6c7524e730e",
        email: "mjk.wisniewski@gmail.com",
        created_at: new Date().toISOString(),
      }
    : null;

  const [user, setUser] = useState<UserDTO | null>(initialUser || mockUser);
  const [isLoading, setIsLoading] = useState(!initialUser && !DEV_MOCK_AUTH);

  useEffect(() => {
    // Skip fetching in dev mode - use mock user
    if (DEV_MOCK_AUTH) {
      setIsLoading(false);
      return;
    }

    // If we don't have initial user, try to fetch current user
    if (!initialUser) {
      fetchCurrentUser();
    }
  }, [initialUser]);

  const fetchCurrentUser = async () => {
    try {
      const response = await apiClient.get<{ user: UserDTO }>("/auth/account");
      setUser(response.data.user);
    } catch (error) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    if (DEV_MOCK_AUTH) {
      console.warn("[DEV] Mock login - authentication not implemented");
      setUser(mockUser);
      return;
    }
    const response = await apiClient.post("/auth/login", { email, password });
    setUser(response.data.user);
  };

  const register = async (email: string, password: string) => {
    if (DEV_MOCK_AUTH) {
      console.warn("[DEV] Mock register - authentication not implemented");
      setUser(mockUser);
      return;
    }
    const response = await apiClient.post("/auth/register", { email, password });
    setUser(response.data.user);
  };

  const logout = async () => {
    if (DEV_MOCK_AUTH) {
      console.warn("[DEV] Mock logout - authentication not implemented");
      window.location.href = "/";
      return;
    }
    await apiClient.post("/auth/logout");
    setUser(null);
    window.location.href = "/login";
  };

  const deleteAccount = async () => {
    if (DEV_MOCK_AUTH) {
      console.warn("[DEV] Mock delete account - authentication not implemented");
      window.location.href = "/";
      return;
    }
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
