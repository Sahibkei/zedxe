'use client';
import React, { memo } from 'react';
import useTradingViewWidget from "@/hooks/useTradingViewWidget";
import {cn} from "@/lib/utils";

interface TradingViewWidgetProps {
    title?: string;
    cspUrl?: string;
    scripUrl?: string;
    config: Record<string, unknown>;
    height?: number | string;
    className?: string;
}

const TradingViewWidget = ({ title, cspUrl, scripUrl, config, height, className}: TradingViewWidgetProps) => {
    const scriptUrl = cspUrl || scripUrl;
    const containerRef = useTradingViewWidget(scriptUrl, config, height ?? 600);

    return (
        <div className="h-full w-full">
            {title && <h3 className="font-semibold text-2xl text-gray-100 mb-5">{title}</h3>}
            <div
                className={cn('tradingview-widget-container tv-embed w-full', className)}
                ref={containerRef}
                style={height ? { height } : undefined}
            />
        </div>
    );
}

export default memo(TradingViewWidget);
