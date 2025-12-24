<svelte:options tag="zedxe-sankey" />

<script lang="ts">
  import { onMount } from "svelte";
  import ChartSkeleton from "./charts/ChartSkeleton.svelte";
  import FallbackMessage from "./charts/FallbackMessage.svelte";
  import LayerChartRenderer from "./charts/LayerChartRenderer.svelte";
  import SimpleSankey from "./charts/SimpleSankey.svelte";
  import { parseSankey } from "./parse";
  import type { SankeyLink } from "./types";

  export let data: string | null = null;

  let parsed: SankeyLink[] = [];
  let parseError: string | undefined;
  let ChartComponent: any = null;
  let libError: string | null = null;
  let spec: Record<string, unknown> | null = null;

  $: ({ values: parsed, error: parseError } = parseSankey(data));
  $: spec = parsed.length
    ? {
        mark: { type: "sankey", color: { field: "source" } },
        encoding: {
          source: { field: "source" },
          target: { field: "target" },
          value: { field: "value" }
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
    <SimpleSankey links={parsed} />
  {:else if !ChartComponent || !spec}
    <ChartSkeleton />
  {:else}
    <LayerChartRenderer {ChartComponent} props={{ data: parsed, spec }}>
      <FallbackMessage slot="error" label="Flow failed to render" />
    </LayerChartRenderer>
  {/if}
</div>

<style>
  .shell {
    display: block;
    width: 100%;
  }
</style>
