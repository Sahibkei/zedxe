import { NextRequest, NextResponse } from 'next/server';

import { buildOptionChainQuote, OPTION_PRICE_SOURCES } from '@/lib/options/chainQuote';
import { buildChainResponse } from '@/lib/options/mock-data';
import { timeToExpiryYears } from '@/lib/options/time';
import type { OptionChainQuote, OptionPriceSource, OptionSurfaceResponse } from '@/lib/options/types';
import { isValidIsoDate, normalizeSymbol, requireQuery } from '@/lib/options/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parseNumber = (value: string | null) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const parseExpiries = (searchParams: URLSearchParams) => {
    const expiryParam = requireQuery(searchParams, 'expiry');
    const expiriesParam = requireQuery(searchParams, 'expiries');
    const expiries = new Set<string>();

    if (expiryParam) {
        expiries.add(expiryParam);
    }

    if (expiriesParam) {
        expiriesParam
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
            .forEach((value) => expiries.add(value));
    }

    return Array.from(expiries);
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = requireQuery(searchParams, 'symbol');
        const priceSourceParam = (requireQuery(searchParams, 'priceSource') ?? 'mid').toLowerCase();
        const rParam = requireQuery(searchParams, 'r');
        const qParam = requireQuery(searchParams, 'q');
        const expiries = parseExpiries(searchParams);

        if (!symbolParam) {
            return NextResponse.json({ error: 'symbol is required', where: 'surface' }, { status: 400 });
        }

        if (expiries.length === 0) {
            return NextResponse.json({ error: 'expiry or expiries is required', where: 'surface' }, { status: 400 });
        }

        const invalidExpiry = expiries.find((expiry) => !isValidIsoDate(expiry));
        if (invalidExpiry) {
            return NextResponse.json(
                { error: `expiry must be in YYYY-MM-DD format: ${invalidExpiry}`, where: 'surface' },
                { status: 400 }
            );
        }

        if (!OPTION_PRICE_SOURCES.includes(priceSourceParam as OptionPriceSource)) {
            return NextResponse.json(
                { error: 'priceSource must be mid, bid, ask, or last', where: 'surface' },
                { status: 400 }
            );
        }

        const r = rParam === null ? 0.05 : parseNumber(rParam);
        const q = qParam === null ? 0.005 : parseNumber(qParam);

        if (r === null || q === null) {
            return NextResponse.json({ error: 'r and q must be valid numbers when provided', where: 'surface' }, { status: 400 });
        }

        const symbol = normalizeSymbol(symbolParam);
        const priceSource = priceSourceParam as OptionPriceSource;

        const chains = await Promise.all(
            expiries.map(async (expiry) => {
                const chain = await buildChainResponse(symbol, expiry);
                const spot = chain.spot;
                if (!Number.isFinite(spot) || spot <= 0) {
                    throw new Error(`Unable to resolve spot price for ${expiry}`);
                }

                const tYears = timeToExpiryYears(expiry);
                if (tYears === null || tYears <= 0) {
                    throw new Error(`Expiry ${expiry} is too close or invalid for pricing`);
                }

                const rowsByStrike = new Map<number, { strike: number; call?: OptionChainQuote; put?: OptionChainQuote }>();

                chain.contracts.forEach((contract) => {
                    if (!rowsByStrike.has(contract.strike)) {
                        rowsByStrike.set(contract.strike, { strike: contract.strike });
                    }
                    const row = rowsByStrike.get(contract.strike);

                    const quote = buildOptionChainQuote({
                        side: contract.side,
                        bid: contract.bid,
                        ask: contract.ask,
                        last: contract.last,
                        volume: contract.volume,
                        openInterest: contract.openInterest,
                        impliedVol: contract.impliedVol,
                        priceSource,
                        spot,
                        strike: contract.strike,
                        r,
                        q,
                        tYears,
                    });

                    if (contract.side === 'call') {
                        row.call = quote;
                    } else {
                        row.put = quote;
                    }
                });

                const rows = Array.from(rowsByStrike.values()).sort((a, b) => a.strike - b.strike);

                return {
                    expiry,
                    spot,
                    spotTimestamp: chain.spotTimestamp,
                    spotSource: chain.spotSource,
                    spotAlternate: chain.spotAlternate,
                    fetchedAt: chain.fetchedAt,
                    rows,
                };
            })
        );

        const response: OptionSurfaceResponse = {
            symbol,
            priceSource,
            r,
            q,
            updatedAt: new Date().toISOString(),
            chains,
        };

        const nextResponse = NextResponse.json(response);
        nextResponse.headers.set('Cache-Control', 'no-store');
        return nextResponse;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('GET /api/options/surface error', error);
        const response = NextResponse.json(
            { error: 'Failed to generate IV surface', detail: message, where: 'surface' },
            { status: 502 }
        );
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }
}
