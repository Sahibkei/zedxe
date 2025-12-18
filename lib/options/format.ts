export function formatNumber(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined) return '--';
    if (!Number.isFinite(value)) return '--';
    return value.toFixed(decimals);
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined) return '--';
    if (!Number.isFinite(value)) return '--';
    return `${value.toFixed(decimals)}%`;
}
