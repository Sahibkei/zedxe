import { NextRequest, NextResponse } from 'next/server';

import { buildChainResponse } from '@/lib/options/mock-data';

const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

export function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.trim();
    const expiry = searchParams.get('expiry')?.trim();

    if (!symbol || !expiry) {
        return NextResponse.json({ error: 'symbol and expiry are required' }, { status: 400 });
    }

    if (!isValidDate(expiry)) {
        return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format' }, { status: 400 });
    }

    try {
        const chain = buildChainResponse(symbol, expiry);
        return NextResponse.json(chain);
    } catch (error) {
        console.error('GET /api/options/chain error', error);
        return NextResponse.json({ error: 'Failed to generate option chain' }, { status: 500 });
    }
}
