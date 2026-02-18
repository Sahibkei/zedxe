'use client';

import { useEffect, useMemo, useState } from 'react';

import { terminalFontsClassName } from './fonts';
import Selector from './Selector';
import { THEMES, type ThemeKey } from './themes';
import type { TerminalData, TerminalTab } from './types';
import ModularLayout from './layouts/ModularLayout';
import GlassLayout from './layouts/GlassLayout';
import BrutalistLayout from './layouts/BrutalistLayout';
import AeroLayout from './layouts/AeroLayout';
import CyberLayout from './layouts/CyberLayout';
import UtilitarianLayout from './layouts/UtilitarianLayout';
import Overview from './sections/Overview';
import Financials from './sections/Financials';
import Ratios from './sections/Ratios';
import Charts from './sections/Charts';
import NewsTab from './sections/NewsTab';

type StockTerminalViewProps = {
  ticker: string;
  data: TerminalData;
};

const THEME_KEY_STORAGE = 'zedxe_stock_terminal_theme';
const DARK_STORAGE = 'zedxe_stock_terminal_dark';

export default function StockTerminalView({ ticker, data }: StockTerminalViewProps) {
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    if (typeof window === 'undefined') return 'modular';
    const storedTheme = window.localStorage.getItem(THEME_KEY_STORAGE) as ThemeKey | null;
    return storedTheme && storedTheme in THEMES ? storedTheme : 'modular';
  });
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem(DARK_STORAGE) !== 'false';
  });
  const [tab, setTab] = useState<TerminalTab>('OVERVIEW');

  useEffect(() => {
    window.localStorage.setItem(THEME_KEY_STORAGE, themeKey);
  }, [themeKey]);

  useEffect(() => {
    window.localStorage.setItem(DARK_STORAGE, String(dark));
  }, [dark]);

  const t = THEMES[themeKey][dark ? 'dark' : 'light'];

  const Layout = useMemo(() => {
    if (themeKey === 'glass') return GlassLayout;
    if (themeKey === 'brutalist') return BrutalistLayout;
    if (themeKey === 'aero') return AeroLayout;
    if (themeKey === 'cyber') return CyberLayout;
    if (themeKey === 'utilitarian') return UtilitarianLayout;
    return ModularLayout;
  }, [themeKey]);

  const tabContent = useMemo(() => {
    if (tab === 'FINANCIALS') return <Financials data={data} t={t} />;
    if (tab === 'RATIOS') return <Ratios data={data} t={t} />;
    if (tab === 'CHARTS') return <Charts data={data} t={t} />;
    if (tab === 'NEWS') return <NewsTab data={data} t={t} />;
    return <Overview data={data} t={t} />;
  }, [data, t, tab]);

  return (
    <div className={`zedxe-terminal ${terminalFontsClassName}`} style={{ position: 'relative', paddingTop: 44 }} data-symbol={ticker}>
      <Selector themeKey={themeKey} setThemeKey={setThemeKey} dark={dark} setDark={setDark} t={t} />
      <Layout t={t} tab={tab} setTab={setTab} header={data.header} marquee={data.marquee}>
        {tabContent}
      </Layout>
      <style jsx global>{`
        .zedxe-terminal { color: ${t.text}; font-family: ${t.fontBody}; }
        .zedxe-terminal * { box-sizing: border-box; }
        .zedxe-terminal .zedxe-terminal-mq { animation: mq 26s linear infinite; }
        .zedxe-terminal ::-webkit-scrollbar { width: 8px; height: 8px; }
        .zedxe-terminal ::-webkit-scrollbar-track { background: ${t.panelAlt}; }
        .zedxe-terminal ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 999px; }
        .zedxe-terminal .fl1 { animation: fl1 2s ease-in-out infinite; }
        .zedxe-terminal .fl2 { animation: fl2 2.2s ease-in-out infinite; }
        .zedxe-terminal .fl3 { animation: fl3 1.8s ease-in-out infinite; }
        .zedxe-terminal .blink { animation: blink 1s step-start infinite; }
        @keyframes mq { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes fl1 { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
        @keyframes fl2 { 0%,100% { opacity: 0.85; } 50% { opacity: 0.4; } }
        @keyframes fl3 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
