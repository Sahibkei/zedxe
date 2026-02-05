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
    '1D': { resolution: '15', lookbackDays: 3 },
    '1M': { resolution: '60', lookbackDays: 35 },
    '3M': { resolution: 'D', lookbackDays: 120 },
    '1Y': { resolution: 'D', lookbackDays: 370 },
    '5Y': { resolution: 'W', lookbackDays: 370 * 5 },
    ALL: { resolution: 'W', lookbackDays: 370 * 10 },
};

const buildPoints = (response: { c?: number[]; t?: number[]; s?: string }) => {
    if (!response || response.s !== 'ok' || !response.c || !response.t) return [];
    const n = Math.min(response.c.length, response.t.length);
    return Array.from({ length: n }, (_, index) => ({
        t: response.t?.[index],
        v: response.c?.[index],
    })).filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v));
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sector = (searchParams.get('sector') ?? 'financial').toLowerCase();
    const range = (searchParams.get('range') ?? '1Y').toUpperCase();

    const symbol = sectorMap[sector] ?? sectorMap.financial;
    const config = rangeConfig[range] ?? rangeConfig['1Y'];

    const now = Math.floor(Date.now() / 1000);
    const from = now - config.lookbackDays * 24 * 60 * 60;

    const primaryResponse = await getCandles({ symbol, resolution: config.resolution, from, to: now });
    let points = buildPoints(primaryResponse ?? {});

    if (!points.length) {
        const fallbackResponse = await getCandles({ symbol: 'SPY', resolution: config.resolution, from, to: now });
        points = buildPoints(fallbackResponse ?? {});
    }

    return NextResponse.json({ points });
}
