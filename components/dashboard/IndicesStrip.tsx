import { GLOBAL_MARKET_INDEXES } from "@/lib/market/global-indices";
import type { MarketQuote } from "@/lib/market/providers";

const formatValue = (value?: number) => (typeof value === "number" ? value.toLocaleString("en-US") : "--");

const formatChange = (value?: number) => (typeof value === "number" ? value.toFixed(2) : "--");

const IndicesStrip = ({ quotes }: { quotes: Record<string, MarketQuote | null> }) => {
    const renderItem = (index: (typeof GLOBAL_MARKET_INDEXES)[number], key: string) => {
        const quote = quotes[index.symbol.toUpperCase()] ?? null;
        const change = quote?.d;
        const changePercent = quote?.dp;
        const hasChangePercent = typeof changePercent === "number";
        const isPositive = hasChangePercent ? changePercent >= 0 : false;
        const toneClass = hasChangePercent ? (isPositive ? "text-[#00d395]" : "text-[#ff6b6b]") : "text-slate-400";
        const sign = hasChangePercent ? (isPositive ? "+" : "") : "";

        return (
            <article
                key={key}
                tabIndex={0}
                className="indices-marquee-item bento-panel flex min-w-[230px] cursor-pointer flex-col gap-2 px-4 py-3 transition-all duration-200 hover:border-[#4a6ea5] hover:bg-[#131f33]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4a6ea5]/40"
            >
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="truncate text-[11px] uppercase tracking-[0.14em] text-slate-500">{index.region}</p>
                        <p className="truncate text-sm font-semibold text-slate-100">{index.label}</p>
                    </div>
                    <span className="rounded-full border border-[#273042] bg-[#101826] px-2 py-0.5 text-xs font-mono text-slate-300">
                        {index.ticker}
                    </span>
                </div>
                <div className="flex items-end justify-between gap-2">
                    <span className="text-lg font-semibold text-slate-100">{formatValue(quote?.c)}</span>
                    <div className="text-right">
                        <div className={`text-xs font-mono ${toneClass}`}>
                            {hasChangePercent && typeof change === "number" ? `${sign}${formatChange(change)}` : "--"}
                        </div>
                        <div className={`text-xs font-mono ${toneClass}`}>
                            {hasChangePercent ? `${sign}${changePercent.toFixed(2)}%` : "--"}
                        </div>
                    </div>
                </div>
            </article>
        );
    };

    return (
        <section className="bento-card-soft indices-marquee-wrapper" aria-label="Live market index ticker">
            <div className="indices-marquee">
                <div className="indices-marquee-track">
                    <div className="indices-marquee-group">{GLOBAL_MARKET_INDEXES.map((index) => renderItem(index, index.symbol))}</div>
                    <div className="indices-marquee-group" aria-hidden="true">
                        {GLOBAL_MARKET_INDEXES.map((index) => renderItem(index, `${index.symbol}-clone`))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default IndicesStrip;
