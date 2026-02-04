import { cn } from "@/lib/utils";

type StatItem = {
    label: string;
    value: string;
    subLabel?: string;
};

export default function CompanyStatsGrid({
    title = "Company Statistics",
    items,
    className,
}: {
    title?: string;
    items: StatItem[];
    className?: string;
}) {
    return (
        <section className={cn("rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg backdrop-blur", className)}>
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Company</p>
                    <h2 className="text-lg font-semibold text-slate-100">{title}</h2>
                </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                    <div
                        key={item.label}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                        <p className="text-xs uppercase tracking-wide text-slate-400">{item.label}</p>
                        <p className="mt-1 text-base font-semibold text-slate-100">{item.value}</p>
                        {item.subLabel ? <p className="text-xs text-slate-500">{item.subLabel}</p> : null}
                    </div>
                ))}
            </div>
        </section>
    );
}
