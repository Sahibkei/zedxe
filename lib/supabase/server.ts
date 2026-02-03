import "server-only";

import { envServer } from "@/lib/env/server";

/**
 * Creates a Supabase admin client using the service role key.
 *
 * Throws if the service role key is missing or if @supabase/supabase-js
 * is not installed at runtime.
 */
export function getSupabaseAdmin() {
  if (!envServer.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to create the Supabase admin client.",
    );
  }

  let createClient: (url: string, key: string) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ({ createClient } = require("@supabase/supabase-js"));
  } catch (error) {
    throw new Error(
      "Supabase client not installed. Add @supabase/supabase-js to use getSupabaseAdmin().",
    );
  }

  return createClient(envServer.SUPABASE_URL, envServer.SUPABASE_SERVICE_ROLE_KEY);
}
