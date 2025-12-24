<svelte:options tag="zedxe-geo-map" />

<script lang="ts">
  import { onMount } from "svelte";
  import ChartSkeleton from "./charts/ChartSkeleton.svelte";
  import FallbackMessage from "./charts/FallbackMessage.svelte";
  import LayerChartRenderer from "./charts/LayerChartRenderer.svelte";
  import SimpleGeoMap from "./charts/SimpleGeoMap.svelte";
  import { parseGeo } from "./parse";
  import type { GeoDatum } from "./types";

  export let data: string | null = null;

  let parsed: GeoDatum[] = [];
  let parseError: string | undefined;
  let ChartComponent: any = null;
  let libError: string | null = null;
  let spec: Record<string, unknown> | null = null;

  $: ({ values: parsed, error: parseError } = parseGeo(data));
  $: spec = parsed.length
    ? {
        mark: { type: "geoshape", tooltip: true },
        encoding: {
          color: { field: "value", type: "quantitative" },
          featureId: { field: "region" }
        }
      }
    : null;

  onMount(async () => {
    try {
      const mod = await import("layerchart");
      ChartComponent = (mod as any).LayerChart ?? (mod as any).Chart ?? (mod as any).default ?? null;
    } catch (error) {
      libError = (error as Error).message;
    }
  });
</script>

<div class="shell">
  {#if parseError || !parsed.length}
    <FallbackMessage label="No data" />
  {:else if libError}
    <SimpleGeoMap values={parsed} />
  {:else if !ChartComponent || !spec}
    <ChartSkeleton />
  {:else}
    <LayerChartRenderer {ChartComponent} props={{ data: parsed, spec }}>
      <FallbackMessage slot="error" label="Map failed to render" />
    </LayerChartRenderer>
  {/if}
</div>

<style>
  .shell {
    display: block;
    width: 100%;
  }
</style>
