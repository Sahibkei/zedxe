'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Newspaper, ArrowLeftToLine, FileBarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TERMINAL_ITEMS = [
    { href: '/terminal/dashboard', label: "Today's Markets", icon: LayoutDashboard, code: 'NOW' },
    { href: '/terminal/advance-analytics?symbol=NVDA', label: 'Advance Analytics', icon: FileBarChart2, code: 'ANL' },
    { href: '/terminal/news-terminal', label: 'Market News', icon: Newspaper, code: 'TOP' },
];

type Props = {
    collapsed: boolean;
};

const TerminalSidebar = ({ collapsed }: Props) => {
    const pathname = usePathname();

    return (
        <aside className={cn('terminal-sidebar', collapsed && 'terminal-sidebar-hidden')}>
            <div className="space-y-5">
                <div>
                    {!collapsed ? (
                        <>
                            <Image src="/brand/zedxe-logo.svg" alt="ZedXe" width={120} height={32} className="h-7 w-auto" priority />
                            <h1 className="mt-2 text-4xl font-semibold leading-none">Terminal</h1>
                            <p className="mt-2 text-xs terminal-side-muted">Advanced market workspace</p>
                        </>
                    ) : (
                        <div className="terminal-side-mini-mark">ZX</div>
                    )}
                </div>

                <nav className="space-y-2">
                    {TERMINAL_ITEMS.map((item) => {
                        const itemPath = item.href.split('?')[0];
                        const active = pathname === itemPath || pathname.startsWith(`${itemPath}/`);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                prefetch={false}
                                className={cn(
                                    'terminal-side-link',
                                    active
                                        ? 'terminal-side-link-active'
                                        : 'terminal-side-link-idle',
                                    collapsed && 'terminal-side-link-collapsed'
                                )}
                                aria-label={item.label}
                                title={item.label}
                            >
                                <span className="flex items-center gap-2.5 text-sm font-semibold">
                                    <Icon className="h-4 w-4" />
                                    {!collapsed ? item.label : null}
                                </span>
                                {!collapsed ? <span className="terminal-side-code">{item.code}</span> : null}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="space-y-3">
                <Link
                    href="/app"
                    prefetch={false}
                    className={cn('terminal-side-back', collapsed && 'terminal-side-back-collapsed')}
                    aria-label="Back To Main App"
                    title="Back To Main App"
                >
                    <ArrowLeftToLine className="h-4 w-4" />
                    {!collapsed ? 'Back To Main App' : null}
                </Link>
            </div>
        </aside>
    );
};

export default TerminalSidebar;
