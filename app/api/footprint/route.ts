import { NextRequest, NextResponse } from 'next/server';

import { OrderflowTrade } from '@/database/models/orderflow-trade.model';
import { connectToDatabase } from '@/database/mongoose';
import { aggregateFootprintBars, TIMEFRAME_TO_MS } from '@/lib/footprint/aggregate';
import { AggregateFootprintOptions, FootprintBar, FootprintTimeframe } from '@/lib/footprint/types';

const DEFAULT_MAX_BARS = 120;

const parseFootprintRequest = (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.trim().toLowerCase();
    const timeframe = searchParams.get('timeframe')?.trim() as FootprintTimeframe | null;
    const priceStep = searchParams.get('priceStep');
    const maxBarsParam = searchParams.get('maxBars');

    return { symbol, timeframe, priceStep, maxBarsParam };
};

const parsePriceStep = (value: string | null) => {
    if (!value) return undefined;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
    return parsed;
};

const parseMaxBars = (value: string | null) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_MAX_BARS;
    return Math.min(parsed, 500);
};

const MAX_TRADES_PER_REQUEST = 50_000;

export async function GET(request: NextRequest) {
    const { symbol, timeframe, priceStep, maxBarsParam } = parseFootprintRequest(request);

    if (!symbol) {
        return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    if (!timeframe || !TIMEFRAME_TO_MS[timeframe]) {
        return NextResponse.json({ error: 'invalid timeframe' }, { status: 400 });
    }

    const timeframeMs = TIMEFRAME_TO_MS[timeframe];
    const maxBars = parseMaxBars(maxBarsParam);
    const since = new Date(Date.now() - timeframeMs * maxBars);

    try {
        await connectToDatabase();

        const tradeLimit = Math.min(maxBars * 1000, MAX_TRADES_PER_REQUEST);

        const trades = await OrderflowTrade.find({ symbol, timestamp: { $gte: since } })
            .sort({ timestamp: 1 })
            .limit(tradeLimit)
            .lean();

        const rawTrades = trades.map((trade) => ({
            symbol: trade.symbol,
            price: trade.price,
            quantity: trade.quantity,
            side: trade.side,
            ts: new Date(trade.timestamp).getTime(),
        }));

        const options: AggregateFootprintOptions = {
            timeframe,
            priceStep: parsePriceStep(priceStep),
        };

        const bars: FootprintBar[] = aggregateFootprintBars(rawTrades, options);

        return NextResponse.json({ bars });
    } catch (error) {
        console.error('GET /api/footprint error', error);
        return NextResponse.json({ error: 'Failed to generate footprint' }, { status: 500 });
    }
}
