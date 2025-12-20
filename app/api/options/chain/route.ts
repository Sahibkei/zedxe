import { NextRequest, NextResponse } from 'next/server';

import { buildOptionChain } from '@/lib/options/chainBuilder';
import type { OptionIvSource } from '@/lib/options/types';
import { isValidIsoDate, normalizeSymbol, requireQuery } from '@/lib/options/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parseNumber = (value: string | null) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = requireQuery(searchParams, 'symbol');
        const expiryParam = requireQuery(searchParams, 'expiry');
        const rParam = requireQuery(searchParams, 'r');
        const qParam = requireQuery(searchParams, 'q');
        const ivSourceParam = (requireQuery(searchParams, 'ivSource') ?? 'mid').toLowerCase();
        const bandParam = requireQuery(searchParams, 'bandPct');

        if (!symbolParam) {
            return NextResponse.json({ error: 'symbol is required', where: 'chain' }, { status: 400 });
        }

        if (!expiryParam) {
            return NextResponse.json({ error: 'expiry is required', where: 'chain' }, { status: 400 });
        }

        if (!isValidIsoDate(expiryParam)) {
            return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format', where: 'chain' }, { status: 400 });
        }

        if (!['mid', 'yahoo'].includes(ivSourceParam)) {
            return NextResponse.json(
                { error: 'ivSource must be mid or yahoo', where: 'chain' },
                { status: 400 }
            );
        }

        const r = rParam === null ? 0.05 : parseNumber(rParam);
        const q = qParam === null ? 0.005 : parseNumber(qParam);
        const bandPct = bandParam === null ? 0.2 : parseNumber(bandParam);

        if (r === null || q === null || bandPct === null || bandPct <= 0) {
            return NextResponse.json(
                { error: 'r, q, and bandPct must be valid numbers when provided', where: 'chain' },
                { status: 400 }
            );
        }

        const symbol = normalizeSymbol(symbolParam);
        const ivSource = ivSourceParam as OptionIvSource;
        const chain = await buildOptionChain({ symbol, expiry: expiryParam, r, q, ivSource });
        const spot = chain.spot;

        if (!Number.isFinite(spot) || spot <= 0) {
            return NextResponse.json({ error: 'Unable to resolve spot price', where: 'chain' }, { status: 422 });
        }

        if (!Number.isFinite(chain.tYears) || chain.tYears <= 0) {
            return NextResponse.json({ error: 'Expiry is too close or invalid for pricing', where: 'chain' }, { status: 422 });
        }

        const lowerBound = spot * (1 - bandPct);
        const upperBound = spot * (1 + bandPct);
        const rows = chain.rows.filter((row) => row.strike >= lowerBound && row.strike <= upperBound);
        const warnings: string[] = [];
        if (chain.spotSource === 'alternate') {
            warnings.push('Spot price sourced from alternate data.');
        }

        const response = NextResponse.json({
            symbol: chain.symbol,
            expiry: chain.expiry,
            spot: chain.spot,
            updatedAt: new Date().toISOString(),
            rows,
            warnings: warnings.length ? warnings : undefined,
            tYears: chain.tYears,
            ivSource,
            spotTimestamp: chain.spotTimestamp,
            spotSource: chain.spotSource,
            spotAlternate: chain.spotAlternate,
            fetchedAt: chain.fetchedAt,
            contracts: chain.contracts,
        });
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
