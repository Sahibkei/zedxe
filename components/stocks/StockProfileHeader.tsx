import { cn } from "@/lib/utils";
import type { StockProfileHeader as StockProfileHeaderModel } from "@/src/features/stock-profile-v2/contract/types";

const formatPrice = (value: number) =>
    value.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const StockProfileHeader = ({ header, className }: { header: StockProfileHeaderModel; className?: string }) => {
    const hasChange = typeof header.change === "number" && typeof header.changePct === "number";
    const isPositive = hasChange ? header.change >= 0 : true;
    const badgeClasses = isPositive
        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
        : "bg-rose-500/15 text-rose-300 border-rose-500/40";
    const changePrefix = isPositive ? "+" : "";
    const priceDisplay = typeof header.price === "number" ? formatPrice(header.price) : "—";

    const statusClass =
        header.status === "Live"
            ? "border-emerald-500/40 text-emerald-300"
            : header.status === "Delayed"
              ? "border-amber-500/40 text-amber-300"
              : "border-slate-500/40 text-slate-300";

    return (
        <div className={cn("rounded-2xl border border-[#1c2432] bg-[#0d1117]/80 px-6 py-5 shadow-xl backdrop-blur", className)}>
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-mono uppercase tracking-wide text-slate-500">Stock Profile</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl font-semibold text-slate-100">
                            {header.symbol}
                            <span className="ml-2 text-base font-normal text-slate-400">{header.name}</span>
                        </h1>
                        <span
                            className={cn(
                                "rounded-full border bg-[#0b0f14] px-2.5 py-1 text-xs font-mono",
                                statusClass,
                            )}
                        >
                            {header.status}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-2xl font-semibold text-slate-100">{priceDisplay}</p>
                        <p className="text-sm text-slate-500">Last trade</p>
                    </div>
                    <div
                        className={cn(
                            "rounded-xl border px-3 py-2 text-sm font-mono",
                            hasChange ? badgeClasses : "border-[#1c2432] text-slate-400",
                        )}
                    >
                        {hasChange ? (
                            <>
                                <span>
                                    {changePrefix}
                                    {header.change.toFixed(2)}
                                </span>
                                <span className="ml-2">
                                    ({changePrefix}
                                    {header.changePct.toFixed(2)}%)
                                </span>
                            </>
                        ) : (
                            <span>—</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockProfileHeader;
