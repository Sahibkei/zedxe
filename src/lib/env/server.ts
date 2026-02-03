import "server-only";

import { z } from "zod";

const rawEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: process.env.NODE_ENV,
};

const missingRequired: string[] = [];
const supabaseUrl = rawEnv.SUPABASE_URL ?? rawEnv.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  missingRequired.push("SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
}

if (rawEnv.NODE_ENV === "production" && !rawEnv.SUPABASE_SERVICE_ROLE_KEY) {
  missingRequired.push("SUPABASE_SERVICE_ROLE_KEY");
}

if (missingRequired.length > 0) {
  throw new Error(
    `Missing required server environment variables: ${missingRequired.join(", ")}`,
  );
}

const serverSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
});

const parsed = serverSchema.safeParse({
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: rawEnv.SUPABASE_SERVICE_ROLE_KEY,
  UPSTASH_REDIS_REST_URL: rawEnv.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: rawEnv.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: rawEnv.NODE_ENV,
});

if (!parsed.success) {
  const flattened = parsed.error.flatten().fieldErrors;
  const details = Object.entries(flattened)
    .map(([key, value]) => `${key}: ${value?.join(", ")}`)
    .join("; ");
  throw new Error(`Invalid server environment variables. ${details}`);
}

export const envServer = {
  SUPABASE_URL: parsed.data.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  UPSTASH_REDIS_REST_URL: parsed.data.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: parsed.data.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: parsed.data.NODE_ENV,
};
