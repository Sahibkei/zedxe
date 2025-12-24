<script lang="ts">
  import type { SankeyLink } from "../types";

  export let links: SankeyLink[] = [];
  $: maxValue = links.reduce((acc, item) => Math.max(acc, item.value || 0), 0) || 1;
</script>

<div class="sankey">
  {#if !links.length}
    <p class="empty">No data</p>
  {:else}
    <div class="flow-grid">
      {#each links as link, index (link.source + link.target)}
        <div class="flow" style={`animation-delay:${index * 0.05}s`}>
          <div class="meta">
            <span class="source">{link.source}</span>
            <span class="target">→ {link.target}</span>
          </div>
          <div class="bar-wrap">
            <div class="bar" style={`width:${Math.max(6, (link.value / maxValue) * 100)}%`}></div>
          </div>
          <span class="value">{(link.value ?? 0).toLocaleString()}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .sankey {
    min-height: 240px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px;
    background: radial-gradient(circle at 10% 10%, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
  }

  .flow-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .flow {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 12px;
    padding: 10px 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 6px 18px rgba(0,0,0,0.2);
    animation: fadeIn 0.4s ease forwards;
  }

  .meta {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.85);
    margin-bottom: 6px;
  }

  .source {
    color: rgba(56, 189, 248, 0.9);
  }

  .target {
    color: rgba(16, 185, 129, 0.9);
  }

  .bar-wrap {
    background: rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .bar {
    height: 10px;
    background: linear-gradient(90deg, rgba(59,130,246,0.8), rgba(16,185,129,0.7));
  }

  .value {
    margin-top: 6px;
    display: inline-block;
    color: rgba(255, 255, 255, 0.7);
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
  }

  .empty {
    margin: 0;
    width: 100%;
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>
