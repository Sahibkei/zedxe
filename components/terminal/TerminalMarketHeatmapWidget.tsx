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
            background: `linear-gradient(180deg, color-mix(in srgb, var(--terminal-up) ${18 + intensity * 18}%, var(--terminal-panel-soft)), color-mix(in srgb, var(--terminal-up) ${10 + intensity * 8}%, var(--terminal-panel)))`,
            borderColor: `color-mix(in srgb, var(--terminal-up) ${28 + intensity * 28}%, var(--terminal-border))`,
        };
    }

    return {
        background: `linear-gradient(180deg, color-mix(in srgb, var(--terminal-down) ${18 + intensity * 18}%, var(--terminal-panel-soft)), color-mix(in srgb, var(--terminal-down) ${10 + intensity * 8}%, var(--terminal-panel)))`,
        borderColor: `color-mix(in srgb, var(--terminal-down) ${28 + intensity * 28}%, var(--terminal-border))`,
    };
};

const toExpandedTileStyle = (changePercent: number | null) => {
    if (typeof changePercent !== 'number' || !Number.isFinite(changePercent)) {
        return {
            background:
                'linear-gradient(145deg, color-mix(in srgb, var(--terminal-panel-soft) 96%, transparent), color-mix(in srgb, var(--terminal-panel) 98%, transparent))',
            borderColor: 'color-mix(in srgb, var(--terminal-border-strong) 80%, var(--terminal-border))',
        };
    }

    const intensity = Math.min(Math.abs(changePercent) / 3, 1);
    const colorVar = changePercent >= 0 ? 'var(--terminal-up)' : 'var(--terminal-down)';

    return {
        background: `linear-gradient(145deg, color-mix(in srgb, ${colorVar} ${26 + intensity * 26}%, var(--terminal-panel-soft)), color-mix(in srgb, ${colorVar} ${14 + intensity * 20}%, var(--terminal-panel)))`,
        borderColor: `color-mix(in srgb, ${colorVar} ${48 + intensity * 34}%, var(--terminal-border))`,
    };
};

const tileSpanClass = (changePercent: number | null) => {
    if (typeof changePercent !== 'number' || !Number.isFinite(changePercent)) return 'col-span-1';
    return Math.abs(changePercent) >= 3 ? 'col-span-2' : 'col-span-1';
};

const expandedMosaicClass = (index: number, total: number) => {
    if (total <= 2) return 'terminal-heatmap-tile-span-6 terminal-heatmap-tile-row-3';
    if (total === 3) return 'terminal-heatmap-tile-span-4 terminal-heatmap-tile-row-3';
    if (total === 4) return 'terminal-heatmap-tile-span-3 terminal-heatmap-tile-row-3';
    if (total === 5) return `${index >= 3 ? 'terminal-heatmap-tile-span-6' : 'terminal-heatmap-tile-span-4'} terminal-heatmap-tile-row-2`;
    if (total === 6) return 'terminal-heatmap-tile-span-4 terminal-heatmap-tile-row-2';
    if (total === 7) return `${index >= 4 ? 'terminal-heatmap-tile-span-4' : 'terminal-heatmap-tile-span-3'} terminal-heatmap-tile-row-2`;
    if (total === 8) return 'terminal-heatmap-tile-span-3 terminal-heatmap-tile-row-2';
    if (total % 4 === 3 && index >= total - 3) return 'terminal-heatmap-tile-span-4 terminal-heatmap-tile-row-2';
    if (total % 4 === 2 && index >= total - 2) return 'terminal-heatmap-tile-span-6 terminal-heatmap-tile-row-2';
    return 'terminal-heatmap-tile-span-3 terminal-heatmap-tile-row-2';
};

type Props = {
    groups: TerminalHeatmapGroup[];
    expanded?: boolean;
};

const TerminalMarketHeatmapWidget = ({ groups, expanded = false }: Props) => {
    const availableGroups = useMemo(() => groups.filter((group) => group.items.length > 0), [groups]);
    const [activeGroupKey, setActiveGroupKey] = useState<string>(availableGroups[0]?.key ?? groups[0]?.key ?? 'default');

    const activeGroup =
        availableGroups.find((group) => group.key === activeGroupKey) ?? groups.find((group) => group.key === activeGroupKey) ?? groups[0];

    if (!activeGroup) {
        return <div className="flex h-full items-center justify-center text-sm terminal-muted">No heatmap data available.</div>;
    }

    return (
        <div className={cn('flex h-full min-h-0 flex-col', expanded && 'terminal-heatmap-expanded')}>
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

            <div className={cn('min-h-0 flex-1 p-2.5', expanded && 'terminal-heatmap-expanded-body')}>
                <div
                    className={cn(
                        'grid gap-2',
                        expanded ? 'terminal-heatmap-grid-expanded' : 'auto-rows-[112px] grid-cols-2 xl:grid-cols-4'
                    )}
                >
                    {activeGroup.items.map((item, index) => {
                        const style = expanded ? toExpandedTileStyle(item.changePercent) : toTileStyle(item.changePercent);
                        const spanClass = expanded ? expandedMosaicClass(index, activeGroup.items.length) : tileSpanClass(item.changePercent);
                        const tileContent = (
                            <div
                                className={cn(
                                    'flex h-full min-w-0 flex-col justify-between rounded-xl border transition-transform duration-150 hover:-translate-y-[1px]',
                                    expanded ? 'min-h-0 p-4' : 'min-h-[112px] p-3'
                                )}
                                style={style}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className={cn('truncate font-semibold', expanded ? 'text-sm sm:text-base' : 'text-sm')}>{item.label}</p>
                                        <p className="truncate text-[11px] uppercase tracking-[0.08em] terminal-muted">{item.sublabel}</p>
                                    </div>
                                    <span className={cn('text-xs font-semibold', typeof item.changePercent === 'number' ? (item.changePercent >= 0 ? 'terminal-up' : 'terminal-down') : 'terminal-muted')}>
                                        {formatChange(item.changePercent)}
                                    </span>
                                </div>
                                <div>
                                    <p className={cn('font-semibold', expanded ? 'text-xl sm:text-2xl' : 'text-lg')}>{formatValue(item.price)}</p>
                                    <p className="mt-1 text-xs terminal-muted">{item.symbol}</p>
                                </div>
                            </div>
                        );

                        return item.href ? (
                            <Link key={item.key} href={item.href} prefetch={false} className={cn('block', spanClass)}>
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
