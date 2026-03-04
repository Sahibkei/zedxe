"use client";

import type { CSSProperties } from "react";
import dynamic from "next/dynamic";
import type { EChartsOption, EChartsType } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
    ssr: false,
});

type EChartProps = {
    option: EChartsOption;
    style?: CSSProperties;
    className?: string;
    onEvents?: Record<string, (params: unknown) => void>;
    onChartReady?: (chart: EChartsType) => void;
    notMerge?: boolean;
    lazyUpdate?: boolean;
};

/**
 * Render an ECharts instance with client-only dynamic import.
 * @param props - ECharts configuration and event handlers.
 * @returns ECharts chart element.
 */
export default function EChart({
    option,
    style,
    className,
    onEvents,
    onChartReady,
    notMerge = true,
    lazyUpdate = true,
}: EChartProps) {
    return (
        <ReactECharts
            option={option}
            style={style}
            className={className}
            onEvents={onEvents}
            onChartReady={onChartReady}
            notMerge={notMerge}
            lazyUpdate={lazyUpdate}
        />
    );
}
