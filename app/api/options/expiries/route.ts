import { NextRequest, NextResponse } from 'next/server';

import { buildExpiriesResponse } from '@/lib/options/mock-data';
import { normalizeSymbol, requireQuery } from '@/lib/options/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = requireQuery(searchParams, 'symbol');

        if (!symbolParam) {
            return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }

        const expiries = buildExpiriesResponse(normalizeSymbol(symbolParam));
        const json = NextResponse.json(expiries);
        json.headers.set('Cache-Control', 'no-store');
        return json;
    } catch (error) {
        console.error('GET /api/options/expiries error', error);
        return NextResponse.json({ error: 'Failed to load expiries' }, { status: 500 });
    }
}
