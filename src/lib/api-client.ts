/**
 * API Client Configuration
 *
 * Axios instance with interceptors for authentication and error handling
 * Automatically adds Bearer token to protected API requests
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

export const apiClient = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Important for cookie-based auth
});

/**
 * Function to get access token from AuthProvider
 * Set by AuthProvider during initialization
 */
let getAccessTokenFn: (() => Promise<string | null>) | null = null;

/**
 * Initialize API client with access token provider
 * Called by AuthProvider to set up Bearer token injection
 */
export function initializeApiClient(getAccessToken: () => Promise<string | null>) {
  getAccessTokenFn = getAccessToken;
}

/**
 * Public API paths that don't require Bearer token
 * These paths use cookie-based authentication instead
 * Note: baseURL is /api, so paths are relative (without /api prefix)
 */
const PUBLIC_API_PATHS = ["/auth/login", "/auth/register", "/auth/password/reset", "/auth/password/update"];

// Request interceptor to add Bearer token
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Skip adding Bearer token for public endpoints
    const isPublicPath = PUBLIC_API_PATHS.some((path) => config.url === path || config.url?.startsWith(path));

    if (!isPublicPath && getAccessTokenFn) {
      try {
        const token = await getAccessTokenFn();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // Token retrieval failed, continue without auth header
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Handle 401 errors globally
    if (error.response?.status === 401) {
      // Redirect to login with return URL
      const currentPath = window.location.pathname;
      if (currentPath !== "/login" && currentPath !== "/register") {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }

    return Promise.reject(error);
  }
);
