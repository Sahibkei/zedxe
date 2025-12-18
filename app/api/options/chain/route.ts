import { NextRequest, NextResponse } from 'next/server';

import { buildChainResponse } from '@/lib/options/mock-data';
import { isValidIsoDate, normalizeSymbol, requireQuery } from '@/lib/options/validation';

export function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbolParam = requireQuery(searchParams, 'symbol');
    const expiryParam = requireQuery(searchParams, 'expiry');

    if (!symbolParam) {
        return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    if (!expiryParam) {
        return NextResponse.json({ error: 'expiry is required' }, { status: 400 });
    }

    if (!isValidIsoDate(expiryParam)) {
        return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format' }, { status: 400 });
    }

    try {
        const chain = buildChainResponse(normalizeSymbol(symbolParam), expiryParam);
        return NextResponse.json(chain);
    } catch (error) {
        console.error('GET /api/options/chain error', error);
        return NextResponse.json({ error: 'Failed to generate option chain' }, { status: 500 });
    }
}
