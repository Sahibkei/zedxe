import { NextRequest, NextResponse } from 'next/server';

import { buildExpiriesResponse } from '@/lib/options/mock-data';

export function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.trim();

    if (!symbol) {
        return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    const expiries = buildExpiriesResponse(symbol);
    return NextResponse.json(expiries);
}
