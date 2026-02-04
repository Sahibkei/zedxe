import { cn } from "@/lib/utils";

type MetricItem = {
    label: string;
    value: string;
    subLabel?: string;
};

export default function MetricStrip({ items, className }: { items: MetricItem[]; className?: string }) {
    return (
        <div className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}>
            {items.map((item) => (
                <div
                    key={item.label}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                >
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-100">{item.value}</p>
                    {item.subLabel ? <p className="text-xs text-slate-500">{item.subLabel}</p> : null}
                </div>
            ))}
        </div>
    );
}
