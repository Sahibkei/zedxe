'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { TerminalData } from '../types';
import type { ThemeTokens } from '../themes';

type Props = { data: TerminalData; t: ThemeTokens };

export default function Charts({ data, t }: Props) {
  return (
    <div style={{ height: 360, border: `1px solid ${t.border}`, borderRadius: t.radius, background: t.panelAlt, padding: 12 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data.priceSeries}>
          <CartesianGrid stroke={t.border} strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: t.textMuted, fontSize: 11 }} />
          <YAxis tick={{ fill: t.textMuted, fontSize: 11 }} width={56} />
          <Tooltip
            contentStyle={{ background: t.panel, borderColor: t.border, borderRadius: t.radius }}
            labelStyle={{ color: t.textMuted }}
            itemStyle={{ color: t.text }}
          />
          <Area type="monotone" dataKey="close" stroke={t.accent} fill={t.accentSoft} fillOpacity={0.85} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
