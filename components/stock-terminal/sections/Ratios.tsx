import type { TerminalData } from '../types';
import type { ThemeTokens } from '../themes';

type Props = { data: TerminalData; t: ThemeTokens };

export default function Ratios({ data, t }: Props) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
      {data.ratios.map((ratio) => (
        <div key={ratio.label} style={{ border: `1px solid ${t.border}`, background: t.panelAlt, borderRadius: t.radius, padding: 12 }}>
          <div style={{ color: t.textMuted, fontSize: 11 }}>{ratio.category || 'KEY RATIO'}</div>
          <div style={{ color: t.text, fontSize: 14, fontFamily: t.fontHeading }}>{ratio.label}</div>
          <div style={{ color: t.accent, fontSize: 20, fontFamily: t.fontHeading }}>{ratio.value}</div>
        </div>
      ))}
    </div>
  );
}
