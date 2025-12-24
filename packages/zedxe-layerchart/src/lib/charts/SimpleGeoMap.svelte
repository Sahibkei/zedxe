<script lang="ts">
  import type { GeoDatum } from "../types";

  export let values: GeoDatum[] = [];
  const maxValue = values.reduce((acc, item) => Math.max(acc, item.value || 0), 0) || 1;
</script>

<div class="geo">
  {#if !values.length}
    <p class="empty">No data</p>
  {:else}
    <ul>
      {#each values as item (item.region)}
        <li>
          <div class="label">
            <span>{item.region}</span>
            <span class="value">{item.value.toLocaleString()}</span>
          </div>
          <div class="bar-wrap">
            <div class="bar" style={`width:${Math.max(6, (item.value / maxValue) * 100)}%`}></div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .geo {
    min-height: 240px;
    border-radius: 16px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 16px;
    background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.05), rgba(255,255,255,0.02)),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  li {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .label {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.85);
  }

  .value {
    color: rgba(56, 189, 248, 0.9);
    font-variant-numeric: tabular-nums;
  }

  .bar-wrap {
    background: rgba(255, 255, 255, 0.04);
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .bar {
    height: 8px;
    background: linear-gradient(90deg, rgba(16, 185, 129, 0.7), rgba(56, 189, 248, 0.6));
  }

  .empty {
    margin: 0;
    width: 100%;
    text-align: center;
    color: rgba(255, 255, 255, 0.6);
  }
</style>
