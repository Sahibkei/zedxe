<svelte:options tag="zedxe-profitability" />

<script lang="ts">
  import { onMount } from "svelte";
  import ChartSkeleton from "./charts/ChartSkeleton.svelte";
  import FallbackMessage from "./charts/FallbackMessage.svelte";

  type ProfitPoint = { date: string; ebitda?: number; netIncome?: number };
  type ProfitPayload = {
    symbol?: string;
    frequency?: "annual" | "quarter";
    currency?: string;
    series?: ProfitPoint[];
  };

  export let data: string | null = null;

  let parsed: ProfitPayload | null = null;
  let error: string | null = null;
  let series: ProfitPoint[] = [];
  let showEbitda = true;
  let showNetIncome = true;
  let active: { date: string; ebitda?: number; netIncome?: number } | null = null;

  const parsePayload = (raw?: string | null): ProfitPayload | null => {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as ProfitPayload;
      if (!value?.series || !Array.isArray(value.series)) return null;
      return value;
    } catch (err) {
      error = (err as Error).message;
      return null;
    }
  };

  const formatNumber = (value?: number, currency?: string) => {
    if (value === undefined || value === null || Number.isNaN(value)) return "—";
    const short = value >= 1e9 ? `${(value / 1e9).toFixed(1)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value.toLocaleString();
    return currency ? `${currency} ${short}` : short;
  };

  const handleHover = (point: ProfitPoint | null) => {
    active = point;
  };

  $: {
    parsed = parsePayload(data);
    series = parsed?.series
      ?.filter((item) => typeof item?.date === "string")
      ?.map((item) => ({
        date: item.date,
        ebitda: typeof item.ebitda === "number" && !Number.isNaN(item.ebitda) ? item.ebitda : undefined,
        netIncome: typeof item.netIncome === "number" && !Number.isNaN(item.netIncome) ? item.netIncome : undefined
      })) ?? [];
  }

  onMount(() => {
    active = null;
  });
</script>

<div class="shell">
  {#if error || !series.length}
    <FallbackMessage label="No data available" />
  {:else}
    <div class="chart" role="img" aria-label="Profitability chart">
      <div class="legend">
        <button class={`legend-btn ${showEbitda ? "active" : ""}`} type="button" on:click={() => (showEbitda = !showEbitda)}>
          <span class="dot ebitda" aria-hidden="true" />
          EBITDA
        </button>
        <button class={`legend-btn ${showNetIncome ? "active" : ""}`} type="button" on:click={() => (showNetIncome = !showNetIncome)}>
          <span class="dot net" aria-hidden="true" />
          Net Income
        </button>
      </div>
      <div class="grid">
        {#each series as point (point.date)}
          {#if showEbitda || showNetIncome}
            <div class="column" on:mouseenter={() => handleHover(point)} on:mouseleave={() => handleHover(null)}>
              <div class="stack">
                {#if showEbitda && point.ebitda}
                  <div
                    class="bar ebitda"
                    style={`height:${Math.max(6, (point.ebitda / Math.max(...series.map((p) => Math.max(p.ebitda || 0, p.netIncome || 0, 1)))) * 100)}%`}
                  >
                    <span class="sr-only">{point.date}: EBITDA {formatNumber(point.ebitda, parsed?.currency)}</span>
                  </div>
                {/if}
                {#if showNetIncome && point.netIncome}
                  <div
                    class="bar net"
                    style={`height:${Math.max(6, (point.netIncome / Math.max(...series.map((p) => Math.max(p.ebitda || 0, p.netIncome || 0, 1)))) * 100)}%`}
                  >
                    <span class="sr-only">{point.date}: Net Income {formatNumber(point.netIncome, parsed?.currency)}</span>
                  </div>
                {/if}
              </div>
              <span class="label">{point.date}</span>
            </div>
          {/if}
        {/each}
      </div>
      {#if active}
        <div class="tooltip">
          <p class="tooltip-label">{active.date}</p>
          {#if showEbitda}<p class="tooltip-value">EBITDA: {formatNumber(active.ebitda, parsed?.currency)}</p>{/if}
          {#if showNetIncome}<p class="tooltip-value">Net Income: {formatNumber(active.netIncome, parsed?.currency)}</p>{/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .shell {
    display: block;
    width: 100%;
  }

  .chart {
    position: relative;
    min-height: 260px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px;
    background: radial-gradient(circle at 10% 10%, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .legend {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .legend-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.9rem;
  }

  .legend-btn.active {
    border-color: rgba(56, 189, 248, 0.65);
    background: rgba(56, 189, 248, 0.08);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 9999px;
  }

  .dot.ebitda {
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.85), rgba(56, 189, 248, 0.55));
    border: 1px solid rgba(56, 189, 248, 0.8);
  }

  .dot.net {
    background: linear-gradient(180deg, rgba(16, 185, 129, 0.85), rgba(16, 185, 129, 0.55));
    border: 1px solid rgba(16, 185, 129, 0.8);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(36px, 1fr));
    gap: 10px;
    align-items: end;
    flex: 1;
  }

  .column {
    display: grid;
    gap: 8px;
  }

  .stack {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    min-height: 120px;
  }

  .bar {
    width: 14px;
    border-radius: 6px 6px 4px 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    position: relative;
  }

  .bar.ebitda {
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.45), rgba(56, 189, 248, 0.12));
    border-color: rgba(56, 189, 248, 0.6);
  }

  .bar.net {
    background: linear-gradient(180deg, rgba(16, 185, 129, 0.45), rgba(16, 185, 129, 0.12));
    border-color: rgba(16, 185, 129, 0.6);
  }

  .label {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  }

  .tooltip {
    position: absolute;
    top: 12px;
    right: 12px;
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(0, 0, 0, 0.6);
    color: #e5e7eb;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
    min-width: 180px;
  }

  .tooltip-label {
    margin: 0;
    font-size: 0.85rem;
    color: rgba(229, 231, 235, 0.8);
  }

  .tooltip-value {
    margin: 4px 0 0;
    font-weight: 700;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
