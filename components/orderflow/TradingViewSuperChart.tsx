"use client";

import React, { useEffect, useMemo, useRef } from "react";

declare global {
  interface Window {
    TradingView?: any;
  }
}

let tvScriptPromise: Promise<void> | null = null;

function loadTvScript(): Promise<void> {
  if (tvScriptPromise) return tvScriptPromise;

  tvScriptPromise = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && window.TradingView) {
      resolve();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://s3.tradingview.com/tv.js"]'
    );

    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load TradingView script"))
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load TradingView script"));
    document.head.appendChild(script);
  });

  return tvScriptPromise;
}

function toTradingViewSymbol(raw: string) {
  const s = (raw || "").trim();
  if (!s) return "BINANCE:BTCUSDT";
  if (s.includes(":")) return s;
  // Convert common formats BTC/USDT or BTC-USDT -> BTCUSDT
  return `BINANCE:${s.replaceAll("/", "").replaceAll("-", "")}`;
}

export default function TradingViewSuperChart({
  symbol,
  interval = "5",
  className = "",
}: {
  symbol: string;
  interval?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const tvSymbol = useMemo(() => toTradingViewSymbol(symbol), [symbol]);
  const containerId = useMemo(() => {
    const safe = `${tvSymbol}-${interval}`.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
    return `tv_superchart_${safe}`;
  }, [tvSymbol, interval]);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      await loadTvScript();
      if (cancelled) return;

      const el = containerRef.current;
      if (!el) return;

      // Clear previous widget to prevent stacked iframes on symbol/interval change
      el.innerHTML = "";

      const inner = document.createElement("div");
      inner.id = containerId;
      inner.style.width = "100%";
      inner.style.height = "100%";
      el.appendChild(inner);

      if (!window.TradingView?.widget) return;

      new window.TradingView.widget({
        symbol: tvSymbol,
        interval,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        autosize: true,
        withdateranges: true,
        allow_symbol_change: false,
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        container_id: containerId,
      });
    }

    mount().catch(() => {
      // Do not crash the page if TradingView fails to load
    });

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [tvSymbol, interval, containerId]);

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

