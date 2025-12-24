<svelte:options tag="zedxe-histogram" />

<script lang="ts">
  import { onMount } from "svelte";
  import ChartSkeleton from "./charts/ChartSkeleton.svelte";
  import FallbackMessage from "./charts/FallbackMessage.svelte";
  import LayerChartRenderer from "./charts/LayerChartRenderer.svelte";
  import SimpleHistogram from "./charts/SimpleHistogram.svelte";
  import { parseHistogram } from "./parse";
  import type { HistogramDatum } from "./types";

  export let data: string | null = null;

  let parsed: HistogramDatum[] = [];
  let parseError: string | undefined;
  let ChartComponent: any = null;
  let libError: string | null = null;
  let spec: Record<string, unknown> | null = null;

  $: ({ values: parsed, error: parseError } = parseHistogram(data));
  $: spec = parsed.length
    ? {
        mark: { type: "bar" },
        encoding: {
          x: { field: "label", type: "nominal", axis: { labelAngle: -20 } },
          y: { field: "value", type: "quantitative" }
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
    <SimpleHistogram values={parsed} />
  {:else if !ChartComponent || !spec}
    <ChartSkeleton />
  {:else}
    <LayerChartRenderer {ChartComponent} props={{ data: parsed, spec }}>
      <FallbackMessage slot="error" label="Chart failed to render" />
    </LayerChartRenderer>
  {/if}
</div>

<style>
  .shell {
    display: block;
    width: 100%;
  }
</style>
