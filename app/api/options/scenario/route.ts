import { NextRequest, NextResponse } from 'next/server';

import { bsPrice, impliedVolBisection } from '@/lib/options/bs';
import { buildChainResponse } from '@/lib/options/mock-data';
import { daysToExpiry, timeToExpiryYears } from '@/lib/options/time';
import type { OptionSide, ScenarioAnalysisResponse, ScenarioPriceSource } from '@/lib/options/types';
import { isValidIsoDate, normalizeSymbol, requireQuery } from '@/lib/options/validation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const priceSources: ScenarioPriceSource[] = ['mid', 'bid', 'ask', 'model'];

/**
 * Parse a query param into a finite number, returning null if invalid.
 */
const parseNumber = (value: string | null) => {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const buildAxis = (min: number, max: number, step: number) => {
    const values: number[] = [];
    if (step <= 0) return values;
    const maxIterations = 400;
    let current = min;
    let iterations = 0;
    while (current <= max + 1e-12 && iterations < maxIterations) {
        values.push(Number(current.toFixed(6)));
        current += step;
        iterations += 1;
    }
    return values;
};

/**
 * GET /api/options/scenario
 * Compute a scenario grid of model prices and P&L for a single option contract.
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
        const horizonParam = requireQuery(searchParams, 'horizonDays') ?? '0';
        const spotMinParam = requireQuery(searchParams, 'spotMinPct');
        const spotMaxParam = requireQuery(searchParams, 'spotMaxPct');
        const spotStepParam = requireQuery(searchParams, 'spotStepPct');
        const ivMinParam = requireQuery(searchParams, 'ivMinPct');
        const ivMaxParam = requireQuery(searchParams, 'ivMaxPct');
        const ivStepParam = requireQuery(searchParams, 'ivStepPct');

        if (!symbolParam) {
            return NextResponse.json({ error: 'symbol is required', where: 'scenario' }, { status: 400 });
        }

        if (!expiryParam) {
            return NextResponse.json({ error: 'expiry is required', where: 'scenario' }, { status: 400 });
        }

        if (!isValidIsoDate(expiryParam)) {
            return NextResponse.json({ error: 'expiry must be in YYYY-MM-DD format', where: 'scenario' }, { status: 400 });
        }

        if (!typeParam) {
            return NextResponse.json({ error: 'type is required', where: 'scenario' }, { status: 400 });
        }

        const normalizedType = typeParam.toLowerCase();
        if (normalizedType !== 'call' && normalizedType !== 'put') {
            return NextResponse.json({ error: 'type must be call or put', where: 'scenario' }, { status: 400 });
        }

        const strike = parseNumber(strikeParam);
        if (strike === null || strike <= 0) {
            return NextResponse.json({ error: 'strike must be a positive number', where: 'scenario' }, { status: 400 });
        }

        const r = parseNumber(rParam);
        const q = parseNumber(qParam);
        if (r === null || q === null) {
            return NextResponse.json({ error: 'r and q are required', where: 'scenario' }, { status: 400 });
        }

        const horizonDays = parseNumber(horizonParam);
        if (horizonDays === null || horizonDays < 0) {
            return NextResponse.json({ error: 'horizonDays must be a non-negative number', where: 'scenario' }, { status: 400 });
        }

        const spotMinPct = parseNumber(spotMinParam);
        const spotMaxPct = parseNumber(spotMaxParam);
        const spotStepPct = parseNumber(spotStepParam);
        if (spotMinPct === null || spotMaxPct === null || spotStepPct === null) {
            return NextResponse.json(
                { error: 'spotMinPct, spotMaxPct, and spotStepPct are required', where: 'scenario' },
                { status: 400 }
            );
        }
        if (spotStepPct <= 0 || spotMinPct > spotMaxPct) {
            return NextResponse.json({ error: 'spot range parameters are invalid', where: 'scenario' }, { status: 400 });
        }

        const ivMinPct = parseNumber(ivMinParam);
        const ivMaxPct = parseNumber(ivMaxParam);
        const ivStepPct = parseNumber(ivStepParam);
        if (ivMinPct === null || ivMaxPct === null || ivStepPct === null) {
            return NextResponse.json(
                { error: 'ivMinPct, ivMaxPct, and ivStepPct are required', where: 'scenario' },
                { status: 400 }
            );
        }
        if (ivStepPct <= 0 || ivMinPct > ivMaxPct) {
            return NextResponse.json({ error: 'iv range parameters are invalid', where: 'scenario' }, { status: 400 });
        }

        if (!priceSources.includes(priceSourceParam as ScenarioPriceSource)) {
            return NextResponse.json(
                { error: 'priceSource must be mid, bid, ask, or model', where: 'scenario' },
                { status: 400 }
            );
        }

        const symbol = normalizeSymbol(symbolParam);
        const side = normalizedType as OptionSide;
        const priceSource = priceSourceParam as ScenarioPriceSource;

        const chain = await buildChainResponse(symbol, expiryParam);
        const contract = chain.contracts.find((entry) => entry.side === side && Math.abs(entry.strike - strike) < 1e-6);
        if (!contract) {
            return NextResponse.json(
                { error: `No ${side} contract found at ${strike} for ${expiryParam}`, where: 'scenario' },
                { status: 404 }
            );
        }

        const spot = chain.spot;
        if (!Number.isFinite(spot) || spot <= 0) {
            return NextResponse.json({ error: 'Unable to resolve spot price', where: 'scenario' }, { status: 422 });
        }

        const tYears = timeToExpiryYears(expiryParam);
        if (tYears === null || tYears <= 0) {
            return NextResponse.json({ error: 'Expiry is too close or invalid for pricing', where: 'scenario' }, { status: 422 });
        }

        const dte = daysToExpiry(expiryParam) ?? Math.max(0, Math.round(tYears * 365));
        const warnings: string[] = [];

        const bid = contract.bid;
        const ask = contract.ask;
        const last = contract.last;
        const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;

        let basePremium: number | null = null;
        let baseSigma: number | null = null;

        if (priceSource !== 'model') {
            const lookup: Record<'mid' | 'bid' | 'ask', number> = {
                mid,
                bid,
                ask,
            };
            const candidate = lookup[priceSource];
            if (Number.isFinite(candidate) && candidate > 0) {
                basePremium = candidate;
            } else if (Number.isFinite(mid) && mid > 0) {
                basePremium = mid;
                warnings.push(`Price source "${priceSource}" unavailable. Using mid price instead.`);
            } else if (Number.isFinite(last ?? NaN) && (last ?? 0) > 0) {
                basePremium = last ?? 0;
                warnings.push(`Price source "${priceSource}" unavailable. Using last price instead.`);
            }
        }

        if (priceSource === 'model') {
            const vendorIV = contract.impliedVol;
            if (Number.isFinite(vendorIV ?? NaN) && (vendorIV ?? 0) > 0) {
                baseSigma = vendorIV ?? 0;
            } else {
                baseSigma = 0.3;
                warnings.push('Vendor implied volatility unavailable. Using 30% default.');
            }

            basePremium = bsPrice({ side, S: spot, K: strike, r, q, t: tYears, sigma: baseSigma });
            if (!Number.isFinite(basePremium) || basePremium <= 0) {
                return NextResponse.json({ error: 'Unable to compute model premium', where: 'scenario' }, { status: 422 });
            }

            const implied = impliedVolBisection({ side, S: spot, K: strike, r, q, t: tYears, price: basePremium });
            if (implied !== null && Number.isFinite(implied) && implied > 0) {
                baseSigma = implied;
            }
        }

        if (!Number.isFinite(basePremium ?? NaN) || (basePremium ?? 0) <= 0) {
            return NextResponse.json(
                { error: `Selected price source "${priceSource}" is unavailable`, where: 'scenario' },
                { status: 422 }
            );
        }

        if (baseSigma === null) {
            const implied = impliedVolBisection({ side, S: spot, K: strike, r, q, t: tYears, price: basePremium });
            if (implied !== null && Number.isFinite(implied) && implied > 0) {
                baseSigma = implied;
            } else if (Number.isFinite(contract.impliedVol ?? NaN) && (contract.impliedVol ?? 0) > 0) {
                baseSigma = contract.impliedVol ?? 0;
                warnings.push('Unable to solve implied volatility. Using vendor IV instead.');
            } else {
                baseSigma = 0.3;
                warnings.push('Unable to solve implied volatility. Using 30% default.');
            }
        }

        if (!Number.isFinite(baseSigma) || baseSigma <= 0) {
            return NextResponse.json({ error: 'Failed to resolve base implied volatility', where: 'scenario' }, { status: 422 });
        }

        const tEff = Math.max(tYears - horizonDays / 365, 1e-6);
        if (horizonDays > dte) {
            warnings.push(`Horizon exceeds DTE (${dte} days). Clamped to minimum time.`);
        }
        if (chain.spotSource === 'alternate') {
            warnings.push('Spot price sourced from alternate data.');
        }
        if (baseSigma > 3) {
            warnings.push('Implied volatility exceeds 300%.');
        } else if (baseSigma < 0.05) {
            warnings.push('Implied volatility below 5%.');
        }

        const spotMovesPct = buildAxis(spotMinPct, spotMaxPct, spotStepPct);
        const ivShiftsPct = buildAxis(ivMinPct, ivMaxPct, ivStepPct);
        if (spotMovesPct.length === 0 || ivShiftsPct.length === 0) {
            return NextResponse.json({ error: 'Scenario axes could not be generated', where: 'scenario' }, { status: 422 });
        }

        const priceGrid: number[][] = [];
        const pnlGrid: number[][] = [];
        let pnlMin = Number.POSITIVE_INFINITY;
        let pnlMax = Number.NEGATIVE_INFINITY;
        let pnlBest = { spotMovePct: 0, ivShiftPct: 0, pnl: Number.NEGATIVE_INFINITY };
        let pnlWorst = { spotMovePct: 0, ivShiftPct: 0, pnl: Number.POSITIVE_INFINITY };

        for (const ivShiftPct of ivShiftsPct) {
            const rowPrices: number[] = [];
            const rowPnl: number[] = [];
            const scenarioSigma = Math.max(baseSigma * (1 + ivShiftPct), 1e-6);
            for (const spotMovePct of spotMovesPct) {
                const scenarioSpot = spot * (1 + spotMovePct);
                const scenarioPrice = bsPrice({
                    side,
                    S: scenarioSpot,
                    K: strike,
                    r,
                    q,
                    t: tEff,
                    sigma: scenarioSigma,
                });
                const normalizedPrice = Number.isFinite(scenarioPrice) ? scenarioPrice : 0;
                const pnl = normalizedPrice - basePremium;
                rowPrices.push(normalizedPrice);
                rowPnl.push(pnl);

                if (pnl < pnlMin) pnlMin = pnl;
                if (pnl > pnlMax) pnlMax = pnl;
                if (pnl > pnlBest.pnl) pnlBest = { spotMovePct, ivShiftPct, pnl };
                if (pnl < pnlWorst.pnl) pnlWorst = { spotMovePct, ivShiftPct, pnl };
            }
            priceGrid.push(rowPrices);
            pnlGrid.push(rowPnl);
        }

        const forward = spot * Math.exp((r - q) * tYears);
        const response: ScenarioAnalysisResponse = {
            base: {
                symbol,
                expiry: expiryParam,
                type: side,
                strike,
                spot,
                forward,
                basePremium,
                baseSigma,
                dte,
                horizonDays,
                tEff,
            },
            axes: {
                spotMovesPct,
                ivShiftsPct,
            },
            grids: {
                price: priceGrid,
                pnl: pnlGrid,
            },
            stats: {
                pnlMin,
                pnlMax,
                pnlBest,
                pnlWorst,
            },
            warnings,
        };

        const json = NextResponse.json(response);
        json.headers.set('Cache-Control', 'no-store');
        return json;
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('GET /api/options/scenario error', error);
        const json = NextResponse.json(
            { error: 'Failed to compute scenario analysis', detail: message, where: 'scenario' },
            { status: 502 }
        );
        json.headers.set('Cache-Control', 'no-store');
        return json;
    }
}
