import { NextRequest, NextResponse } from "next/server";

import { impliedVolBisection, normCdf } from "@/lib/options/bs";
import { buildChainResponse } from "@/lib/options/mock-data";
import { fetchLatestSpot } from "@/lib/options/spot";
import { timeToExpiryYears } from "@/lib/options/time";
import type { OptionContract, RiskNeutralDistributionResponse } from "@/lib/options/types";
import { isValidIsoDate, normalizeSymbol, requireQuery } from "@/lib/options/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_SIGMA = 0.25;
const GRID_POINTS = 260;
const GRID_LOW_MULTIPLIER = 0.25;
const GRID_HIGH_MULTIPLIER = 1.75;

const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

const midFromContract = (contract: OptionContract): number | null => {
    const bid = Number(contract.bid);
    const ask = Number(contract.ask);
    if (Number.isFinite(bid) && Number.isFinite(ask) && bid > 0 && ask > 0) {
        const mid = (bid + ask) / 2;
        return Number.isFinite(mid) && mid > 0 ? mid : null;
    }

    if (Number.isFinite(contract.last ?? NaN) && (contract.last ?? 0) > 0) {
        return contract.last ?? null;
    }

    return null;
};

const selectAtmContracts = (contracts: OptionContract[], spot: number) => {
    let bestDistance = Number.POSITIVE_INFINITY;
    const matches: OptionContract[] = [];

    contracts.forEach((contract) => {
        const distance = Math.abs(contract.strike - spot);
        if (!Number.isFinite(distance)) return;
        if (distance < bestDistance - 1e-8) {
            bestDistance = distance;
            matches.length = 0;
            matches.push(contract);
        } else if (Math.abs(distance - bestDistance) <= 1e-8) {
            matches.push(contract);
        }
    });

    return matches;
};

const pickSigma = (
    contracts: OptionContract[],
    spot: number,
    r: number,
    q: number,
    tYears: number,
    warnings: string[]
) => {
    const atmContracts = selectAtmContracts(contracts, spot);
    const atmStrike = atmContracts[0]?.strike ?? spot;
    const candidateWithIv = atmContracts.find((contract) => isFiniteNumber(contract.impliedVol) && (contract.impliedVol ?? 0) > 0);
    if (candidateWithIv && candidateWithIv.impliedVol) {
        return { sigma: candidateWithIv.impliedVol, atmStrike };
    }

    for (const contract of atmContracts) {
        const mid = midFromContract(contract);
        if (mid === null) continue;
        const iv = impliedVolBisection({
            side: contract.side,
            S: spot,
            K: contract.strike,
            r,
            q,
            t: tYears,
            price: mid,
        });
        if (iv !== null && Number.isFinite(iv) && iv > 0) {
            return { sigma: iv, atmStrike };
        }
    }

    warnings.push("ATM implied volatility unavailable; falling back to default 0.25");
    return { sigma: DEFAULT_SIGMA, atmStrike };
};

const buildDistributionGrid = (spot: number, r: number, q: number, tYears: number, sigma: number) => {
    const gridMin = Math.max(0.01, spot * GRID_LOW_MULTIPLIER);
    const gridMax = Math.max(gridMin * 1.1, spot * GRID_HIGH_MULTIPLIER);
    const step = (gridMax - gridMin) / (GRID_POINTS - 1);
    const sqrtT = Math.sqrt(tYears);
    const variance = sigma * sigma * tYears;
    const mu = Math.log(spot) + (r - q - 0.5 * sigma * sigma) * tYears;
    const denom = sigma * sqrtT;

    const x: number[] = [];
    const pdf: number[] = [];
    const cdf: number[] = [];

    for (let index = 0; index < GRID_POINTS; index += 1) {
        const price = gridMin + step * index;
        x.push(Number(price.toFixed(6)));

        if (price <= 0 || !Number.isFinite(price) || denom <= 0) {
            pdf.push(0);
            cdf.push(0);
            continue;
        }

        const logPrice = Math.log(price);
        const z = (logPrice - mu) / denom;
        const density = (1 / (price * Math.sqrt(2 * Math.PI * variance))) * Math.exp(-0.5 * z * z);
        pdf.push(Number.isFinite(density) ? density : 0);
        cdf.push(Number.isFinite(z) ? normCdf(z) : 0);
    }

    return { x, pdf, cdf };
};

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const symbolParam = requireQuery(searchParams, "symbol");
        const expiryParam = requireQuery(searchParams, "expiry");
        const rParam = requireQuery(searchParams, "r");
        const qParam = requireQuery(searchParams, "q");
        const methodParam = requireQuery(searchParams, "method") ?? "lognormal";

        if (!symbolParam) {
            return NextResponse.json({ error: "symbol is required", where: "rnd" }, { status: 400 });
        }

        if (!expiryParam) {
            return NextResponse.json({ error: "expiry is required", where: "rnd" }, { status: 400 });
        }

        if (!isValidIsoDate(expiryParam)) {
            return NextResponse.json({ error: "expiry must be in YYYY-MM-DD format", where: "rnd" }, { status: 400 });
        }

        if (methodParam !== "lognormal") {
            return NextResponse.json({ error: "unsupported method", where: "rnd" }, { status: 400 });
        }

        const r = rParam ? Number(rParam) : NaN;
        const q = qParam ? Number(qParam) : NaN;
        if (!Number.isFinite(r) || !Number.isFinite(q)) {
            return NextResponse.json({ error: "r and q must be numbers", where: "rnd" }, { status: 400 });
        }

        const symbol = normalizeSymbol(symbolParam);
        const expiry = expiryParam;
        const warnings: string[] = [];

        const [spotInfo, chain] = await Promise.all([fetchLatestSpot(symbol), buildChainResponse(symbol, expiry)]);
        const resolvedSpot = isFiniteNumber(spotInfo.spot) && (spotInfo.spot ?? 0) > 0 ? (spotInfo.spot as number) : chain.spot;

        if (!isFiniteNumber(resolvedSpot) || resolvedSpot <= 0) {
            return NextResponse.json({ error: "Unable to resolve spot price", where: "rnd" }, { status: 502 });
        }

        if (!isFiniteNumber(spotInfo.spot) || (spotInfo.spot ?? 0) <= 0) {
            warnings.push("Spot helper returned invalid value; using chain spot instead");
        }

        const tYears = timeToExpiryYears(expiry);
        if (!tYears || tYears <= 0) {
            return NextResponse.json({ error: "expiry must be in the future", where: "rnd" }, { status: 400 });
        }

        const { sigma, atmStrike } = pickSigma(chain.contracts, resolvedSpot, r, q, tYears, warnings);
        const forward = resolvedSpot * Math.exp((r - q) * tYears);
        const grid = buildDistributionGrid(resolvedSpot, r, q, tYears, sigma);

        const expectedMove = resolvedSpot * sigma * Math.sqrt(tYears);
        const logSpot = Math.log(resolvedSpot);
        const denom = sigma * Math.sqrt(tYears);
        const mu = Math.log(resolvedSpot) + (r - q - 0.5 * sigma * sigma) * tYears;
        const zSpot = denom > 0 ? (logSpot - mu) / denom : 0;
        const cdfSpot = denom > 0 ? normCdf(zSpot) : 0;

        const response: RiskNeutralDistributionResponse = {
            symbol,
            expiry,
            spot: resolvedSpot,
            forward,
            r,
            q,
            T: tYears,
            sigma,
            atmStrike,
            grid,
            stats: {
                expectedMove,
                expectedMoveUpper: resolvedSpot + expectedMove,
                expectedMoveLower: Math.max(0, resolvedSpot - expectedMove),
                probabilityAboveSpot: Math.max(0, Math.min(1, 1 - cdfSpot)),
                probabilityBelowSpot: Math.max(0, Math.min(1, cdfSpot)),
            },
        };

        if (warnings.length > 0) {
            response.warnings = warnings;
        }

        const result = NextResponse.json(response);
        result.headers.set("Cache-Control", "no-store");
        return result;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("GET /api/options/rnd error", error);
        const response = NextResponse.json({ error: "Failed to generate distribution", detail: message, where: "rnd" }, { status: 502 });
        response.headers.set("Cache-Control", "no-store");
        return response;
    }
}
