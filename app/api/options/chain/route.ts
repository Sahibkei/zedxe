import { NextRequest, NextResponse } from 'next/server';

import { bsGreeks, impliedVolBisection } from '@/lib/options/bs';
import { buildChainResponse } from '@/lib/options/mock-data';
import { timeToExpiryYears } from '@/lib/options/time';
import type { OptionChainQuote, OptionPriceSource } from '@/lib/options/types';
import { isValidIsoDate, normalizeSymbol, requireQuery } from '@/lib/options/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const priceSources: OptionPriceSource[] = ['mid', 'bid', 'ask', 'last'];

const parseNumber = (value: string | null) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const buildQuote = (params: {
    side: 'call' | 'put';
    bid: number;
    ask: number;
    last?: number;
    volume?: number;
    openInterest?: number;
    impliedVol?: number;
    priceSource: OptionPriceSource;
    spot: number;
    strike: number;
    r: number;
    q: number;
    tYears: number;
}): OptionChainQuote => {
    const { bid, ask, last, volume, openInterest, impliedVol, priceSource, spot, strike, r, q, tYears, side } = params;
    const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
    const priceMap: Record<OptionPriceSource, number | undefined> = {
        mid,
        bid,
        ask,
        last,
    };
    let premium = priceMap[priceSource];
    if (!Number.isFinite(premium ?? NaN)) {
        premium = mid;
    }

    let iv = Number.isFinite(impliedVol ?? NaN) ? (impliedVol as number) : null;
    if (!iv && Number.isFinite(premium ?? NaN) && (premium ?? 0) > 0) {
        iv = impliedVolBisection({ side, S: spot, K: strike, r, q, t: tYears, price: premium as number });
    }

    const greeks = iv ? bsGreeks({ side, S: spot, K: strike, r, q, t: tYears, sigma: iv }) : null;

    return {
        bid: Number.isFinite(bid) ? bid : null,
        ask: Number.isFinite(ask) ? ask : null,
        last: Number.isFinite(last ?? NaN) ? last : null,
        mid: Number.isFinite(mid) ? mid : null,
        iv: Number.isFinite(iv ?? NaN) ? (iv as number) : null,
        delta: greeks?.delta ?? null,
        volume: Number.isFinite(volume ?? NaN) ? volume : null,
        openInterest: Number.isFinite(openInterest ?? NaN) ? openInterest : null,
    };
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = requireQuery(searchParams, 'symbol');
        const expiryParam = requireQuery(searchParams, 'expiry');
        const rParam = requireQuery(searchParams, 'r');
        const qParam = requireQuery(searchParams, 'q');
        const priceSourceParam = (requireQuery(searchParams, 'priceSource') ?? 'mid').toLowerCase();
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

        if (!priceSources.includes(priceSourceParam as OptionPriceSource)) {
            return NextResponse.json(
                { error: 'priceSource must be mid, bid, ask, or last', where: 'chain' },
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
        const chain = await buildChainResponse(symbol, expiryParam);
        const spot = chain.spot;

        if (!Number.isFinite(spot) || spot <= 0) {
            return NextResponse.json({ error: 'Unable to resolve spot price', where: 'chain' }, { status: 422 });
        }

        const tYears = timeToExpiryYears(expiryParam);
        if (tYears === null || tYears <= 0) {
            return NextResponse.json({ error: 'Expiry is too close or invalid for pricing', where: 'chain' }, { status: 422 });
        }

        const priceSource = priceSourceParam as OptionPriceSource;
        const lowerBound = spot * (1 - bandPct);
        const upperBound = spot * (1 + bandPct);
        const rowsByStrike = new Map<number, { strike: number; call?: OptionChainQuote; put?: OptionChainQuote }>();

        chain.contracts.forEach((contract) => {
            if (contract.strike < lowerBound || contract.strike > upperBound) return;
            if (!rowsByStrike.has(contract.strike)) {
                rowsByStrike.set(contract.strike, { strike: contract.strike });
            }
            const row = rowsByStrike.get(contract.strike);
            if (!row) return;

            const quote = buildQuote({
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
