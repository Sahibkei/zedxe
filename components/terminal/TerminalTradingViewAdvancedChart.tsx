'use client';

import { useEffect, useRef } from 'react';

type TerminalTradingViewAdvancedChartProps = {
    symbol: string;
    interval: string;
    theme: 'dark' | 'light';
    className?: string;
};

const scriptUrl = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';

export default function TerminalTradingViewAdvancedChart({
    symbol,
    interval,
    theme,
    className = '',
}: TerminalTradingViewAdvancedChartProps) {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.innerHTML = '';

        const widget = document.createElement('div');
        widget.className = 'tradingview-widget-container__widget';
        widget.style.width = '100%';
        widget.style.height = '100%';
        container.appendChild(widget);

        const script = document.createElement('script');
        script.src = scriptUrl;
        script.async = true;
        script.type = 'text/javascript';
        script.innerHTML = JSON.stringify({
            autosize: true,
            symbol,
            interval,
            locale: 'en',
            timezone: 'Etc/UTC',
            theme,
            style: '1',
            allow_symbol_change: false,
            hide_top_toolbar: false,
            hide_side_toolbar: false,
            hide_legend: false,
            details: true,
            calendar: false,
            withdateranges: true,
            save_image: true,
            backgroundColor: theme === 'dark' ? '#07111f' : '#f8fbff',
            gridColor: theme === 'dark' ? '#1b2a44' : '#d5dfeb',
            watchlist: [],
            compareSymbols: [],
            studies: [],
            support_host: 'https://www.tradingview.com',
            width: '100%',
            height: '100%',
        });
        container.appendChild(script);

        return () => {
            container.innerHTML = '';
        };
    }, [interval, symbol, theme]);

    return (
        <div className={className}>
            <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
        </div>
    );
}
