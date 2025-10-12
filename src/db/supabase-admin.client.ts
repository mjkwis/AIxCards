/**
 * Supabase Admin Client
 *
 * This client uses the SERVICE_ROLE_KEY which bypasses Row Level Security (RLS)
 * and has full database access. Use with extreme caution!
 *
 * ⚠️ SECURITY WARNING:
 * - NEVER expose this client or service role key to the frontend
 * - Only use for administrative operations that require elevated privileges
 * - Always validate user identity before performing admin operations
 *
 * Use cases:
 * - Deleting user accounts (auth.admin.deleteUser)
 * - Bulk operations that bypass RLS
 * - System maintenance tasks
 *
 * For regular user operations, use the standard supabaseClient instead.
 */

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseServiceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase configuration. Please ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in environment variables."
  );
}

/**
 * Supabase Admin Client with Service Role privileges
 *
 * This client has full access to the database and can:
 * - Bypass Row Level Security (RLS)
 * - Delete users via auth.admin.deleteUser()
 * - Perform administrative operations
 *
 * ⚠️ Use only on the server-side and only when necessary!
 */
export const supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Type export for dependency injection
 */
export type SupabaseAdminClient = typeof supabaseAdmin;
