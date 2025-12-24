"use client";

import { useEffect, useState } from "react";

const BUNDLE_SRC = "/vendor/layerchart/zedxe-layerchart.js";
const BUNDLE_ID = "zedxe-layerchart-bundle";
const CSS_HREF = "/vendor/layerchart/zedxe-layerchart.css";

let loadPromise: Promise<void> | null = null;

function attachStylesheet() {
  if (document.getElementById(`${BUNDLE_ID}-css`)) return;
  const link = document.createElement("link");
  link.id = `${BUNDLE_ID}-css`;
  link.rel = "stylesheet";
  link.href = CSS_HREF;
  document.head.appendChild(link);
}

function loadLayerChartBundle() {
  if (typeof window === "undefined") return Promise.resolve();
  if (loadPromise) return loadPromise;
  if (document.getElementById(BUNDLE_ID)) {
    attachStylesheet();
    loadPromise = Promise.resolve();
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = BUNDLE_ID;
    script.type = "module";
    script.src = BUNDLE_SRC;
    script.async = true;

    script.onload = () => {
      attachStylesheet();
      resolve();
    };
    script.onerror = (event) => {
      loadPromise = null;
      reject(new Error(`Failed to load LayerChart bundle: ${event}`));
    };

    document.body.appendChild(script);
  });

  return loadPromise;
}

export function useLayerChartLoader() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLayerChartBundle()
      .then(() => {
        if (cancelled) return;
        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unable to load chart bundle");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const retry = () => {
    setError(null);
    setReady(false);
    loadLayerChartBundle()
      .then(() => setReady(true))
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load chart bundle"));
  };

  return { ready, error, retry };
}

export default function LayerChartLoader() {
  useLayerChartLoader();
  return null;
}
