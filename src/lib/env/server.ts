import "server-only";

import { z } from "zod";

/**
 * Raw environment values used for server-side validation.
 */
const rawEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ORDERFLOW_RETENTION_HOURS: process.env.ORDERFLOW_RETENTION_HOURS,
  MODEL_CACHE_RETENTION_HOURS: process.env.MODEL_CACHE_RETENTION_HOURS,
  RETENTION_BATCH_SIZE: process.env.RETENTION_BATCH_SIZE,
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
  ORDERFLOW_RETENTION_HOURS: z.preprocess(
    (value) => value ?? "24",
    z.coerce.number().int().positive(),
  ),
  MODEL_CACHE_RETENTION_HOURS: z.preprocess(
    (value) => value ?? "168",
    z.coerce.number().int().positive(),
  ),
  RETENTION_BATCH_SIZE: z.preprocess(
    (value) => value ?? "50000",
    z.coerce.number().int().positive(),
  ),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  NODE_ENV: z.string().optional(),
});

const parsed = serverSchema.safeParse({
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: rawEnv.SUPABASE_SERVICE_ROLE_KEY,
  ORDERFLOW_RETENTION_HOURS: rawEnv.ORDERFLOW_RETENTION_HOURS,
  MODEL_CACHE_RETENTION_HOURS: rawEnv.MODEL_CACHE_RETENTION_HOURS,
  RETENTION_BATCH_SIZE: rawEnv.RETENTION_BATCH_SIZE,
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

/**
 * Validated server environment values.
 *
 * Throws a descriptive error if required keys are missing or invalid.
 */
export const envServer = {
  SUPABASE_URL: parsed.data.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
  ORDERFLOW_RETENTION_HOURS: parsed.data.ORDERFLOW_RETENTION_HOURS,
  MODEL_CACHE_RETENTION_HOURS: parsed.data.MODEL_CACHE_RETENTION_HOURS,
  RETENTION_BATCH_SIZE: parsed.data.RETENTION_BATCH_SIZE,
  UPSTASH_REDIS_REST_URL: parsed.data.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: parsed.data.UPSTASH_REDIS_REST_TOKEN,
  NODE_ENV: parsed.data.NODE_ENV,
};
