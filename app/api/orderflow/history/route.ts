import { NextRequest, NextResponse } from 'next/server';

import { OrderflowTrade } from '@/database/models/orderflow-trade.model';
import { connectToDatabase } from '@/database/mongoose';

const DEFAULT_WINDOW_SECONDS = 900;
const DEFAULT_MAX_POINTS = 5000;

const parseNumberParam = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.trim().toLowerCase();

    if (!symbol) {
        return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    const windowSeconds = parseNumberParam(searchParams.get('windowSeconds'), DEFAULT_WINDOW_SECONDS);
    const maxPoints = parseNumberParam(searchParams.get('maxPoints'), DEFAULT_MAX_POINTS);

    const since = new Date(Date.now() - windowSeconds * 1000);

    try {
        await connectToDatabase();

        const trades = await OrderflowTrade.find({ symbol, timestamp: { $gte: since } })
            .sort({ timestamp: 1 })
            .limit(maxPoints)
            .lean();

        const normalizedTrades = trades.map((trade) => ({
            timestamp: new Date(trade.timestamp).getTime(),
            price: trade.price,
            quantity: trade.quantity,
            side: trade.side,
        }));

        return NextResponse.json({ trades: normalizedTrades });
    } catch (error) {
        console.error('GET /api/orderflow/history error', error);
        return NextResponse.json({ error: 'Failed to load trade history' }, { status: 500 });
    }
}
