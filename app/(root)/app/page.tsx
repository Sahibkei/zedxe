import TradingViewWidget from "@/components/TradingViewWidget";
import {
    HEATMAP_WIDGET_CONFIG,
    MARKET_OVERVIEW_WIDGET_CONFIG,
    TOP_STORIES_WIDGET_CONFIG,
} from "@/lib/constants";
import SectionCard from "@/src/components/ui/SectionCard";

const Home = () => {
    const scriptUrl = `https://s3.tradingview.com/external-embedding/embed-widget-`;
    const summaryCards = [
        { label: "Total Market Cap", value: "—" },
        { label: "Advancers", value: "—" },
        { label: "Decliners", value: "—" },
    ];
    return (
        <div className="space-y-8">
            <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Dashboard</p>
                <h1 className="text-2xl font-semibold text-slate-100">Market Overview</h1>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {summaryCards.map((card) => (
                    <div
                        key={card.label}
                        className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-lg"
                    >
                        <p className="text-xs uppercase tracking-wide text-slate-400">{card.label}</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-100">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <SectionCard eyebrow="Markets" title="Market Indices">
                    <TradingViewWidget
                        title="Market Overview"
                        scripUrl={`${scriptUrl}market-overview.js`}
                        config={MARKET_OVERVIEW_WIDGET_CONFIG}
                        className="custom-chart"
                        height={460}
                    />
                </SectionCard>

                <SectionCard eyebrow="Market" title="Top Movers">
                    <div className="overflow-x-auto rounded-xl border border-white/10">
                        <table className="min-w-[520px] w-full text-sm text-slate-200">
                            <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                                <tr>
                                    <th className="px-3 py-2">Symbol</th>
                                    <th className="px-3 py-2">Price</th>
                                    <th className="px-3 py-2 text-right">Change</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from({ length: 5 }).map((_, index) => (
                                    <tr key={`mover-${index}`} className="border-t border-white/10">
                                        <td className="px-3 py-2 text-slate-100">—</td>
                                        <td className="px-3 py-2 text-slate-300">—</td>
                                        <td className="px-3 py-2 text-right text-slate-300">—</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </SectionCard>
            </div>

            <SectionCard eyebrow="Market" title="Stock Heatmap">
                <TradingViewWidget
                    title="Stock Heatmap"
                    scripUrl={`${scriptUrl}stock-heatmap.js`}
                    config={HEATMAP_WIDGET_CONFIG}
                    height={520}
                />
            </SectionCard>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
                <SectionCard eyebrow="News" title="Top Stories">
                    <TradingViewWidget
                        scripUrl={`${scriptUrl}timeline.js`}
                        config={TOP_STORIES_WIDGET_CONFIG}
                        className="custom-chart"
                        height={520}
                    />
                </SectionCard>

                <SectionCard eyebrow="Markets" title="Quotes">
                    <TradingViewWidget
                        scripUrl={`${scriptUrl}market-quotes.js`}
                        config={MARKET_OVERVIEW_WIDGET_CONFIG}
                        height={520}
                    />
                </SectionCard>
            </div>
        </div>
    );
};
export default Home;
