import type { LayoutProps, TerminalTab } from '../types';

const TABS: TerminalTab[] = ['OVERVIEW', 'FINANCIALS', 'RATIOS', 'CHARTS', 'NEWS'];

export function BaseTerminalLayout({ t, tab, setTab, header, marquee, children, variant }: LayoutProps & { variant: 'modular' | 'glass' | 'brutalist' | 'aero' | 'cyber' | 'utilitarian' }) {
  return (
    <div
      style={{
        border: `1px solid ${t.border}`,
        background: t.panel,
        borderRadius: t.radius,
        boxShadow: t.shadow,
        padding: 18,
        backdropFilter: variant === 'glass' ? 'blur(14px)' : undefined,
      }}
    >
      <header style={{ borderBottom: `1px solid ${t.border}`, paddingBottom: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ margin: 0, color: t.text, fontFamily: t.fontHeading, letterSpacing: 1 }}>{header.ticker} · {header.name}</h1>
            <p style={{ margin: '3px 0 0', color: t.textMuted, fontSize: 12 }}>{header.exchange || '—'} · {header.sector || '—'}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: t.text, fontFamily: t.fontHeading, fontSize: 26 }}>{typeof header.price === 'number' ? `$${header.price.toFixed(2)}` : '—'}</div>
            <div style={{ color: (header.changePercent ?? 0) >= 0 ? '#22c55e' : '#ef4444', fontSize: 13 }}>
              {typeof header.change === 'number' ? `${header.change >= 0 ? '+' : ''}${header.change.toFixed(2)}` : '—'}
              {' '}({typeof header.changePercent === 'number' ? `${header.changePercent >= 0 ? '+' : ''}${header.changePercent.toFixed(2)}%` : '—'})
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, border: `1px solid ${t.border}`, borderRadius: t.radius, overflow: 'hidden', background: t.panelAlt }}>
          <div className="zedxe-terminal-mq" style={{ display: 'inline-flex', gap: 24, padding: '8px 12px', color: t.textMuted, fontSize: 12, whiteSpace: 'nowrap' }}>
            {[...marquee, ...marquee].map((item, idx) => (
              <span key={`${item.label}-${idx}`}><strong style={{ color: t.text }}>{item.label}</strong>: {item.value}</span>
            ))}
          </div>
        </div>
      </header>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            style={{
              border: `1px solid ${t.border}`,
              borderRadius: t.radius,
              padding: '7px 10px',
              background: item === tab ? t.tabActiveBg : t.tabIdleBg,
              color: item === tab ? t.tabActiveText : t.tabIdleText,
              fontFamily: t.fontHeading,
              fontSize: 12,
              letterSpacing: 1,
            }}
          >
            {item}
          </button>
        ))}
      </div>
      <section>{children}</section>
    </div>
  );
}
