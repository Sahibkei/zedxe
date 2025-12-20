import { bsGreeks, bsPrice, impliedVolBisection } from './bs';
import { buildChainResponse } from './mock-data';
import type {
    OptionChainContract,
    OptionChainQuote,
    OptionChainRow,
    OptionIvSource,
    OptionPremiumSource,
    OptionSide,
} from './types';

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const PREMIUM_EPS = 1e-8;
const MIN_T_YEARS = 1e-6;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const computeExpiryIso = (expiry: string): string | null => {
    const [year, month, day] = expiry.split('-').map((part) => Number(part));
    if (!isFiniteNumber(year) || !isFiniteNumber(month) || !isFiniteNumber(day)) return null;
    const expiryEndUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    if (!Number.isFinite(expiryEndUtc)) return null;
    return new Date(expiryEndUtc).toISOString();
};

const computeTimeToExpiryYears = (expiryIso: string | null, nowMs = Date.now()): number => {
    if (!expiryIso) return MIN_T_YEARS;
    const expiryMs = Date.parse(expiryIso);
    if (!Number.isFinite(expiryMs)) return MIN_T_YEARS;
    const diffSeconds = (expiryMs - nowMs) / 1000;
    if (!Number.isFinite(diffSeconds) || diffSeconds <= 0) return MIN_T_YEARS;
    return diffSeconds / SECONDS_PER_YEAR;
};
    const [year, month, day] = expiry.split('-').map((part) => Number(part));
    if (!isFiniteNumber(year) || !isFiniteNumber(month) || !isFiniteNumber(day)) return 0;
    const expiryEndUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
    const diffSeconds = Math.max((expiryEndUtc - nowMs) / 1000, 0);
    return diffSeconds / SECONDS_PER_YEAR;
};

const computeMid = (bid: number, ask: number): number | null => {
    if (!isFiniteNumber(bid) || !isFiniteNumber(ask)) return null;
    if (bid <= 0 || ask <= 0) return null;
    const mid = (bid + ask) / 2;
    return isFiniteNumber(mid) ? mid : null;
};

const computeIvMid = (params: {
    side: OptionSide;
    spot: number;
    strike: number;
    r: number;
    q: number;
    tYears: number;
    bid: number;
    ask: number;
    last?: number;
    premiumSource: OptionPremiumSource;
}): { mid: number | null; ivMid: number | null } => {
    const { side, spot, strike, r, q, tYears, bid, ask, last, premiumSource } = params;
    const mid = computeMid(bid, ask);
    const lastPrice = isFiniteNumber(last) ? last : null;
    const premium =
        premiumSource === 'mid' && mid !== null && mid > 0
            ? mid
            : lastPrice !== null && lastPrice > 0
              ? lastPrice
              : null;

    if (!premium || premium <= PREMIUM_EPS || !Number.isFinite(tYears) || tYears <= 0) {
        return { mid, ivMid: null };
    }

    const ivMid = impliedVolBisection({
        side,
        S: spot,
        K: strike,
        r,
        q,
        t: tYears,
        price: Math.max(premium, PREMIUM_EPS),
    });

    return { mid, ivMid: isFiniteNumber(ivMid) ? ivMid : null };
};

export type BuiltOptionChain = {
    symbol: string;
    expiry: string;
    spot: number;
    spotTimestamp?: string;
    spotSource?: string;
    spotAlternate?: number;
    fetchedAt: string;
    nowIso: string;
    expiryIso: string | null;
    tYears: number;
    dteDays: number;
    ivSource: OptionIvSource;
    premiumSource: OptionPremiumSource;
    spotUsed: number;
    rUsed: number;
    qUsed: number;
    contracts: OptionChainContract[];
    rows: OptionChainRow[];
};

export async function buildOptionChain(params: {
    symbol: string;
    expiry: string;
    r: number;
    q: number;
    ivSource: OptionIvSource;
    premiumSource?: OptionPremiumSource;
}): Promise<BuiltOptionChain> {
    const chain = await buildChainResponse(params.symbol, params.expiry);
    const spot = chain.spot;
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const expiryIso = computeExpiryIso(params.expiry);
    const tYears = computeTimeToExpiryYears(expiryIso, nowMs);
    const dteDays = Math.max(0, Math.round(tYears * 365));
    const premiumSource = params.premiumSource ?? 'mid';

    const contracts: OptionChainContract[] = chain.contracts.map((contract) => {
        const { mid, ivMid } = computeIvMid({
            side: contract.side,
            spot,
            strike: contract.strike,
            r: params.r,
            q: params.q,
            tYears,
            bid: contract.bid,
            ask: contract.ask,
            last: contract.last,
            premiumSource,
        });
        const lastPrice = isFiniteNumber(contract.last) ? contract.last : null;
        const premiumUsed =
            premiumSource === 'mid' && mid !== null && mid > 0
                ? mid
                : lastPrice !== null && lastPrice > 0
                  ? lastPrice
                  : null;
        const ivYahoo = isFiniteNumber(contract.impliedVol) ? contract.impliedVol : null;
        const iv = params.ivSource === 'yahoo' ? ivYahoo : ivMid;
        const greeks = iv ? bsGreeks({ side: contract.side, S: spot, K: contract.strike, r: params.r, q: params.q, t: tYears, sigma: iv }) : null;
        const modelPriceFromIvMid =
            ivMid && premiumUsed !== null
                ? bsPrice({ side: contract.side, S: spot, K: contract.strike, r: params.r, q: params.q, t: tYears, sigma: ivMid })
                : null;
        const modelPriceFromIvYahoo =
            ivYahoo && premiumUsed !== null
                ? bsPrice({ side: contract.side, S: spot, K: contract.strike, r: params.r, q: params.q, t: tYears, sigma: ivYahoo })
                : null;

        return {
            ...contract,
            mid,
            premiumUsed,
            premiumSource,
            iv_yahoo: ivYahoo,
            iv_mid: ivMid,
            iv,
            delta: greeks?.delta ?? null,
            modelPriceFromIvMid: isFiniteNumber(modelPriceFromIvMid) ? modelPriceFromIvMid : null,
            modelPriceFromIvYahoo: isFiniteNumber(modelPriceFromIvYahoo) ? modelPriceFromIvYahoo : null,
            pricingErrorMid:
                isFiniteNumber(modelPriceFromIvMid) && premiumUsed !== null ? modelPriceFromIvMid - premiumUsed : null,
            pricingErrorYahoo:
                isFiniteNumber(modelPriceFromIvYahoo) && premiumUsed !== null ? modelPriceFromIvYahoo - premiumUsed : null,
        };
    });

    const rowsByStrike = new Map<number, { strike: number; call?: OptionChainQuote; put?: OptionChainQuote }>();

    contracts.forEach((contract) => {
        if (!rowsByStrike.has(contract.strike)) {
            rowsByStrike.set(contract.strike, { strike: contract.strike });
        }
        const row = rowsByStrike.get(contract.strike);
        const quote: OptionChainQuote = {
            bid: isFiniteNumber(contract.bid) ? contract.bid : null,
            ask: isFiniteNumber(contract.ask) ? contract.ask : null,
            last: isFiniteNumber(contract.last) ? contract.last : null,
            mid: isFiniteNumber(contract.mid) ? contract.mid : null,
            premiumUsed: isFiniteNumber(contract.premiumUsed) ? contract.premiumUsed : null,
            premiumSource: contract.premiumSource,
            iv: isFiniteNumber(contract.iv) ? contract.iv : null,
            iv_mid: isFiniteNumber(contract.iv_mid) ? contract.iv_mid : null,
            iv_yahoo: isFiniteNumber(contract.iv_yahoo) ? contract.iv_yahoo : null,
            delta: isFiniteNumber(contract.delta) ? contract.delta : null,
            volume: isFiniteNumber(contract.volume) ? contract.volume : null,
            openInterest: isFiniteNumber(contract.openInterest) ? contract.openInterest : null,
            modelPriceFromIvMid: isFiniteNumber(contract.modelPriceFromIvMid) ? contract.modelPriceFromIvMid : null,
            modelPriceFromIvYahoo: isFiniteNumber(contract.modelPriceFromIvYahoo) ? contract.modelPriceFromIvYahoo : null,
            pricingErrorMid: isFiniteNumber(contract.pricingErrorMid) ? contract.pricingErrorMid : null,
            pricingErrorYahoo: isFiniteNumber(contract.pricingErrorYahoo) ? contract.pricingErrorYahoo : null,
        };

        if (contract.side === 'call') {
            row.call = quote;
        } else {
            row.put = quote;
        }
    });

    const rows = Array.from(rowsByStrike.values()).sort((a, b) => a.strike - b.strike);

    return {
        symbol: chain.symbol,
        expiry: chain.expiry,
        spot,
        spotTimestamp: chain.spotTimestamp,
        spotSource: chain.spotSource,
        spotAlternate: chain.spotAlternate,
        fetchedAt: chain.fetchedAt,
        nowIso,
        expiryIso,
        tYears,
        dteDays,
        ivSource: params.ivSource,
        premiumSource,
        spotUsed: spot,
        rUsed: params.r,
        qUsed: params.q,
        contracts,
        rows,
    };
}
