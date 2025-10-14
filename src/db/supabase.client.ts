import { createClient } from "@supabase/supabase-js";
import { createServerClient, type CookieOptionsWithName } from "@supabase/ssr";
import type { AstroCookies } from "astro";

import type { Database } from "../db/database.types.ts";

// Server-side environment variables (SSR only)
const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.SUPABASE_KEY;

// Client-side environment variables (available in browser)
const publicSupabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_KEY;

/**
 * Client-side Supabase client for browser usage
 * Used in React components and client-side code
 * Uses PUBLIC_ prefixed env vars that are available in the browser
 */
export const supabaseClient = createClient<Database>(publicSupabaseUrl, publicSupabaseAnonKey);

/**
 * Cookie options for Supabase SSR
 * Used for secure session management with httpOnly cookies
 * In development, secure is false to allow cookies over HTTP
 */
export const cookieOptions: CookieOptionsWithName = {
  path: "/",
  secure: import.meta.env.PROD,
  httpOnly: true,
  sameSite: "lax",
};

/**
 * Parses the Cookie header string into an array of cookie objects
 * Required by Supabase SSR's getAll() method
 */
function parseCookieHeader(cookieHeader: string): { name: string; value: string }[] {
  return cookieHeader.split(";").map((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

/**
 * Creates a Supabase server instance for SSR
 * Uses getAll/setAll pattern as required by @supabase/ssr
 *
 * @param context - Astro context with headers and cookies
 * @returns Configured Supabase client for server-side use
 */
export const createSupabaseServerInstance = (context: { headers: Headers; cookies: AstroCookies }) => {
  const supabase = createServerClient<Database>(import.meta.env.SUPABASE_URL, import.meta.env.SUPABASE_KEY, {
    cookieOptions,
    cookies: {
      getAll() {
        return parseCookieHeader(context.headers.get("Cookie") ?? "");
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => context.cookies.set(name, value, options));
      },
    },
  });

  return supabase;
};
