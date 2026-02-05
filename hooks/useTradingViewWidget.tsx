'use client';
import { useEffect, useRef } from 'react';

const useTradingViewWidget = (scriptUrl: string, config: Record<string, unknown>, height: number | string = 600) => {
    const containerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
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
        script.innerHTML = JSON.stringify({ ...config, width: '100%', height });
        container.appendChild(script);

        return () => {
            container.innerHTML = '';
        };
    }, [scriptUrl, config, height]);

    return containerRef;
};

export default useTradingViewWidget;
