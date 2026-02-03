"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const ECHARTS_CDN = "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js";

let echartsPromise: Promise<typeof import("echarts") | undefined> | null = null;

const loadEcharts = () => {
    if (typeof window === "undefined") return Promise.resolve(undefined);
    if ((window as any).echarts) return Promise.resolve((window as any).echarts);
    if (!echartsPromise) {
        echartsPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = ECHARTS_CDN;
            script.async = true;
            script.onload = () => resolve((window as any).echarts);
            script.onerror = () => reject(new Error("Failed to load ECharts"));
            document.body.appendChild(script);
        });
    }
    return echartsPromise;
};

type OpenBBEChartsProps = {
    option: Record<string, any>;
    height?: number;
    className?: string;
};

export function OpenBBECharts({ option, height = 320, className }: OpenBBEChartsProps) {
    const chartRef = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadEcharts()
            .then((ec) => {
                if (ec) setReady(true);
            })
            .catch((err) => setError(err.message));
    }, []);

    useEffect(() => {
        if (!ready || !chartRef.current || !(window as any).echarts) return;
        const chart = (window as any).echarts.init(chartRef.current);
        chart.setOption(option, true);

        const handleResize = () => chart.resize();
        window.addEventListener("resize", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            chart.dispose();
        };
    }, [option, ready]);

    return (
        <div className={cn("relative h-full w-full", className)} style={{ height }}>
            <div ref={chartRef} className="h-full w-full" />
            {!ready && !error && (
                <div className="absolute inset-0 grid place-items-center text-xs text-slate-400">Loading chart…</div>
            )}
            {error && (
                <div className="absolute inset-0 grid place-items-center text-xs text-rose-400">
                    Unable to load chart
                </div>
            )}
        </div>
    );
}

export default OpenBBECharts;
