'use client';
import React, { memo } from 'react';
import useTradingViewWidget from "@/hooks/useTradingViewWidget";
import {cn} from "@/lib/utils";

interface TradingViewWidgetProps {
    title?: string;
    scripUrl: string;
    config: Record<string, unknown>;
    height?: number;
    className?: string;
}

const TradingViewWidget = ({ title, scripUrl, config, height, className}: TradingViewWidgetProps) => {
    const containerRef = useTradingViewWidget(scripUrl, config, height ?? 600);

    return (
        <div className="w-full">
            {title && <h3 className="font-semibold text-2xl text-gray-100 mb-5">{title}</h3>}
            <div
                className={cn('tradingview-widget-container w-full', className)}
                ref={containerRef}
                style={height ? { height } : undefined}
            >
                <div className="tradingview-widget-container__widget w-full" />
            </div>
        </div>
    );
}

export default memo(TradingViewWidget);
