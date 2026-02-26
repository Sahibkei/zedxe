import Link from 'next/link';

import type { TerminalData } from '../types';
import type { ThemeTokens } from '../themes';

type Props = { data: TerminalData; t: ThemeTokens };

export default function NewsTab({ data, t }: Props) {
  if (!data.news.length) {
    return <div style={{ color: t.textMuted }}>No recent headlines available.</div>;
  }

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {data.news.map((item) => (
        <article key={item.id} style={{ border: `1px solid ${t.border}`, background: t.panelAlt, borderRadius: t.radius, padding: 12 }}>
          <div style={{ color: t.text, fontFamily: t.fontHeading }}>{item.headline}</div>
          {item.summary ? <p style={{ color: t.textMuted, marginTop: 6, fontSize: 13 }}>{item.summary}</p> : null}
          <div style={{ display: 'flex', gap: 10, color: t.textMuted, fontSize: 11, marginTop: 8 }}>
            <span>{item.source || 'Unknown source'}</span>
            <span>{item.datetime ? new Date(item.datetime * 1000).toLocaleString() : '—'}</span>
            {item.url ? (
              <Link href={item.url} target="_blank" rel="noreferrer" style={{ color: t.accent }}>
                Open
              </Link>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
