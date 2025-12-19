import { NextRequest, NextResponse } from 'next/server';

import { buildChainResponse } from '@/lib/options/mock-data';
import { isValidIsoDate, normalizeSymbol, requireQuery } from '@/lib/options/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = requireQuery(searchParams, 'symbol');
        const expiryParam = requireQuery(searchParams, 'expiry');

        if (!symbolParam) {
            return NextResponse.json({ error: 'symbol is required', where: 'chain' }, { status: 400 });
        }

        if (!expiryParam) {
            return NextResponse.json({ error: 'expiry is required', where: 'chain' }, { status: 400 });
        }

        if (!isValidIsoDate(expiryParam)) {
            return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format', where: 'chain' }, { status: 400 });
        }

        const chain = await buildChainResponse(normalizeSymbol(symbolParam), expiryParam);
        const response = NextResponse.json(chain);
        response.headers.set('Cache-Control', 'no-store');
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('GET /api/options/chain error', error);
        const response = NextResponse.json(
            { error: 'Failed to generate option chain', detail: message, where: 'chain' },
            { status: 502 }
        );
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }
}
