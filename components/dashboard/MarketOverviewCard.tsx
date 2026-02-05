'use client';

import { useState } from 'react';
import MarketOverviewTradingView from '@/components/dashboard/MarketOverviewTradingView';

const tabs = ['Financial', 'Technology', 'Services'] as const;
const ranges = ['1D', '1M', '3M', '1Y', '5Y', 'All'] as const;

type Range = (typeof ranges)[number];
type Tab = (typeof tabs)[number];

const symbolMap: Record<Tab, string> = {
    Financial: 'AMEX:XLF',
    Technology: 'AMEX:XLK',
    Services: 'AMEX:XLC',
};

const rangeMap: Record<Range, string> = {
    '1D': '1D',
    '1M': '1M',
    '3M': '3M',
    '1Y': '12M',
    '5Y': '60M',
    All: 'ALL',
};

const MarketOverviewCard = () => {
    const [activeTab, setActiveTab] = useState<Tab>('Financial');
    const [activeRange, setActiveRange] = useState<Range>('1Y');

    const symbol = symbolMap[activeTab];
    const range = rangeMap[activeRange];

    return (
        <div className="rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 rounded-full border border-[#1c2432] bg-[#0b0f14] p-1">
                    {tabs.map((tab) => {
                        const isActive = tab === activeTab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`rounded-full px-4 py-1 text-xs font-mono transition ${
                                    isActive ? 'bg-[#1c2432] text-white' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {tab}
                            </button>
                        );
                    })}
                </div>
                <span className="text-xs font-mono text-slate-500">{activeTab} sector</span>
            </div>

            <div className="mt-4 h-[260px] w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="h-full w-full">
                    <MarketOverviewTradingView symbol={symbol} range={range} />
                </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {ranges.map((rangeOption) => {
                    const isActive = rangeOption === activeRange;
                    return (
                        <button
                            key={rangeOption}
                            type="button"
                            onClick={() => setActiveRange(rangeOption)}
                            className={`rounded-full border px-3 py-1 text-xs font-mono transition ${
                                isActive
                                    ? 'border-[#1c2432] bg-[#1c2432] text-white'
                                    : 'border-transparent bg-[#0b0f14] text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {rangeOption}
                        </button>
                    );
                })}
            </div>
            {process.env.NODE_ENV !== 'production' ? (
                <p className="mt-3 text-xs font-mono text-slate-500">Market overview data sourced via TradingView.</p>
            ) : null}
        </div>
    );
};

export default MarketOverviewCard;
