import type { TerminalData } from '../types';
import type { ThemeTokens } from '../themes';

const money = (value?: number) => (typeof value === 'number' ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value) : '—');

type Props = { data: TerminalData; t: ThemeTokens };

export default function Financials({ data, t }: Props) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
        <thead>
          <tr>
            {['Period', 'Revenue', 'Operating Income', 'Net Income', 'Op. Cash Flow', 'EPS'].map((head) => (
              <th key={head} style={{ textAlign: 'left', padding: '10px 8px', borderBottom: `1px solid ${t.border}`, color: t.textMuted, fontFamily: t.fontHeading, fontSize: 12 }}>{head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.financials.map((row) => (
            <tr key={row.period}>
              <td style={{ padding: '10px 8px', borderBottom: `1px solid ${t.border}`, color: t.text }}>{row.period}</td>
              <td style={{ padding: '10px 8px', borderBottom: `1px solid ${t.border}`, color: t.text }}>{money(row.revenue)}</td>
              <td style={{ padding: '10px 8px', borderBottom: `1px solid ${t.border}`, color: t.text }}>{money(row.operatingIncome)}</td>
              <td style={{ padding: '10px 8px', borderBottom: `1px solid ${t.border}`, color: t.text }}>{money(row.netIncome)}</td>
              <td style={{ padding: '10px 8px', borderBottom: `1px solid ${t.border}`, color: t.text }}>{money(row.operatingCashFlow)}</td>
              <td style={{ padding: '10px 8px', borderBottom: `1px solid ${t.border}`, color: t.text }}>{typeof row.eps === 'number' ? row.eps.toFixed(2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
