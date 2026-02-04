import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import MetricStrip from "./MetricStrip";

type MetricItem = {
    label: string;
    value: string;
    subLabel?: string;
};

export default function StockHeroCard({
    companyName,
    symbol,
    subtitle,
    price,
    change,
    changeClassName,
    metricItems,
    actions,
    eyebrow = "Ticker Information",
    className,
}: {
    companyName: string;
    symbol: string;
    subtitle?: string;
    price: string;
    change?: string;
    changeClassName?: string;
    metricItems: MetricItem[];
    actions?: ReactNode;
    eyebrow?: string;
    className?: string;
}) {
    return (
        <section
            className={cn(
                "rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-xl backdrop-blur",
                className
            )}
        >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-4">
                    <p className="text-xs uppercase tracking-wide text-slate-400">{eyebrow}</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-3xl font-semibold text-slate-100">{companyName}</h1>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200">
                            {symbol}
                        </span>
                    </div>
                    {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
                    <div className="flex flex-wrap items-baseline gap-3">
                        <span className="text-4xl font-semibold text-slate-100">{price}</span>
                        {change ? (
                            <span
                                className={cn(
                                    "rounded-full px-3 py-1 text-sm font-semibold",
                                    changeClassName ?? "bg-white/10 text-slate-100"
                                )}
                            >
                                {change}
                            </span>
                        ) : null}
                    </div>
                    <MetricStrip items={metricItems} />
                </div>
                {actions ? (
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-3">
                        {actions}
                    </div>
                ) : null}
            </div>
        </section>
    );
}
