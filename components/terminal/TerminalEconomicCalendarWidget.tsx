'use client';

import { useEffect, useMemo, useState } from 'react';
import TradingViewWidget from '@/components/TradingViewWidget';

const SCRIPT_URL = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';

const readTerminalTheme = () => {
    if (typeof document === 'undefined') return 'light';
    const element = document.querySelector('.terminal-shell');
    return element?.getAttribute('data-terminal-theme') === 'dark' ? 'dark' : 'light';
};

const TerminalEconomicCalendarWidget = () => {
    const [theme, setTheme] = useState<'dark' | 'light'>(() => readTerminalTheme());

    useEffect(() => {
        const element = document.querySelector('.terminal-shell');
        if (!element) return;

        const observer = new MutationObserver(() => {
            setTheme(readTerminalTheme());
        });

        observer.observe(element, { attributes: true, attributeFilter: ['data-terminal-theme'] });
        return () => observer.disconnect();
    }, []);

    const config = useMemo(
        () => ({
            colorTheme: theme,
            isTransparent: false,
            width: '100%',
            height: '100%',
            locale: 'en',
            importanceFilter: '-1,0,1',
            countryFilter: 'us,eu,gb,jp,cn,au,ca',
            currencyFilter: 'USD,EUR,GBP,JPY,CNY,AUD,CAD',
        }),
        [theme]
    );

    return (
        <div className="h-full min-h-0 p-2">
            <TradingViewWidget
                cspUrl={SCRIPT_URL}
                config={config}
                height="100%"
                className="terminal-economic-calendar h-full w-full rounded border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]"
            />
        </div>
    );
};

export default TerminalEconomicCalendarWidget;
