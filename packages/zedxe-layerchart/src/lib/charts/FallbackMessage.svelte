<script lang="ts">
  export let label: string;
</script>

<div class="fallback">
  <p>{label}</p>
</div>

<style>
  .fallback {
    display: grid;
    place-items: center;
    min-height: 240px;
    border: 1px dashed rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    color: rgba(255, 255, 255, 0.65);
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.02));
    backdrop-filter: blur(6px);
    font-size: 0.95rem;
    text-align: center;
  }
</style>
