import "server-only";

import { createClient } from "@supabase/supabase-js";

import { envServer } from "@/lib/env/server";

/**
 * Creates a Supabase admin client using the service role key.
 *
 * Throws if the service role key is missing.
 */
export function getSupabaseAdmin() {
  if (!envServer.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to create the Supabase admin client.",
    );
  }

  return createClient(envServer.SUPABASE_URL, envServer.SUPABASE_SERVICE_ROLE_KEY);
}
