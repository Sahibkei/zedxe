import "server-only";

import { envServer } from "@/lib/env/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

type RetentionResult = {
  ok: boolean;
  orderflowDeleted: number;
  cacheDeleted: number;
  retentionHours: number;
  batchSize: number;
  error?: string;
};

export async function runRetention(): Promise<RetentionResult> {
  const retentionHours = envServer.ORDERFLOW_RETENTION_HOURS;
  const batchSize = envServer.RETENTION_BATCH_SIZE;

  let supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabaseAdmin = getSupabaseAdmin() as ReturnType<typeof getSupabaseAdmin>;
  } catch (error) {
    return {
      ok: false,
      orderflowDeleted: 0,
      cacheDeleted: 0,
      retentionHours,
      batchSize,
      error: "Supabase admin client unavailable.",
    };
  }

  const { data, error } = await supabaseAdmin.rpc("prune_analytics", {
    retention_hours: retentionHours,
    model_cache_retention_hours: envServer.MODEL_CACHE_RETENTION_HOURS,
    batch_size: batchSize,
  });

  if (error) {
    const errorMessage = error.message || "Retention RPC failed.";
    try {
      await supabaseAdmin.from("retention_runs").insert({
        orderflow_deleted: 0,
        cache_deleted: 0,
        retention_hours: retentionHours,
        batch_size: batchSize,
        status: "error",
        error: errorMessage,
      });
    } catch (insertError) {
      console.error("Failed to log retention run error.", insertError);
    }

    return {
      ok: false,
      orderflowDeleted: 0,
      cacheDeleted: 0,
      retentionHours,
      batchSize,
      error: errorMessage,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const orderflowDeleted = row?.orderflow_deleted ?? 0;
  const cacheDeleted = row?.cache_deleted ?? 0;

  try {
    await supabaseAdmin.from("retention_runs").insert({
      orderflow_deleted: orderflowDeleted,
      cache_deleted: cacheDeleted,
      retention_hours: retentionHours,
      batch_size: batchSize,
      status: "ok",
      error: null,
    });
  } catch (insertError) {
    console.error("Failed to log retention run metrics.", insertError);
  }

  return {
    ok: true,
    orderflowDeleted,
    cacheDeleted,
    retentionHours,
    batchSize,
  };
}
