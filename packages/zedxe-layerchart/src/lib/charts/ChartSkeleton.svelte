<div class="skeleton" role="status" aria-label="Loading chart" aria-live="polite">
  <div class="pulse" />
</div>

<style>
  .skeleton {
    min-height: 240px;
    border-radius: 16px;
    background: radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
      radial-gradient(circle at 80% 0%, rgba(255,255,255,0.05), transparent),
      linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .pulse {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.08), rgba(255,255,255,0));
    animation: shimmer 2s infinite;
  }

  @keyframes shimmer {
    0% { transform: translateX(-100%); }
    100% { transform: translateX(100%); }
  }
</style>
