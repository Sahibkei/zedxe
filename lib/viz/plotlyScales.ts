export const WIN_PROB_COLORSCALE: Array<[number, string]> = [
    [0, "#0b1320"],
    [0.55, "#0ea5e9"],
    [1, "#22c55e"],
];

export const MEAN_FWD_DIVERGING_COLORSCALE: Array<[number, string]> = [
    [0, "#ef4444"],
    [0.5, "#0b0f14"],
    [1, "#22c55e"],
];

const quantile = (values: number[], q: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    if (next === undefined) return sorted[base];
    return sorted[base] + rest * (next - sorted[base]);
};

/**
 * Format a range label based on units.
 * @param a - Range start value.
 * @param b - Range end value.
 * @param kind - Output units (percent or basis points).
 * @param decimals - Decimal precision.
 * @returns Range label string.
 */
export const formatRangeLabel = (
    a: number,
    b: number,
    kind: "pct" | "bps",
    decimals: number
) => {
    if (kind === "bps") {
        const start = (a * 10000).toFixed(decimals);
        const end = (b * 10000).toFixed(decimals);
        return `${start}bp..${end}bp`;
    }
    const start = (a * 100).toFixed(decimals);
    const end = (b * 100).toFixed(decimals);
    return `${start}%..${end}%`;
};

/**
 * Format a decimal value as a percent string.
 * @param x - Decimal value.
 * @param decimals - Decimal precision.
 * @returns Percent string.
 */
export const formatPct = (x: number, decimals: number) => `${(x * 100).toFixed(decimals)}%`;

/**
 * Compute symmetric z-range based on percentile of absolute values.
 * @param values - Values to analyze.
 * @param p - Percentile cutoff.
 * @returns Symmetric z-range.
 */
export const robustSymmetricRange = (values: number[], p = 0.98) => {
    const finite = values.filter((value) => Number.isFinite(value));
    if (!finite.length) {
        return { zmin: -1, zmax: 1 };
    }
    const absValues = finite.map((value) => Math.abs(value));
    const maxAbs = quantile(absValues, p) || Math.max(...absValues);
    return { zmin: -maxAbs, zmax: maxAbs };
};
