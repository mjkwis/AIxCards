/**
 * Authentication Service
 *
 * Handles user authentication operations through Supabase Auth:
 * - User registration (sign up)
 * - User login (sign in)
 * - User logout (sign out)
 * - Account deletion
 *
 * This service acts as a facade over Supabase Auth,
 * providing a clean interface and proper error handling.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../db/database.types";
import type { AuthResponse, UserDTO, SessionDTO } from "../../types";
import { DatabaseError } from "../errors/database.error";

/**
 * Custom error types for authentication operations
 */
export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code = "AUTH_ERROR",
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export class EmailAlreadyRegisteredError extends AuthServiceError {
  constructor() {
    super("Email address is already registered", "EMAIL_ALREADY_REGISTERED");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends AuthServiceError {
  constructor() {
    super("Invalid email or password", "INVALID_CREDENTIALS");
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Authentication Service
 *
 * Provides methods for user authentication operations
 * using Supabase Auth as the underlying provider.
 */
export class AuthService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Register a new user account
   *
   * Creates a new user in Supabase Auth with the provided email and password.
   * Upon successful registration:
   * - User record is created in auth.users table
   * - Password is automatically hashed using bcrypt
   * - JWT tokens (access_token and refresh_token) are generated
   * - Optional email verification can be sent (configured in Supabase)
   *
   * @param email - User's email address (normalized to lowercase)
   * @param password - User's password (will be hashed by Supabase)
   * @returns AuthResponse with user data and session tokens
   * @throws EmailAlreadyRegisteredError if email is already in use
   * @throws AuthServiceError for other registration failures
   *
   * @example
   * ```ts
   * const result = await authService.register(
   *   "user@example.com",
   *   "SecurePass123"
   * );
   * console.log(result.user.id);
   * console.log(result.session.access_token);
   * ```
   */
  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          // Skip email confirmation in development/test environments
          // This allows immediate login after registration
          emailRedirectTo: undefined,
        },
      });

      if (error) {
        // Check for duplicate email error
        if (
          error.message.includes("already registered") ||
          error.message.includes("already been registered") ||
          error.status === 422
        ) {
          throw new EmailAlreadyRegisteredError();
        }

        throw new AuthServiceError(
          "Registration failed",
          "REGISTRATION_FAILED",
          error.message || JSON.stringify(error)
        );
      }

      // When email confirmation is enabled, Supabase creates the user but doesn't return a session
      // In this case, we need to handle it differently for test environments
      if (!data.user) {
        throw new AuthServiceError("Registration failed: No user returned", "REGISTRATION_FAILED");
      }

      // If no session is returned, it means email confirmation is required
      if (!data.session) {
        // In test/dev environment with email confirmation enabled,
        // we need to use admin API to verify the user automatically
        const isTestEnv = import.meta.env.MODE === "test" || import.meta.env.DEV;

        if (isTestEnv && import.meta.env.SUPABASE_SERVICE_ROLE_KEY) {
          // Import admin client dynamically to avoid issues
          const { supabaseAdmin } = await import("../../db/supabase-admin.client");

          // Update user to mark email as verified
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
            email_confirm: true,
          });

          if (updateError) {
            throw new AuthServiceError(
              "Registration successful but email confirmation required",
              "EMAIL_CONFIRMATION_REQUIRED",
              { email: data.user.email }
            );
          }

          // Now try to sign in
          const { data: signInData, error: signInError } = await this.supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError || !signInData.session) {
            throw new AuthServiceError("User verified but sign in failed", "SIGN_IN_FAILED", signInError?.message);
          }

          return {
            user: this.mapUserToDTO(signInData.user),
            session: this.mapSessionToDTO(signInData.session),
          };
        }

        // Production environment or no admin key - user must confirm email
        throw new AuthServiceError(
          "Registration successful but email confirmation required",
          "EMAIL_CONFIRMATION_REQUIRED",
          { email: data.user.email }
        );
      }

      // Map Supabase types to our DTOs
      return {
        user: this.mapUserToDTO(data.user),
        session: this.mapSessionToDTO(data.session),
      };
    } catch (error) {
      // Re-throw our custom errors
      if (error instanceof AuthServiceError) {
        throw error;
      }

      // Wrap unexpected errors
      throw new AuthServiceError("Unexpected error during registration", "INTERNAL_ERROR", error);
    }
  }

  /**
   * Authenticate an existing user
   *
   * Validates user credentials and creates a new session.
   * Upon successful login:
   * - Credentials are validated against hashed password
   * - New JWT tokens are generated
   * - Session is created
   *
   * @param email - User's email address
   * @param password - User's password
   * @returns AuthResponse with user data and session tokens
   * @throws InvalidCredentialsError if credentials are invalid
   * @throws AuthServiceError for other authentication failures
   *
   * @example
   * ```ts
   * const result = await authService.login(
   *   "user@example.com",
   *   "SecurePass123"
   * );
   * console.log(result.session.access_token);
   * ```
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Generic error for security (don't reveal if email exists)
        if (error.message.includes("Invalid login credentials") || error.status === 400) {
          throw new InvalidCredentialsError();
        }

        throw new AuthServiceError("Login failed", "LOGIN_FAILED", error.message);
      }

      if (!data.user || !data.session) {
        throw new InvalidCredentialsError();
      }

      return {
        user: this.mapUserToDTO(data.user),
        session: this.mapSessionToDTO(data.session),
      };
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }

      throw new AuthServiceError("Unexpected error during login", "INTERNAL_ERROR", error);
    }
  }

  /**
   * Log out the current user
   *
   * Invalidates the current session and clears tokens.
   * This operation is idempotent - calling it multiple times is safe.
   *
   * @throws AuthServiceError if logout fails
   *
   * @example
   * ```ts
   * await authService.logout();
   * ```
   */
  async logout(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        throw new AuthServiceError("Logout failed", "LOGOUT_FAILED", error.message);
      }
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }

      throw new AuthServiceError("Unexpected error during logout", "INTERNAL_ERROR", error);
    }
  }

  /**
   * Delete the current user's account
   *
   * Permanently deletes the user account and all associated data.
   * This operation:
   * - Deletes the user from auth.users
   * - Triggers CASCADE deletion of user data (via database constraints)
   * - Cannot be undone
   *
   * Note: This requires a Supabase client with appropriate permissions.
   * For complete deletion, use a service role client.
   *
   * @param userId - ID of the user to delete
   * @throws AuthServiceError if deletion fails
   *
   * @example
   * ```ts
   * await authService.deleteAccount(user.id);
   * ```
   */
  async deleteAccount(userId: string): Promise<void> {
    try {
      // Note: This requires admin/service role client
      // Regular user clients cannot delete users
      const { error } = await this.supabase.auth.admin.deleteUser(userId);

      if (error) {
        throw new AuthServiceError("Account deletion failed", "DELETION_FAILED", error.message);
      }
    } catch (error) {
      if (error instanceof AuthServiceError) {
        throw error;
      }

      throw new AuthServiceError("Unexpected error during account deletion", "INTERNAL_ERROR", error);
    }
  }

  /**
   * Maps Supabase User object to our UserDTO
   *
   * @private
   */
  private mapUserToDTO(user: { id: string; email?: string; created_at: string }): UserDTO {
    if (!user.email) {
      throw new DatabaseError("User email is required but not found", "MISSING_EMAIL");
    }
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    };
  }

  /**
   * Maps Supabase Session object to our SessionDTO
   *
   * @private
   */
  private mapSessionToDTO(session: { access_token: string; refresh_token: string; expires_at?: number }): SessionDTO {
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at
        ? new Date(session.expires_at * 1000).toISOString()
        : new Date(Date.now() + 3600000).toISOString(), // Default: 1 hour
    };
  }
}
