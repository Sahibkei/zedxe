import { NextRequest, NextResponse } from 'next/server';

import { buildAnalyzeResponse } from '@/lib/options/mock-data';
import { isValidIsoDate, normalizeSymbol } from '@/lib/options/validation';
import type { AnalyzeRequest } from '@/lib/options/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const parseNumber = (value: unknown) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};

export async function POST(request: NextRequest) {
    let body: AnalyzeRequest | undefined;

    try {
        body = (await request.json()) as AnalyzeRequest;
    } catch (error) {
        return NextResponse.json({ error: 'Invalid JSON payload', where: 'analyze' }, { status: 400 });
    }

    try {
        const rawSymbol = typeof body?.symbol === 'string' ? body.symbol : '';
        const rawExpiry = typeof body?.expiry === 'string' ? body.expiry : '';
        const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : null;
        const expiry = rawExpiry?.trim() || null;
        const r = parseNumber(body?.r);
        const q = parseNumber(body?.q);

        if (!symbol) {
            return NextResponse.json({ error: 'symbol is required', where: 'analyze' }, { status: 400 });
        }

        if (!expiry) {
            return NextResponse.json({ error: 'expiry is required', where: 'analyze' }, { status: 400 });
        }

        if (!isValidIsoDate(expiry)) {
            return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format', where: 'analyze' }, { status: 400 });
        }

        if (r === null || q === null) {
            return NextResponse.json({ error: 'symbol, expiry, r, and q are required', where: 'analyze' }, { status: 400 });
        }

        const response = await buildAnalyzeResponse({ ...body, symbol, expiry, r, q });
        const json = NextResponse.json(response);
        json.headers.set('Cache-Control', 'no-store');
        return json;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('POST /api/options/analyze error', error);
        const json = NextResponse.json(
            { error: 'Failed to analyze option chain', detail: message, where: 'analyze' },
            { status: 502 }
        );
        json.headers.set('Cache-Control', 'no-store');
        return json;
    }
}
