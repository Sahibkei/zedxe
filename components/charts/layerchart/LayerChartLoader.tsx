"use client";

import { useEffect, useRef, useState } from "react";

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
  const mountedRef = useRef(true);
  const retryCountRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    loadLayerChartBundle()
      .then(() => {
        if (!mountedRef.current) return;
        setReady(true);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err.message : "Unable to load chart bundle");
      });

    return () => {
        mountedRef.current = false;
    };
  }, []);

  const retry = () => {
    setError(null);
    setReady(false);
    retryCountRef.current += 1;
    const currentAttempt = retryCountRef.current;
    loadLayerChartBundle()
      .then(() => {
        if (!mountedRef.current || currentAttempt !== retryCountRef.current) return;
        setReady(true);
      })
      .catch((err) => {
        if (!mountedRef.current || currentAttempt !== retryCountRef.current) return;
        setError(err instanceof Error ? err.message : "Unable to load chart bundle");
      });
  };

  return { ready, error, retry };
}

export default function LayerChartLoader() {
  useLayerChartLoader();
  return null;
}
