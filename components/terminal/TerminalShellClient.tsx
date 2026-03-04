'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import TerminalSidebar from '@/components/terminal/TerminalSidebar';
import TerminalTopBar from '@/components/terminal/TerminalTopBar';

const THEME_STORAGE_KEY = 'zedxe-terminal-theme';
const SIDEBAR_STORAGE_KEY = 'zedxe-terminal-sidebar-hidden';

const TerminalShellClient = ({ children }: { children: React.ReactNode }) => {
    const [theme, setTheme] = useState<'dark' | 'light'>('light');
    const [sidebarHidden, setSidebarHidden] = useState<boolean>(false);
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    // Apply persisted settings before paint to reduce first-frame theme/sidebar flicker.
    useLayoutEffect(() => {
        try {
            const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            const storedSidebar = localStorage.getItem(SIDEBAR_STORAGE_KEY);
            setTheme(storedTheme === 'dark' ? 'dark' : 'light');
            setSidebarHidden(storedSidebar === 'true');
        } finally {
            setSettingsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!settingsLoaded) return;
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme, settingsLoaded]);

    useEffect(() => {
        if (!settingsLoaded) return;
        localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarHidden ? 'true' : 'false');
    }, [settingsLoaded, sidebarHidden]);

    return (
        <main className="terminal-shell" data-terminal-theme={theme} data-sidebar-collapsed={sidebarHidden ? 'true' : 'false'}>
            <div className="terminal-shell-inner">
                <TerminalSidebar collapsed={sidebarHidden} />
                <section className="terminal-main">
                    <TerminalTopBar
                        theme={theme}
                        sidebarHidden={sidebarHidden}
                        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
                        onToggleSidebar={() => setSidebarHidden((prev) => !prev)}
                    />
                    <div className="terminal-main-content">{children}</div>
                </section>
            </div>
        </main>
    );
};

export default TerminalShellClient;
