/// <reference types="astro/client" />

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./db/database.types.ts";

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient<Database>;
      user?: {
        id: string;
        email?: string;
      };
      rateLimitRemaining?: number;
      rateLimitReset?: Date;
    }
  }
}

interface ImportMetaEnv {
  readonly SUPABASE_URL: string;
  readonly SUPABASE_KEY: string;
  readonly OPENROUTER_API_KEY?: string;
  readonly OPENROUTER_MODEL?: string;
  readonly SITE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
