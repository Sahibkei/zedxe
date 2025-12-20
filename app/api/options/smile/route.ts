import { NextRequest, NextResponse } from 'next/server';

import { buildOptionChain } from '@/lib/options/chainBuilder';
import type { OptionIvSource, OptionPremiumSource, OptionSide } from '@/lib/options/types';
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
        const sideParam = (requireQuery(searchParams, 'side') ?? 'both').toLowerCase();
        const ivSourceParam = (requireQuery(searchParams, 'ivSource') ?? 'mid').toLowerCase();
        const premiumSourceParam = (requireQuery(searchParams, 'premiumSource') ?? 'mid').toLowerCase();
        const debugParam = requireQuery(searchParams, 'debug');

        if (!symbolParam) {
            return NextResponse.json({ error: 'symbol is required', where: 'smile' }, { status: 400 });
        }

        if (!expiryParam) {
            return NextResponse.json({ error: 'expiry is required', where: 'smile' }, { status: 400 });
        }

        if (!isValidIsoDate(expiryParam)) {
            return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format', where: 'smile' }, { status: 400 });
        }

        if (!['both', 'call', 'put'].includes(sideParam)) {
            return NextResponse.json({ error: 'side must be call, put, or both', where: 'smile' }, { status: 400 });
        }

        if (!['mid', 'yahoo'].includes(ivSourceParam)) {
            return NextResponse.json({ error: 'ivSource must be mid or yahoo', where: 'smile' }, { status: 400 });
        }

        if (!['mid', 'last'].includes(premiumSourceParam)) {
            return NextResponse.json({ error: 'premiumSource must be mid or last', where: 'smile' }, { status: 400 });
        }

        const r = rParam === null ? 0.05 : parseNumber(rParam);
        const q = qParam === null ? 0.005 : parseNumber(qParam);
        const debug = debugParam === '1';

        if (r === null || q === null) {
            return NextResponse.json({ error: 'r and q must be valid numbers when provided', where: 'smile' }, { status: 400 });
        }

        const symbol = normalizeSymbol(symbolParam);
        const ivSource = ivSourceParam as OptionIvSource;
        const premiumSource = premiumSourceParam as OptionPremiumSource;
        const chain = await buildOptionChain({ symbol, expiry: expiryParam, r, q, ivSource, premiumSource });
        if (process.env.NODE_ENV !== 'production') {
            console.debug('[options] smile chain source', { symbol: chain.symbol, expiry: chain.expiry, ivSource });
        }

        if (!Number.isFinite(chain.spot) || chain.spot <= 0) {
            return NextResponse.json({ error: 'Unable to resolve spot price', where: 'smile' }, { status: 422 });
        }

        if (!Number.isFinite(chain.tYears) || chain.tYears <= 0) {
            return NextResponse.json({ error: 'Expiry is too close or invalid for pricing', where: 'smile' }, { status: 422 });
        }

        const sideFilter = sideParam as OptionSide | 'both';
        const points = chain.contracts
            .filter((contract) => sideFilter === 'both' || contract.side === sideFilter)
            .map((contract) => ({
                strike: contract.strike,
                side: contract.side,
                iv: contract.iv ?? null,
                iv_mid: contract.iv_mid ?? null,
                iv_yahoo: contract.iv_yahoo ?? null,
                mid: contract.mid ?? null,
                bid: contract.bid ?? null,
                ask: contract.ask ?? null,
                last: contract.last ?? null,
                premiumUsed: contract.premiumUsed ?? null,
                premiumSource: contract.premiumSource,
                modelPriceFromIvMid: debug ? contract.modelPriceFromIvMid ?? null : undefined,
                modelPriceFromIvYahoo: debug ? contract.modelPriceFromIvYahoo ?? null : undefined,
                pricingErrorMid: debug ? contract.pricingErrorMid ?? null : undefined,
                pricingErrorYahoo: debug ? contract.pricingErrorYahoo ?? null : undefined,
            }));

        const atmStrike = chain.rows.reduce((closest: number | null, row) => {
            if (!Number.isFinite(row.strike)) return closest;
            if (closest === null) return row.strike;
            return Math.abs(row.strike - chain.spot) < Math.abs(closest - chain.spot) ? row.strike : closest;
        }, null);
        const atmRow = chain.rows.find((row) => row.strike === atmStrike) ?? null;
        const atmQuote = atmRow?.call ?? atmRow?.put ?? null;

        const response = NextResponse.json({
            symbol: chain.symbol,
            expiry: chain.expiry,
            spot: chain.spot,
            tYears: chain.tYears,
            dteDays: chain.dteDays,
            nowIso: chain.nowIso,
            expiryIso: chain.expiryIso,
            spotUsed: chain.spotUsed,
            rUsed: chain.rUsed,
            qUsed: chain.qUsed,
            ivSource,
            premiumSource,
            points,
            updatedAt: new Date().toISOString(),
            atmDiagnostics:
                debug && atmStrike !== null && atmQuote
                    ? {
                          strike: atmStrike,
                          side: atmRow?.call ? 'call' : 'put',
                          bid: atmQuote.bid ?? null,
                          ask: atmQuote.ask ?? null,
                          mid: atmQuote.mid ?? null,
                          last: atmQuote.last ?? null,
                          premiumUsed: atmQuote.premiumUsed ?? null,
                          iv: atmQuote.iv ?? null,
                          iv_mid: atmQuote.iv_mid ?? null,
                          iv_yahoo: atmQuote.iv_yahoo ?? null,
                          modelPriceFromIvMid: atmQuote.modelPriceFromIvMid ?? null,
                          pricingErrorMid: atmQuote.pricingErrorMid ?? null,
                      }
                    : undefined,
        });
        response.headers.set('Cache-Control', 'no-store');
        return response;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('GET /api/options/smile error', error);
        const response = NextResponse.json(
            { error: 'Failed to generate IV smile', detail: message, where: 'smile' },
            { status: 502 }
        );
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }
}
