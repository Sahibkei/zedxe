import clsx from "clsx";

const DEFAULT_HEIGHT = 140;
const DEFAULT_WIDTH = 320;

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

const buildPath = (
    xs: number[],
    series: number[],
    width: number,
    height: number
) => {
    if (!xs.length || xs.length !== series.length) {
        return "";
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const spanX = maxX - minX || 1;

    return series
        .map((value, index) => {
            const x = ((xs[index] - minX) / spanX) * width;
            const y = height - clamp01(value) * height;
            return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
        })
        .join(" ");
};

const ProbabilityMiniCurve = ({
    surface,
    className,
}: ProbabilityMiniCurveProps) => {
    const { xs, up, down, within } = surface;
    const width = DEFAULT_WIDTH;
    const height = DEFAULT_HEIGHT;
    const upPath = buildPath(xs, up, width, height);
    const downPath = buildPath(xs, down, width, height);
    const withinPath = buildPath(xs, within, width, height);

    if (!xs.length || !upPath || !downPath || !withinPath) {
        return (
            <div
                className={clsx(
                    "flex h-32 items-center justify-center rounded-xl border border-dashed border-gray-800 text-xs text-gray-500",
                    className
                )}
            >
                No curve data yet.
            </div>
        );
    }

    return (
        <div className={clsx("space-y-3", className)}>
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="h-36 w-full"
                role="img"
                aria-label="Probability curve"
            >
                <rect
                    x="0"
                    y="0"
                    width={width}
                    height={height}
                    rx="12"
                    className="fill-[#0b0d12]"
                />
                <path
                    d={withinPath}
                    className="stroke-sky-400"
                    strokeWidth={2}
                    fill="none"
                />
                <path
                    d={upPath}
                    className="stroke-emerald-400"
                    strokeWidth={2}
                    fill="none"
                />
                <path
                    d={downPath}
                    className="stroke-rose-400"
                    strokeWidth={2}
                    fill="none"
                />
            </svg>
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
