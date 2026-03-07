'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Command, Moon, PanelLeft, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const resolveTitle = (pathname: string) => {
    if (pathname.startsWith('/terminal/news-terminal')) return 'Market News';
    if (pathname.startsWith('/terminal/chart')) return 'Chart';
    if (pathname.startsWith('/terminal/constituents')) return 'Constituents';
    return "Today's Markets";
};

type Props = {
    theme: 'dark' | 'light';
    sidebarHidden: boolean;
    onToggleTheme: () => void;
    onToggleSidebar: () => void;
};

const TerminalTopBar = ({ theme, sidebarHidden, onToggleTheme, onToggleSidebar }: Props) => {
    const pathname = usePathname();
    const title = resolveTitle(pathname);
    const now = new Date();
    const dateLabel = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const timeLabel = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return (
        <header className="terminal-topbar">
            <div className="flex min-w-0 items-center gap-3">
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="terminal-top-icon"
                    aria-label={sidebarHidden ? 'Show side navigation' : 'Hide side navigation'}
                    title={sidebarHidden ? 'Show side navigation' : 'Hide side navigation'}
                >
                    <PanelLeft className="h-4 w-4" />
                    {sidebarHidden ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
                </button>
                <div className="terminal-search">
                    <Command className="h-4 w-4" />
                    <span className="truncate">Search for a name, ticker, or function</span>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <span className="terminal-title hidden xl:inline-flex">{title}</span>
                <span suppressHydrationWarning className="hidden items-center gap-1.5 terminal-top-chip md:inline-flex">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {dateLabel} {timeLabel}
                </span>
                <button
                    type="button"
                    onClick={onToggleTheme}
                    className={cn(
                        'terminal-top-chip terminal-theme-switch',
                        theme === 'dark' ? 'terminal-theme-switch-dark' : 'terminal-theme-switch-light'
                    )}
                >
                    {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    {theme === 'dark' ? 'Light' : 'Dark'}
                </button>
                <Link
                    href="/news/terminal"
                    className="terminal-top-chip"
                >
                    Classic
                </Link>
            </div>
        </header>
    );
};

export default TerminalTopBar;
