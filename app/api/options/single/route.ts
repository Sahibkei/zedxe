import { NextRequest, NextResponse } from 'next/server';

import { bsGreeks, bsPrice, bsProbITM, impliedVolBisection } from '@/lib/options/bs';
import { buildChainResponse } from '@/lib/options/mock-data';
import { timeToExpiryYears } from '@/lib/options/time';
import type { OptionPriceSource, OptionSide, SingleOptionAnalyticsResponse } from '@/lib/options/types';
import { isValidIsoDate, normalizeSymbol, requireQuery } from '@/lib/options/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Parse a query param into a finite number, returning null if invalid.
 */
const parseNumber = (value: string | null) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const priceSources: OptionPriceSource[] = ['mid', 'bid', 'ask', 'last'];

/**
 * GET /api/options/single
 * Resolve a single option contract and compute BSM analytics.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = requireQuery(searchParams, 'symbol');
        const expiryParam = requireQuery(searchParams, 'expiry');
        const typeParam = requireQuery(searchParams, 'type');
        const strikeParam = requireQuery(searchParams, 'strike');
        const rParam = requireQuery(searchParams, 'r');
        const qParam = requireQuery(searchParams, 'q');
        const priceSourceParam = requireQuery(searchParams, 'priceSource') ?? 'mid';

        if (!symbolParam) {
            return NextResponse.json({ error: 'symbol is required', where: 'single' }, { status: 400 });
        }

        if (!expiryParam) {
            return NextResponse.json({ error: 'expiry is required', where: 'single' }, { status: 400 });
        }

        if (!isValidIsoDate(expiryParam)) {
            return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format', where: 'single' }, { status: 400 });
        }

        if (!typeParam) {
            return NextResponse.json({ error: 'type is required', where: 'single' }, { status: 400 });
        }

        const normalizedType = typeParam.toLowerCase();
        if (normalizedType !== 'call' && normalizedType !== 'put') {
            return NextResponse.json({ error: 'type must be call or put', where: 'single' }, { status: 400 });
        }

        const strike = parseNumber(strikeParam);
        if (strike === null || strike <= 0) {
            return NextResponse.json({ error: 'strike must be a positive number', where: 'single' }, { status: 400 });
        }

        const r = parseNumber(rParam);
        const q = parseNumber(qParam);
        if (r === null || q === null) {
            return NextResponse.json({ error: 'r and q are required', where: 'single' }, { status: 400 });
        }

        if (!priceSources.includes(priceSourceParam as OptionPriceSource)) {
            return NextResponse.json(
                { error: 'priceSource must be mid, bid, ask, or last', where: 'single' },
                { status: 400 }
            );
        }

        const symbol = normalizeSymbol(symbolParam);
        const side = normalizedType as OptionSide;
        const priceSource = priceSourceParam as OptionPriceSource;

        const chain = await buildChainResponse(symbol, expiryParam);
        const contract = chain.contracts.find((entry) => entry.side === side && Math.abs(entry.strike - strike) < 1e-6);

        if (!contract) {
            return NextResponse.json(
                { error: `No ${side} contract found at ${strike} for ${expiryParam}`, where: 'single' },
                { status: 404 }
            );
        }

        const spot = chain.spot;
        if (!Number.isFinite(spot) || spot <= 0) {
            return NextResponse.json({ error: 'Unable to resolve spot price', where: 'single' }, { status: 422 });
        }

        const tYears = timeToExpiryYears(expiryParam);
        if (tYears === null || tYears <= 0) {
            return NextResponse.json({ error: 'Expiry is too close or invalid for pricing', where: 'single' }, { status: 422 });
        }

        const bid = contract.bid;
        const ask = contract.ask;
        const last = contract.last;
        const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
        const spreadAbs = ask - bid;
        const spreadPct = mid > 0 ? (spreadAbs / mid) * 100 : Number.POSITIVE_INFINITY;

        const premiumLookup: Record<OptionPriceSource, number | undefined> = {
            mid,
            bid,
            ask,
            last,
        };
        const premium = premiumLookup[priceSource];

        if (!Number.isFinite(premium) || (premium ?? 0) <= 0) {
            return NextResponse.json(
                { error: `Selected price source "${priceSource}" is unavailable`, where: 'single' },
                { status: 422 }
            );
        }

        const ivUsed = impliedVolBisection({ side, S: spot, K: strike, r, q, t: tYears, price: premium });
        if (ivUsed === null || !Number.isFinite(ivUsed)) {
            return NextResponse.json(
                { error: 'Unable to invert implied volatility for selected price', where: 'single' },
                { status: 422 }
            );
        }

        const bsmPrice = bsPrice({ side, S: spot, K: strike, r, q, t: tYears, sigma: ivUsed });
        const greeks = bsGreeks({ side, S: spot, K: strike, r, q, t: tYears, sigma: ivUsed });
        const probITM = bsProbITM({ side, S: spot, K: strike, r, q, t: tYears, sigma: ivUsed });

        if (!Number.isFinite(bsmPrice) || !greeks || probITM === null) {
            return NextResponse.json({ error: 'Failed to compute model analytics', where: 'single' }, { status: 422 });
        }

        const forward = spot * Math.exp((r - q) * tYears);
        const breakeven = side === 'call' ? strike + premium : strike - premium;

        const warnings: string[] = [];
        if (spreadPct > 10) {
            warnings.push(`Wide bid/ask spread: ${spreadPct.toFixed(1)}%`);
        }
        if (!Number.isFinite(contract.openInterest ?? NaN) || (contract.openInterest ?? 0) <= 0) {
            warnings.push('Open interest unavailable or zero.');
        }
        if (!Number.isFinite(contract.volume ?? NaN) || (contract.volume ?? 0) <= 0) {
            warnings.push('Volume unavailable or zero.');
        }
        if (!Number.isFinite(contract.impliedVol ?? NaN)) {
            warnings.push('Vendor implied volatility unavailable.');
        }
        if (chain.spotSource === 'alternate') {
            warnings.push('Spot price sourced from alternate data.');
        }
        if (ivUsed > 3) {
            warnings.push('Implied volatility exceeds 300%.');
        } else if (ivUsed < 0.05) {
            warnings.push('Implied volatility below 5%.');
        }

        const response: SingleOptionAnalyticsResponse = {
            inputs: {
                symbol,
                expiry: expiryParam,
                type: side,
                strike,
                r,
                q,
                priceSource,
                asOf: chain.fetchedAt,
            },
            contract: {
                symbol,
                expiry: expiryParam,
                strike,
                type: side,
            },
            spot: {
                spot,
                forward,
                T: tYears,
                source: chain.spotSource,
                asOf: chain.spotTimestamp ?? chain.fetchedAt,
                alternate: chain.spotAlternate ?? null,
            },
            market: {
                bid,
                ask,
                last,
                mid,
                premium,
                spreadAbs,
                spreadPct,
                volume: contract.volume,
                openInterest: contract.openInterest,
                vendorIV: contract.impliedVol,
            },
            model: {
                ivUsed,
                bsmPrice,
                greeks,
                probITM,
                breakeven,
            },
            warnings,
        };

        const json = NextResponse.json(response);
        json.headers.set('Cache-Control', 'no-store');
        return json;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('GET /api/options/single error', error);
        const json = NextResponse.json(
            { error: 'Failed to compute single-option analytics', detail: message, where: 'single' },
            { status: 502 }
        );
        json.headers.set('Cache-Control', 'no-store');
        return json;
    }
}
