import { DASH_VALUE } from "@/components/stock-profile/formatters";

type MetricItem = {
    label: string;
    value: string;
};

type MetricGroup = {
    title: string;
    items: MetricItem[];
};

type KeyMetricsGridProps = {
    groups: MetricGroup[];
};

function MetricGroupCard({ title, items }: MetricGroup) {
    const validItems = items.filter((item) => item.value && item.value !== DASH_VALUE);

    return (
        <div className="rounded-xl border border-border/70 bg-[#0d151f] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
            {validItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Data unavailable</p>
            ) : (
                <dl className="grid grid-cols-1 gap-2 text-sm">
                    {validItems.map((item) => (
                        <div key={item.label} className="flex items-baseline justify-between gap-3 rounded-md border border-border/40 bg-muted/10 px-2.5 py-2">
                            <dt className="text-xs text-muted-foreground">{item.label}</dt>
                            <dd className="text-right font-semibold text-foreground tabular-nums">{item.value}</dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    );
}

export default function KeyMetricsGrid({ groups }: KeyMetricsGridProps) {
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-foreground">Key Metrics</h3>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Available fundamentals only</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
                {groups.map((group) => (
                    <MetricGroupCard key={group.title} {...group} />
                ))}
            </div>
        </section>
    );
}
