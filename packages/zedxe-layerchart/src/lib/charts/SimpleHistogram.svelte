<script lang="ts">
  import type { HistogramDatum } from "../types";

  export let values: HistogramDatum[] = [];

  const maxValue = values.reduce((acc, item) => Math.max(acc, item.value || 0), 0) || 1;
</script>

<div class="chart">
  {#if !values.length}
    <p class="empty">No data</p>
  {:else}
    <div class="bars">
      {#each values as item (item.label)}
        <div class="bar-group" title={`${item.label}: ${item.value}`}>
          <div class="bar" style={`height:${Math.max(4, (item.value / maxValue) * 100)}%`}></div>
          <span class="label">{item.label}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .chart {
    min-height: 240px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px;
    background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
    display: flex;
    align-items: flex-end;
  }

  .bars {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(48px, 1fr));
    gap: 10px;
    width: 100%;
    align-items: end;
  }

  .bar-group {
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 6px;
    align-items: end;
  }

  .bar {
    background: linear-gradient(180deg, rgba(56, 189, 248, 0.4), rgba(56, 189, 248, 0.1));
    border: 1px solid rgba(56, 189, 248, 0.6);
    border-radius: 10px 10px 6px 6px;
    min-height: 4px;
    box-shadow: 0 10px 25px rgba(56, 189, 248, 0.15);
    transition: transform 0.2s ease;
  }

  .bar-group:hover .bar {
    transform: translateY(-4px);
  }

  .label {
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.75rem;
    text-align: center;
  }

  .empty {
    margin: 0;
    width: 100%;
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
  }
</style>
