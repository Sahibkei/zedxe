import { NextRequest, NextResponse } from 'next/server';

import { buildAnalyzeResponse } from '@/lib/options/mock-data';
import { isValidIsoDate, normalizeSymbol } from '@/lib/options/validation';
import type { AnalyzeRequest } from '@/lib/options/types';

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
        return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const rawSymbol = typeof body?.symbol === 'string' ? body.symbol : '';
    const rawExpiry = typeof body?.expiry === 'string' ? body.expiry : '';
    const symbol = rawSymbol ? normalizeSymbol(rawSymbol) : null;
    const expiry = rawExpiry?.trim() || null;
    const r = parseNumber(body?.r);
    const q = parseNumber(body?.q);

    if (!symbol) {
        return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    if (!expiry) {
        return NextResponse.json({ error: 'expiry is required' }, { status: 400 });
    }

    if (!isValidIsoDate(expiry)) {
        return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format' }, { status: 400 });
    }

    if (r === null || q === null) {
        return NextResponse.json({ error: 'symbol, expiry, r, and q are required' }, { status: 400 });
    }

    try {
        const response = buildAnalyzeResponse({ ...body, symbol, expiry, r, q });
        return NextResponse.json(response);
    } catch (error) {
        console.error('POST /api/options/analyze error', error);
        return NextResponse.json({ error: 'Failed to analyze option chain' }, { status: 500 });
    }
}
