import { NextResponse } from 'next/server';
import { getCandles } from '@/lib/market/providers';

const sectorMap: Record<string, string> = {
    financial: 'XLF',
    technology: 'XLK',
    services: 'XLC',
};

const rangeConfig: Record<
    string,
    {
        resolution: string;
        lookbackDays: number;
    }
> = {
    '1D': { resolution: '5', lookbackDays: 1 },
    '1M': { resolution: '60', lookbackDays: 30 },
    '3M': { resolution: 'D', lookbackDays: 90 },
    '1Y': { resolution: 'D', lookbackDays: 365 },
    '5Y': { resolution: 'W', lookbackDays: 365 * 5 },
    ALL: { resolution: 'M', lookbackDays: 365 * 10 },
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sector = (searchParams.get('sector') ?? 'financial').toLowerCase();
    const range = (searchParams.get('range') ?? '1Y').toUpperCase();

    const symbol = sectorMap[sector] ?? sectorMap.financial;
    const config = rangeConfig[range] ?? rangeConfig['1Y'];

    const now = Math.floor(Date.now() / 1000);
    const from = now - config.lookbackDays * 24 * 60 * 60;

    const candleResponse = await getCandles({ symbol, resolution: config.resolution, from, to: now });
    if (!candleResponse || candleResponse.s !== 'ok' || !candleResponse.c || !candleResponse.t) {
        return NextResponse.json({ points: [] });
    }

    const points = candleResponse.t.map((timestamp, index) => ({
        t: timestamp,
        v: candleResponse.c?.[index] ?? 0,
    }));

    return NextResponse.json({ points });
}
