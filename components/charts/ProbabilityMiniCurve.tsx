import { useMemo, useState } from "react";

import clsx from "clsx";

const VIEWBOX_WIDTH = 800;
const VIEWBOX_HEIGHT = 260;
const PADDING = {
    top: 18,
    right: 18,
    bottom: 36,
    left: 48,
};

type ProbabilityMiniCurveProps = {
    surface: {
        xs: number[];
        up: number[];
        down: number[];
        within: number[];
    };
    className?: string;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const ProbabilityMiniCurve = ({
    surface,
    className,
}: ProbabilityMiniCurveProps) => {
    const { xs, up, down, within } = surface;
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const chartWidth = VIEWBOX_WIDTH - PADDING.left - PADDING.right;
    const chartHeight = VIEWBOX_HEIGHT - PADDING.top - PADDING.bottom;

    const points = useMemo(() => {
        if (!xs.length || xs.length !== up.length) {
            return null;
        }
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const spanX = maxX - minX || 1;
        const toX = (value: number) =>
            PADDING.left + ((value - minX) / spanX) * chartWidth;
        const toY = (value: number) =>
            PADDING.top + (1 - clamp01(value)) * chartHeight;

        return xs.map((xValue, index) => ({
            xValue,
            x: toX(xValue),
            up: { y: toY(up[index]), value: up[index] },
            down: { y: toY(down[index]), value: down[index] },
            within: { y: toY(within[index]), value: within[index] },
        }));
    }, [xs, up, down, within, chartWidth, chartHeight]);

    const buildPath = (seriesKey: "up" | "down" | "within") => {
        if (!points?.length) {
            return "";
        }
        return points
            .map((point, index) => {
                const yValue = point[seriesKey].y;
                return `${index === 0 ? "M" : "L"} ${point.x.toFixed(
                    2
                )} ${yValue.toFixed(2)}`;
            })
            .join(" ");
    };

    const upPath = buildPath("up");
    const downPath = buildPath("down");
    const withinPath = buildPath("within");

    if (!xs.length || !upPath || !downPath || !withinPath) {
        return (
            <div
                className={clsx(
                    "flex h-[220px] items-center justify-center rounded-xl border border-dashed border-gray-800 text-xs text-gray-500",
                    className
                )}
            >
                No curve data yet.
            </div>
        );
    }

    const yTicks = [0, 0.25, 0.5, 0.75, 1];
    const xTickCount = Math.min(xs.length, 8);
    const xTickIndexes = xs.length
        ? Array.from({ length: xTickCount }, (_, index) =>
              Math.round((index * (xs.length - 1)) / (xTickCount - 1 || 1))
          )
        : [];
    const hoverPoint = hoverIndex !== null ? points?.[hoverIndex] : null;

    return (
        <div className={clsx("space-y-3", className)}>
            <div className="relative h-[220px] w-full">
                <svg
                    viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                    width="100%"
                    height="100%"
                    className="h-full w-full"
                    role="img"
                    aria-label="Probability curve"
                    onMouseLeave={() => setHoverIndex(null)}
                    onMouseMove={(event) => {
                        if (!points?.length) {
                            return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        const scaleX = VIEWBOX_WIDTH / rect.width;
                        const cursorX =
                            (event.clientX - rect.left) * scaleX;
                        const clampedX = Math.min(
                            Math.max(cursorX, PADDING.left),
                            VIEWBOX_WIDTH - PADDING.right
                        );
                        const nearest = points.reduce(
                            (closest, point, index) => {
                                const distance = Math.abs(point.x - clampedX);
                                if (
                                    closest === null ||
                                    distance < closest.distance
                                ) {
                                    return { index, distance };
                                }
                                return closest;
                            },
                            null as null | { index: number; distance: number }
                        );
                        setHoverIndex(nearest ? nearest.index : null);
                    }}
                >
                    <rect
                        x="0"
                        y="0"
                        width={VIEWBOX_WIDTH}
                        height={VIEWBOX_HEIGHT}
                        rx="16"
                        className="fill-[#0b0d12]"
                    />
                    <g className="text-[10px] fill-gray-500">
                        {yTicks.map((tick) => {
                            const y =
                                PADDING.top +
                                (1 - tick) * chartHeight;
                            return (
                                <g key={`y-${tick}`}>
                                    <line
                                        x1={PADDING.left}
                                        x2={VIEWBOX_WIDTH - PADDING.right}
                                        y1={y}
                                        y2={y}
                                        className="stroke-gray-800/70"
                                    />
                                    {tick === 0 ||
                                    tick === 0.5 ||
                                    tick === 1 ? (
                                        <text
                                            x={PADDING.left - 12}
                                            y={y + 4}
                                            textAnchor="end"
                                        >
                                            {formatPercent(tick)}
                                        </text>
                                    ) : null}
                                </g>
                            );
                        })}
                    </g>
                    <g className="text-[10px] fill-gray-500">
                        {xTickIndexes.map((index) => {
                            const point = points[index];
                            if (!point) {
                                return null;
                            }
                            return (
                                <text
                                    key={`x-${point.xValue}-${index}`}
                                    x={point.x}
                                    y={VIEWBOX_HEIGHT - PADDING.bottom + 20}
                                    textAnchor="middle"
                                >
                                    {point.xValue}
                                </text>
                            );
                        })}
                    </g>
                    <path
                        d={withinPath}
                        className="stroke-sky-400"
                        strokeWidth={3}
                        fill="none"
                    />
                    <path
                        d={upPath}
                        className="stroke-emerald-400"
                        strokeWidth={3}
                        fill="none"
                    />
                    <path
                        d={downPath}
                        className="stroke-rose-400"
                        strokeWidth={3}
                        fill="none"
                    />
                    {points.map((point, index) => (
                        <g key={`point-${point.xValue}-${index}`}>
                            <circle
                                cx={point.x}
                                cy={point.within.y}
                                r={4}
                                className="fill-sky-400"
                            />
                            <circle
                                cx={point.x}
                                cy={point.up.y}
                                r={4}
                                className="fill-emerald-400"
                            />
                            <circle
                                cx={point.x}
                                cy={point.down.y}
                                r={4}
                                className="fill-rose-400"
                            />
                        </g>
                    ))}
                    {hoverPoint ? (
                        <g>
                            <line
                                x1={hoverPoint.x}
                                x2={hoverPoint.x}
                                y1={PADDING.top}
                                y2={VIEWBOX_HEIGHT - PADDING.bottom}
                                className="stroke-gray-700/70"
                                strokeDasharray="4 4"
                            />
                        </g>
                    ) : null}
                </svg>
                {hoverPoint ? (
                    <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-gray-800 bg-gray-950/90 px-3 py-2 text-xs text-gray-200 shadow-lg">
                        <p className="text-[11px] text-gray-400">
                            X: {hoverPoint.xValue}
                        </p>
                        <p>Up: {formatPercent(hoverPoint.up.value)}</p>
                        <p>Down: {formatPercent(hoverPoint.down.value)}</p>
                        <p>Within: {formatPercent(hoverPoint.within.value)}</p>
                    </div>
                ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Up ≥ X
                </span>
                <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-400" />
                    Down ≥ X
                </span>
                <span className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-sky-400" />
                    Within ±X
                </span>
            </div>
        </div>
    );
};

export default ProbabilityMiniCurve;
