<script lang="ts">
  import { onDestroy, tick } from "svelte";

  export let ChartComponent: any;
  export let props: Record<string, unknown> = {};

  let container: HTMLDivElement | null = null;
  let instance: any = null;
  let error: Error | null = null;
  let renderKey = 0;

  const destroyInstance = () => {
    if (instance?.$destroy) {
      instance.$destroy();
    }
    instance = null;
  };

  const render = async () => {
    if (!container || !ChartComponent) return;
    destroyInstance();
    await tick();
    try {
      instance = new ChartComponent({ target: container, props });
      error = null;
    } catch (err) {
      error = err as Error;
    }
  };

  $: renderKey, render();
  $: if (ChartComponent) {
    renderKey += 1;
  }
  $: if (props) {
    renderKey += 1;
  }

  onDestroy(() => {
    destroyInstance();
  });
</script>

<div class="chart-host" bind:this={container}></div>
{#if error}
  <slot name="error" {error}>
    <div class="fallback">Chart failed to render.</div>
  </slot>
{/if}

<style>
  .chart-host {
    width: 100%;
    min-height: 240px;
  }

  .fallback {
    padding: 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
</style>
