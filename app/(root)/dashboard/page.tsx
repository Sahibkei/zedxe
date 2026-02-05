import TradingViewWidget from '@/components/TradingViewWidget';
import MarketList from '@/components/dashboard/MarketList';
import MarketOverviewCard from '@/components/dashboard/MarketOverviewCard';
import { HEATMAP_WIDGET_CONFIG } from '@/lib/constants';
import { searchStocks } from '@/lib/actions/finnhub.actions';

const DashboardPage = async () => {
    const initialStocks = await searchStocks();
    const scriptUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-';

    return (
        <div className="min-h-screen bg-[#010409] text-slate-100">
            <div className="mx-auto w-full max-w-[1800px] px-4 pb-12 pt-24">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[460px_1fr]">
                    <section className="flex flex-col gap-4">
                        <div>
                            <h1 className="mb-3 text-xl font-semibold text-slate-100">Market Overview</h1>
                            <MarketOverviewCard />
                        </div>
                        <MarketList stocks={initialStocks} />
                    </section>

                    <section className="flex h-full flex-col gap-4">
                        <h2 className="text-xl font-semibold text-slate-100">Stock Heatmap</h2>
                        <div className="flex h-full min-h-[560px] flex-1 flex-col rounded-xl border border-[#1c2432] bg-[#0d1117] p-4">
                            <TradingViewWidget
                                scripUrl={`${scriptUrl}stock-heatmap.js`}
                                config={{ ...HEATMAP_WIDGET_CONFIG, height: '100%' }}
                                className="h-full"
                                height={560}
                            />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
