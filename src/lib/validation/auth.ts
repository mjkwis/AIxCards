/**
 * Validation schemas for authentication endpoints
 *
 * Includes Zod schemas for:
 * - User registration
 * - User login
 *
 * All schemas enforce strict validation rules to ensure
 * data integrity and security.
 */

import { z } from "zod";

/**
 * Password validation schema
 *
 * Requirements:
 * - At least 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - Maximum 128 characters (prevents DoS attacks)
 *
 * Future considerations:
 * - Special character requirement
 * - Password strength checking (common passwords)
 * - Email substring checking
 */
const passwordSchema = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(128, "Password must not exceed 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

/**
 * Email validation schema
 *
 * Features:
 * - RFC 5322 compliant email format
 * - Automatic lowercase normalization
 * - Whitespace trimming
 * - Maximum length: 255 characters
 *
 * Normalization ensures that:
 * - user@example.com === USER@EXAMPLE.COM
 * - " user@example.com " === "user@example.com"
 */
const emailSchema = z
  .string({ required_error: "Email is required" })
  .email("Invalid email format")
  .max(255, "Email must not exceed 255 characters")
  .toLowerCase()
  .trim();

/**
 * Register command validation schema
 *
 * Used for: POST /api/auth/register
 *
 * Validates user registration data including:
 * - Email address (with normalization)
 * - Password (with strength requirements)
 */
export const RegisterSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

/**
 * Login command validation schema
 *
 * Used for: POST /api/auth/login
 *
 * Validates user login credentials:
 * - Email address (with normalization)
 * - Password (basic presence check, no strength validation for login)
 *
 * Note: For login, we don't validate password strength
 * (user already has an account with that password)
 */
export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: "Password is required" }),
});

/**
 * TypeScript type inference from Zod schemas
 * These types can be used for type-safe validation
 */
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
