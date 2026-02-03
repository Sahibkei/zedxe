import { ReactNode } from "react";
import { Clock3, Maximize2, MoreHorizontal, Settings2, X } from "lucide-react";

import { cn } from "@/lib/utils";

type OpenBBWidgetShellProps = {
    title: string;
    symbol?: string;
    subtitle?: string;
    rightControls?: ReactNode;
    children: ReactNode;
    className?: string;
    height?: string | number;
    allowExpand?: boolean;
    allowClose?: boolean;
    allowSettings?: boolean;
};

function HeaderIcon({ children, label }: { children: ReactNode; label: string }) {
    return (
        <span
            aria-label={label}
            aria-disabled
            title="Coming soon"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-slate-200 opacity-60"
        >
            {children}
        </span>
    );
}

export function OpenBBWidgetShell({
    title,
    symbol,
    subtitle,
    rightControls,
    children,
    className,
    height,
    allowClose = true,
    allowExpand = true,
    allowSettings = true,
}: OpenBBWidgetShellProps) {
    return (
        <div
            className={cn(
                "group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0f141d] shadow-[0_10px_40px_rgba(0,0,0,0.55)]",
                className
            )}
            style={height ? { height } : undefined}
        >
            <div className="flex items-start justify-between gap-3 border-b border-white/5 px-4 py-3">
                <div className="flex items-start gap-3">
                    <span className="rounded-lg bg-amber-500/15 p-1.5 text-amber-300 ring-1 ring-amber-500/30">
                        <Clock3 className="h-4 w-4" />
                    </span>
                    <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-100">{title}</p>
                            {symbol && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-100">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-sky-500/20 text-[10px] text-sky-200">
                                        1
                                    </span>
                                    {symbol}
                                </span>
                            )}
                        </div>
                        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {rightControls && <div className="flex items-center gap-1">{rightControls}</div>}
                    {allowExpand && (
                        <HeaderIcon label="Expand widget">
                            <Maximize2 className="h-4 w-4" />
                        </HeaderIcon>
                    )}
                    {allowSettings && (
                        <HeaderIcon label="Widget settings">
                            <Settings2 className="h-4 w-4" />
                        </HeaderIcon>
                    )}
                    {allowClose && (
                        <HeaderIcon label="Close widget">
                            <X className="h-4 w-4" />
                        </HeaderIcon>
                    )}
                    {!allowExpand && !allowSettings && !allowClose && (
                        <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-slate-200 opacity-60"
                            aria-disabled
                            title="Coming soon"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </span>
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-hidden px-4 py-3 text-sm text-slate-100">{children}</div>
        </div>
    );
}

export default OpenBBWidgetShell;
