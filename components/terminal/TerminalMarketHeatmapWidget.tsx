'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type TerminalHeatmapItem = {
    key: string;
    symbol: string;
    label: string;
    sublabel: string;
    price: number | null;
    changePercent: number | null;
    href?: string;
};

export type TerminalHeatmapGroup = {
    key: string;
    label: string;
    items: TerminalHeatmapItem[];
};

const formatValue = (value: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
    return value >= 1000 ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : value.toFixed(2);
};

const formatChange = (value: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const toTileStyle = (changePercent: number | null) => {
    if (typeof changePercent !== 'number' || !Number.isFinite(changePercent)) {
        return {
            background:
                'linear-gradient(180deg, color-mix(in srgb, var(--terminal-panel-soft) 92%, transparent), color-mix(in srgb, var(--terminal-panel) 96%, transparent))',
            borderColor: 'color-mix(in srgb, var(--terminal-border) 88%, transparent)',
        };
    }

    const intensity = Math.min(Math.abs(changePercent) / 6, 1);
    if (changePercent >= 0) {
        return {
            background: `linear-gradient(180deg, rgba(20, 135, 95, ${0.18 + intensity * 0.18}), rgba(10, 31, 29, 0.92))`,
            borderColor: `rgba(42, 181, 122, ${0.32 + intensity * 0.3})`,
        };
    }

    return {
        background: `linear-gradient(180deg, rgba(153, 55, 53, ${0.18 + intensity * 0.2}), rgba(34, 13, 19, 0.92))`,
        borderColor: `rgba(219, 86, 84, ${0.32 + intensity * 0.3})`,
    };
};

const tileSpanClass = (changePercent: number | null) => {
    if (typeof changePercent !== 'number' || !Number.isFinite(changePercent)) return 'col-span-1';
    return Math.abs(changePercent) >= 3 ? 'col-span-2' : 'col-span-1';
};

const TerminalMarketHeatmapWidget = ({ groups }: { groups: TerminalHeatmapGroup[] }) => {
    const availableGroups = useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);
    const [activeGroupKey, setActiveGroupKey] = useState<string>(availableGroups[0]?.key ?? groups[0]?.key ?? 'default');

    const activeGroup =
        availableGroups.find((group) => group.key === activeGroupKey) ?? groups.find((group) => group.key === activeGroupKey) ?? groups[0];

    if (!activeGroup) {
        return <div className="flex h-full items-center justify-center text-sm terminal-muted">No heatmap data available.</div>;
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-wrap items-center gap-1 border-b border-[var(--terminal-border)] px-2.5 py-2">
                {groups.map((group) => (
                    <button
                        key={group.key}
                        type="button"
                        onClick={() => setActiveGroupKey(group.key)}
                        className={cn('terminal-mini-btn', activeGroup.key === group.key && 'terminal-mini-btn-active')}
                    >
                        {group.label}
                    </button>
                ))}
            </div>

            <div className="min-h-0 flex-1 p-2.5">
                <div className="grid auto-rows-[112px] grid-cols-2 gap-2 xl:grid-cols-4">
                    {activeGroup.items.map((item) => {
                        const style = toTileStyle(item.changePercent);
                        const spanClass = tileSpanClass(item.changePercent);
                        const tileContent = (
                            <div
                                className="flex h-full min-h-[112px] flex-col justify-between rounded-xl border p-3 transition-transform duration-150 hover:-translate-y-[1px]"
                                style={style}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{item.label}</p>
                                        <p className="truncate text-[11px] uppercase tracking-[0.08em] terminal-muted">{item.sublabel}</p>
                                    </div>
                                    <span className={cn('text-xs font-semibold', typeof item.changePercent === 'number' ? (item.changePercent >= 0 ? 'terminal-up' : 'terminal-down') : 'terminal-muted')}>
                                        {formatChange(item.changePercent)}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-lg font-semibold">{formatValue(item.price)}</p>
                                    <p className="mt-1 text-xs terminal-muted">{item.symbol}</p>
                                </div>
                            </div>
                        );

                        return item.href ? (
                            <Link key={item.key} href={item.href} className={cn('block', spanClass)}>
                                {tileContent}
                            </Link>
                        ) : (
                            <div key={item.key} className={spanClass}>
                                {tileContent}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TerminalMarketHeatmapWidget;
