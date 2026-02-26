import type { TerminalData } from '../types';
import type { ThemeTokens } from '../themes';

type Props = { data: TerminalData; t: ThemeTokens };

export default function Overview({ data, t }: Props) {
  return (
    <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
      {data.overviewMetrics.map((metric) => (
        <article key={metric.label} style={{ border: `1px solid ${t.border}`, background: t.panelAlt, borderRadius: t.radius, padding: 12 }}>
          <div style={{ color: t.textMuted, fontSize: 11, fontFamily: t.fontBody }}>{metric.label}</div>
          <div style={{ color: t.text, fontFamily: t.fontHeading, fontSize: 20 }}>{metric.value}</div>
        </article>
      ))}
    </div>
  );
}
