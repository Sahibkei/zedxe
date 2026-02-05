import { NextResponse } from 'next/server';
import { getCandles } from '@/lib/market/providers';

const sectorMap: Record<string, string> = {
    financial: 'XLF',
    technology: 'XLK',
    services: 'XLY',
};

const rangeConfig: Record<
    string,
    {
        resolution: string;
        lookbackDays: number;
    }
> = {
    '1D': { resolution: '15', lookbackDays: 7 },
    '1M': { resolution: '60', lookbackDays: 45 },
    '3M': { resolution: 'D', lookbackDays: 120 },
    '1Y': { resolution: 'D', lookbackDays: 400 },
    '5Y': { resolution: 'D', lookbackDays: 2000 },
    ALL: { resolution: 'W', lookbackDays: 5000 },
};

const buildPoints = (response: { c?: number[]; t?: number[]; s?: string }) => {
    if (!response || response.s !== 'ok' || !response.c || !response.t) return [];
    const n = Math.min(response.c.length, response.t.length);
    return Array.from({ length: n }, (_, index) => ({
        t: response.t?.[index],
        v: response.c?.[index],
    })).filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v));
};

const fetchPoints = async (symbol: string, resolution: string, lookbackDays: number) => {
    const now = Math.floor(Date.now() / 1000);
    const from = now - lookbackDays * 24 * 60 * 60;

    try {
        const response = await getCandles({ symbol, resolution, from, to: now });
        return buildPoints(response ?? {});
    } catch (error) {
        console.error('Market overview candles failed:', error);
        return [];
    }
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const sector = (searchParams.get('sector') ?? 'financial').toLowerCase();
    const range = (searchParams.get('range') ?? '1Y').toUpperCase();

    const symbol = sectorMap[sector] ?? sectorMap.financial;
    const config = rangeConfig[range] ?? rangeConfig['1Y'];

    let points = await fetchPoints(symbol, config.resolution, config.lookbackDays);

    if (points.length < 2) {
        points = await fetchPoints(symbol, 'D', 400);
    }

    return NextResponse.json(
        { symbol, sector, range, points },
        {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            },
        }
    );
}
