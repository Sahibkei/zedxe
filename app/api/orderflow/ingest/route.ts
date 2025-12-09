import { NextRequest, NextResponse } from 'next/server';

import { OrderflowTrade } from '@/database/models/orderflow-trade.model';
import { connectToDatabase } from '@/database/mongoose';
import type { OrderflowTradeSide } from '@/database/models/orderflow-trade.model';

interface IngestTradePayload {
    timestamp: number;
    price: number;
    quantity: number;
    side: OrderflowTradeSide;
}

interface IngestRequestBody {
    symbol?: string;
    trades?: IngestTradePayload[];
}

const isValidSide = (side: string): side is OrderflowTradeSide => side === 'buy' || side === 'sell';

export async function POST(request: NextRequest) {
    try {
        await connectToDatabase();

        const body = (await request.json()) as IngestRequestBody;
        const symbol = body?.symbol?.trim().toLowerCase();
        const trades = Array.isArray(body?.trades) ? body.trades : [];

        if (!symbol || trades.length === 0) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const documents = trades
            .map((trade) => {
                const timestamp = Number(trade.timestamp);
                const price = Number(trade.price);
                const quantity = Number(trade.quantity);
                const side = trade?.side;

                if (!Number.isFinite(timestamp) || !Number.isFinite(price) || !Number.isFinite(quantity)) {
                    return null;
                }

                if (!isValidSide(side)) {
                    return null;
                }

                return {
                    symbol,
                    timestamp: new Date(timestamp),
                    price,
                    quantity,
                    side,
                };
            })
            .filter(Boolean);

        if (documents.length === 0) {
            return NextResponse.json({ error: 'No valid trades to ingest' }, { status: 400 });
        }

        const inserted = await OrderflowTrade.insertMany(documents, { ordered: false });

        return NextResponse.json({ inserted: inserted.length });
    } catch (error) {
        console.error('POST /api/orderflow/ingest error', error);
        return NextResponse.json({ error: 'Failed to ingest trades' }, { status: 500 });
    }
}
