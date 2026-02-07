'use client';

import { useMemo } from 'react';
import TradingViewWidget from '@/components/TradingViewWidget';

const SCRIPT_URL = 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js';

type MarketOverviewTradingViewProps = {
    symbol: string;
    range: string;
};

const MarketOverviewTradingView = ({ symbol, range }: MarketOverviewTradingViewProps) => {
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
            <TradingViewWidget
                key={`${symbol}-${range}`}
                cspUrl={SCRIPT_URL}
                config={config}
                className="h-full w-full"
                height="100%"
            />
        </div>
    );
};

export default MarketOverviewTradingView;
