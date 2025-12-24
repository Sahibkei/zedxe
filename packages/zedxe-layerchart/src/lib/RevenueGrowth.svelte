<svelte:options tag="zedxe-revenue-growth" />

<script lang="ts">
  import { onMount } from "svelte";
  import ChartSkeleton from "./charts/ChartSkeleton.svelte";
  import FallbackMessage from "./charts/FallbackMessage.svelte";

  type RevenuePoint = { date: string; revenue: number };
  type RevenuePayload = {
    symbol?: string;
    frequency?: "annual" | "quarter";
    currency?: string;
    view?: "values" | "yoy";
    series?: RevenuePoint[];
  };

  export let data: string | null = null;

  let parsed: RevenuePayload | null = null;
  let error: string | null = null;
  let view: "values" | "yoy" = "values";
  let series: RevenuePoint[] = [];
  let yoySeries: Array<RevenuePoint & { change: number }> = [];
  let tooltip: { label: string; value: string } | null = null;
  let activeIndex: number | null = null;

  const parsePayload = (raw?: string | null): RevenuePayload | null => {
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as RevenuePayload;
      if (!value?.series || !Array.isArray(value.series)) return null;
      return value;
    } catch (err) {
      error = (err as Error).message;
      return null;
    }
  };

  const formatNumber = (value: number, currency?: string) => {
    if (Number.isNaN(value)) return "—";
    const short = value >= 1e9 ? `${(value / 1e9).toFixed(1)}B` : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value.toLocaleString();
    return currency ? `${currency} ${short}` : short;
  };

  const computeYoy = (points: RevenuePoint[]) => {
    const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
    const withChange = sorted.map((point, idx) => {
      if (idx === 0) return { ...point, change: 0 };
      const prev = sorted[idx - 1];
      const change = prev.revenue ? ((point.revenue - prev.revenue) / prev.revenue) * 100 : 0;
      return { ...point, change };
    });
    return withChange;
  };

  $: {
    parsed = parsePayload(data);
    if (!parsed) {
      series = [];
      yoySeries = [];
      view = "values";
    } else {
      view = parsed.view === "yoy" ? "yoy" : "values";
      series = (parsed.series || []).filter((item) => typeof item?.revenue === "number" && !Number.isNaN(item.revenue) && typeof item?.date === "string");
      yoySeries = computeYoy(series);
    }
  }

  const maxRevenue = () => Math.max(...series.map((p) => p.revenue || 0), 1);
  const maxYoy = () => Math.max(...yoySeries.map((p) => Math.abs(p.change || 0)), 1);

  const showTooltip = (idx: number) => {
    activeIndex = idx;
    if (view === "yoy") {
      const point = yoySeries[idx];
      tooltip = point ? { label: point.date, value: `${point.change.toFixed(2)}% YoY` } : null;
    } else {
      const point = series[idx];
      tooltip = point ? { label: point.date, value: formatNumber(point.revenue, parsed?.currency) } : null;
    }
  };

  const hideTooltip = () => {
    activeIndex = null;
    tooltip = null;
  };

  onMount(() => {
    tooltip = null;
  });
</script>

<div class="shell">
  {#if error || !series.length}
    <FallbackMessage label="No data available" />
  {:else}
    <div class="chart" role="img" aria-label="Revenue growth chart">
      <div class="bars">
        {#if view === "yoy"}
          {#each yoySeries as point, idx (point.date)}
            <div
              class={`bar ${point.change < 0 ? "negative" : ""} ${activeIndex === idx ? "active" : ""}`}
              style={`height:${Math.max(4, (Math.abs(point.change) / maxYoy()) * 100)}%`}
              on:mouseenter={() => showTooltip(idx)}
              on:mouseleave={hideTooltip}
            >
              <span class="sr-only">{point.date}: {point.change.toFixed(2)}%</span>
            </div>
          {/each}
        {:else}
          {#each series as point, idx (point.date)}
            <div
              class={`bar ${activeIndex === idx ? "active" : ""}`}
              style={`height:${Math.max(4, (point.revenue / maxRevenue()) * 100)}%`}
              on:mouseenter={() => showTooltip(idx)}
              on:mouseleave={hideTooltip}
            >
              <span class="sr-only">{point.date}: {formatNumber(point.revenue, parsed?.currency)}</span>
            </div>
          {/each}
        {/if}
      </div>
      {#if tooltip}
        <div class="tooltip">
          <p class="tooltip-label">{tooltip.label}</p>
          <p class="tooltip-value">{tooltip.value}</p>
        </div>
      {/if}
      <div class="legend">
        <span class="dot" aria-hidden="true" />
        <span class="legend-text">{view === "yoy" ? "YoY %" : `Revenue (${parsed?.currency ?? ""})`}</span>
      </div>
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
    min-height: 320px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px;
    background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(24px, 1fr));
    gap: 10px;
    align-items: end;
    flex: 1;
  }

  .bar {
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.4), rgba(56, 189, 248, 0.1));
    border: 1px solid rgba(56, 189, 248, 0.6);
    border-radius: 8px 8px 6px 6px;
    min-height: 6px;
    position: relative;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }

  .bar.active {
    box-shadow: 0 10px 25px rgba(56, 189, 248, 0.25);
    transform: translateY(-4px);
  }

  .bar.negative {
    background: linear-gradient(180deg, rgba(248, 113, 113, 0.45), rgba(248, 113, 113, 0.12));
    border-color: rgba(248, 113, 113, 0.65);
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
    min-width: 140px;
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

  .legend {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.8);
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 9999px;
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.8), rgba(56, 189, 248, 0.5));
    border: 1px solid rgba(56, 189, 248, 0.8);
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
