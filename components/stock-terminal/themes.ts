export type ThemeTokens = {
  name: string;
  icon: string;
  panel: string;
  panelAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  tabActiveBg: string;
  tabActiveText: string;
  tabIdleBg: string;
  tabIdleText: string;
  fontHeading: string;
  fontBody: string;
  radius: number;
  shadow: string;
};

export type ThemeVariant = {
  light: ThemeTokens;
  dark: ThemeTokens;
};

export const THEMES = {
  modular: {
    light: { name: 'MODULAR', icon: '◧', panel: '#f9fafb', panelAlt: '#ffffff', border: '#d1d5db', text: '#0f172a', textMuted: '#475569', accent: '#2563eb', accentSoft: '#dbeafe', tabActiveBg: '#2563eb', tabActiveText: '#ffffff', tabIdleBg: '#e5e7eb', tabIdleText: '#111827', fontHeading: 'var(--font-dm-mono)', fontBody: 'var(--font-dm-sans)', radius: 10, shadow: '0 8px 24px rgba(15, 23, 42, 0.08)' },
    dark: { name: 'MODULAR', icon: '◧', panel: '#0b1220', panelAlt: '#111827', border: '#1f2937', text: '#f8fafc', textMuted: '#94a3b8', accent: '#38bdf8', accentSoft: '#082f49', tabActiveBg: '#38bdf8', tabActiveText: '#06243a', tabIdleBg: '#1f2937', tabIdleText: '#cbd5e1', fontHeading: 'var(--font-dm-mono)', fontBody: 'var(--font-dm-sans)', radius: 10, shadow: '0 18px 45px rgba(3, 7, 18, 0.55)' },
  },
  glass: {
    light: { name: 'GLASS', icon: '◍', panel: 'rgba(255,255,255,0.72)', panelAlt: 'rgba(255,255,255,0.6)', border: 'rgba(148,163,184,0.3)', text: '#0f172a', textMuted: '#475569', accent: '#0ea5e9', accentSoft: 'rgba(186,230,253,0.4)', tabActiveBg: '#0ea5e9', tabActiveText: '#ffffff', tabIdleBg: 'rgba(226,232,240,0.7)', tabIdleText: '#0f172a', fontHeading: 'var(--font-syne)', fontBody: 'var(--font-dm-sans)', radius: 18, shadow: '0 14px 40px rgba(2, 6, 23, 0.12)' },
    dark: { name: 'GLASS', icon: '◍', panel: 'rgba(15,23,42,0.6)', panelAlt: 'rgba(30,41,59,0.55)', border: 'rgba(148,163,184,0.24)', text: '#f8fafc', textMuted: '#cbd5e1', accent: '#38bdf8', accentSoft: 'rgba(56,189,248,0.2)', tabActiveBg: '#38bdf8', tabActiveText: '#03243a', tabIdleBg: 'rgba(30,41,59,0.7)', tabIdleText: '#e2e8f0', fontHeading: 'var(--font-syne)', fontBody: 'var(--font-dm-sans)', radius: 18, shadow: '0 24px 48px rgba(2, 6, 23, 0.5)' },
  },
  brutalist: {
    light: { name: 'BRUTALIST', icon: '■', panel: '#fffbeb', panelAlt: '#fef3c7', border: '#111827', text: '#111827', textMuted: '#1f2937', accent: '#f97316', accentSoft: '#fed7aa', tabActiveBg: '#111827', tabActiveText: '#ffffff', tabIdleBg: '#fde68a', tabIdleText: '#111827', fontHeading: 'var(--font-bebas-neue)', fontBody: 'var(--font-ibm-plex-mono)', radius: 2, shadow: '8px 8px 0 rgba(17,24,39,0.95)' },
    dark: { name: 'BRUTALIST', icon: '■', panel: '#111827', panelAlt: '#1f2937', border: '#f59e0b', text: '#fef3c7', textMuted: '#fde68a', accent: '#f59e0b', accentSoft: '#451a03', tabActiveBg: '#f59e0b', tabActiveText: '#111827', tabIdleBg: '#1f2937', tabIdleText: '#fef3c7', fontHeading: 'var(--font-bebas-neue)', fontBody: 'var(--font-ibm-plex-mono)', radius: 2, shadow: '8px 8px 0 rgba(245,158,11,0.6)' },
  },
  aero: {
    light: { name: 'AERO', icon: '◌', panel: '#f0f9ff', panelAlt: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e', textMuted: '#0369a1', accent: '#0284c7', accentSoft: '#bae6fd', tabActiveBg: '#0284c7', tabActiveText: '#ffffff', tabIdleBg: '#dbeafe', tabIdleText: '#0c4a6e', fontHeading: 'var(--font-playfair-display)', fontBody: 'var(--font-nunito)', radius: 22, shadow: '0 16px 30px rgba(2,132,199,0.22)' },
    dark: { name: 'AERO', icon: '◌', panel: '#082f49', panelAlt: '#0c4a6e', border: '#38bdf8', text: '#e0f2fe', textMuted: '#bae6fd', accent: '#38bdf8', accentSoft: '#164e63', tabActiveBg: '#38bdf8', tabActiveText: '#082f49', tabIdleBg: '#0c4a6e', tabIdleText: '#e0f2fe', fontHeading: 'var(--font-playfair-display)', fontBody: 'var(--font-nunito)', radius: 22, shadow: '0 18px 36px rgba(2,132,199,0.38)' },
  },
  cyber: {
    light: { name: 'CYBER', icon: '⌁', panel: '#ecfeff', panelAlt: '#cffafe', border: '#0891b2', text: '#083344', textMuted: '#155e75', accent: '#0891b2', accentSoft: '#a5f3fc', tabActiveBg: '#0e7490', tabActiveText: '#ecfeff', tabIdleBg: '#a5f3fc', tabIdleText: '#083344', fontHeading: 'var(--font-orbitron)', fontBody: 'var(--font-share-tech-mono)', radius: 8, shadow: '0 10px 30px rgba(8,145,178,0.25)' },
    dark: { name: 'CYBER', icon: '⌁', panel: '#020617', panelAlt: '#082f49', border: '#22d3ee', text: '#67e8f9', textMuted: '#a5f3fc', accent: '#22d3ee', accentSoft: '#083344', tabActiveBg: '#22d3ee', tabActiveText: '#082f49', tabIdleBg: '#0c4a6e', tabIdleText: '#67e8f9', fontHeading: 'var(--font-orbitron)', fontBody: 'var(--font-share-tech-mono)', radius: 8, shadow: '0 0 28px rgba(34,211,238,0.35)' },
  },
  utilitarian: {
    light: { name: 'UTILITARIAN', icon: '▤', panel: '#ffffff', panelAlt: '#f8fafc', border: '#cbd5e1', text: '#0f172a', textMuted: '#334155', accent: '#334155', accentSoft: '#e2e8f0', tabActiveBg: '#0f172a', tabActiveText: '#f8fafc', tabIdleBg: '#e2e8f0', tabIdleText: '#0f172a', fontHeading: 'var(--font-barlow-condensed)', fontBody: 'var(--font-dm-sans)', radius: 4, shadow: '0 8px 20px rgba(15,23,42,0.08)' },
    dark: { name: 'UTILITARIAN', icon: '▤', panel: '#0f172a', panelAlt: '#111827', border: '#334155', text: '#f8fafc', textMuted: '#94a3b8', accent: '#cbd5e1', accentSoft: '#1e293b', tabActiveBg: '#f8fafc', tabActiveText: '#0f172a', tabIdleBg: '#1e293b', tabIdleText: '#e2e8f0', fontHeading: 'var(--font-barlow-condensed)', fontBody: 'var(--font-dm-sans)', radius: 4, shadow: '0 12px 30px rgba(2,6,23,0.45)' },
  },
} as const satisfies Record<string, ThemeVariant>;

export type ThemeKey = keyof typeof THEMES;
