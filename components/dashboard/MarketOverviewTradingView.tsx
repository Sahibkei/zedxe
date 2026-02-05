'use client';

import { useEffect, useMemo, useState } from 'react';
import TradingViewWidget from '@/components/TradingViewWidget';

const SCRIPT_URL = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';

type MarketOverviewTradingViewProps = {
    symbol: string;
    range: string;
    height?: number;
};

const MarketOverviewTradingView = ({ symbol, range, height = 160 }: MarketOverviewTradingViewProps) => {
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const timer = setTimeout(() => setIsLoading(false), 800);
        return () => clearTimeout(timer);
    }, [symbol, range]);

    const config = useMemo(
        () => ({
            symbols: [[symbol]],
            dateRange: range,
            locale: 'en',
            colorTheme: 'dark',
            isTransparent: true,
            autosize: true,
            showVolume: false,
            showMA: false,
            hideDateRanges: true,
            hideMarketStatus: true,
            hideSymbolLogo: true,
            scalePosition: 'right',
            scaleMode: 'Normal',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '12',
            noTimeScale: false,
            valuesTracking: '1',
            changeMode: 'price-and-percent',
            chartType: 'area',
            lineWidth: 2,
            lineType: 0,
        }),
        [symbol, range]
    );

    return (
        <div className="relative h-full w-full">
            {isLoading ? (
                <div className="absolute inset-0 flex items-center justify-center rounded-md border border-[#1c2432] bg-[#0d1117] text-xs font-mono text-slate-500">
                    <span className="animate-pulse">Loading market data...</span>
                </div>
            ) : null}
            <div className={isLoading ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}>
                <TradingViewWidget
                    key={`${symbol}-${range}`}
                    scripUrl={SCRIPT_URL}
                    config={config}
                    className="h-full w-full"
                    height={height}
                />
            </div>
        </div>
    );
};

export default MarketOverviewTradingView;
