import { z } from "zod";

const clientSchema = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  })
  .refine(
    (data) =>
      !(data.NEXT_PUBLIC_SUPABASE_URL || data.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
      (data.NEXT_PUBLIC_SUPABASE_URL && data.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    {
      message:
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set together",
      path: ["NEXT_PUBLIC_SUPABASE_URL"],
    },
  );

const parsed = clientSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const flattened = parsed.error.flatten().fieldErrors;
  const details = Object.entries(flattened)
    .map(([key, value]) => `${key}: ${value?.join(", ")}`)
    .join("; ");
  throw new Error(`Invalid client environment variables. ${details}`);
}

export const envClient = {
  NEXT_PUBLIC_SUPABASE_URL: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};
