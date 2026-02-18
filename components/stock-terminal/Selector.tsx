'use client';

import { useEffect, useRef, useState } from 'react';

import { THEMES, type ThemeKey, type ThemeTokens } from './themes';

type SelectorProps = {
  themeKey: ThemeKey;
  setThemeKey: (value: ThemeKey) => void;
  dark: boolean;
  setDark: (value: boolean) => void;
  t: ThemeTokens;
};

export default function Selector({ themeKey, setThemeKey, dark, setDark, t }: SelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  return (
    <div
      ref={rootRef}
      style={{
        position: 'fixed',
        right: 16,
        top: 16,
        zIndex: 50,
        display: 'flex',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={() => setDark(!dark)}
        style={{
          border: `1px solid ${t.border}`,
          background: t.panel,
          color: t.text,
          borderRadius: t.radius,
          padding: '8px 10px',
          fontFamily: t.fontHeading,
          letterSpacing: 1,
          fontSize: 12,
        }}
      >
        {dark ? 'SUN LIGHT' : 'MOON DARK'}
      </button>
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{
            border: `1px solid ${t.border}`,
            background: t.panel,
            color: t.text,
            borderRadius: t.radius,
            padding: '8px 12px',
            minWidth: 142,
            textAlign: 'left',
            fontFamily: t.fontHeading,
            fontSize: 12,
            letterSpacing: 1,
          }}
        >
          {THEMES[themeKey].dark.icon} {THEMES[themeKey].dark.name}
        </button>
        {open ? (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              borderRadius: t.radius,
              border: `1px solid ${t.border}`,
              background: t.panelAlt,
              minWidth: 180,
              overflow: 'hidden',
            }}
          >
            {(Object.keys(THEMES) as ThemeKey[]).map((key) => {
              const label = THEMES[key].dark;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setThemeKey(key);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    border: 0,
                    borderBottom: `1px solid ${t.border}`,
                    background: key === themeKey ? t.accentSoft : 'transparent',
                    color: t.text,
                    padding: '8px 10px',
                    textAlign: 'left',
                    fontFamily: t.fontBody,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  {label.icon} {label.name}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
