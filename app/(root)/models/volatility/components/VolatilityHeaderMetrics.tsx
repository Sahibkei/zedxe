"use client";

const formatNumber = (value: number | null, options?: Intl.NumberFormatOptions) => {
    if (value === null || !Number.isFinite(value)) {
        return "--";
    }
    return new Intl.NumberFormat("en-US", options).format(value);
};

const formatPercent = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) {
        return "--";
    }
    return `${(value * 100).toFixed(2)}%`;
};

const formatUpdatedLabel = (value?: string) => {
    if (!value) return "--";
    const updated = new Date(value).getTime();
    if (!Number.isFinite(updated)) return "--";
    const deltaMs = Date.now() - updated;
    const deltaMinutes = Math.floor(deltaMs / 60000);
    if (deltaMinutes < 1) return "just now";
    if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
    const deltaHours = Math.floor(deltaMinutes / 60);
    if (deltaHours < 24) return `${deltaHours}h ago`;
    const deltaDays = Math.floor(deltaHours / 24);
    return `${deltaDays}d ago`;
};

type VolatilityHeaderMetricsProps = {
    spot: number | null;
    rv: number | null;
    skew: number | null;
    kurt: number | null;
    updatedAt?: string;
};

export default function VolatilityHeaderMetrics({
    spot,
    rv,
    skew,
    kurt,
    updatedAt,
}: VolatilityHeaderMetricsProps) {
    const metrics = [
        {
            label: "Spot",
            value: formatNumber(spot, {
                maximumFractionDigits: 2,
            }),
        },
        {
            label: "RV (30d)",
            value: formatPercent(rv),
        },
        {
            label: "Skew",
            value: formatNumber(skew, { maximumFractionDigits: 4 }),
        },
        {
            label: "Kurt",
            value: formatNumber(kurt, { maximumFractionDigits: 4 }),
        },
        {
            label: "Updated",
            value: formatUpdatedLabel(updatedAt),
        },
    ];

    return (
        <div className="grid gap-4 rounded-2xl border border-emerald-500/10 bg-[#0b0f14] p-5 text-sm text-slate-200 shadow-xl shadow-black/30 md:grid-cols-5">
            {metrics.map((metric) => (
                <div key={metric.label} className="space-y-1">
                    <p className="text-xs uppercase tracking-wide text-emerald-200/70">
                        {metric.label}
                    </p>
                    <p className="text-lg font-semibold text-white">
                        {metric.value}
                    </p>
                </div>
            ))}
        </div>
    );
}
