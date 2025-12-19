import type { AnalyzeRequest, AnalyzeResponse, ChainResponse, ExpiriesResponse, OptionContract, OptionSide } from './types';
import { fetchLatestSpot } from './spot';
import { daysToExpiry, timeToExpiryYears } from './time';

const DEFAULT_EXPIRY_COUNT = 10;
const SPOT_MIN = 50;
const SPOT_MAX = 350;

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const hashString = (input: string) => {
    let hash = 0;
    for (let index = 0; index < input.length; index += 1) {
        hash = (hash << 5) - hash + input.charCodeAt(index);
        hash |= 0; // Convert to 32-bit integer
    }
    return Math.abs(hash);
};

const createSeededRandom = (seed: string) => {
    let state = hashString(seed) % 233280;
    return () => {
        state = (state * 9301 + 49297) % 233280;
        return state / 233280;
    };
};

const getUpcomingFriday = (reference: Date) => {
    const day = reference.getUTCDay();
    const daysUntilFriday = (5 - day + 7) % 7 || 7; // Always move forward to the next Friday
    const nextFriday = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate()));
    nextFriday.setUTCDate(reference.getUTCDate() + daysUntilFriday);
    return nextFriday;
};

const generateStrikes = (spot: number) => {
    const strikes: number[] = [];
    const lower = Math.max(5, Math.floor((spot - 50) / 5) * 5);
    const upper = Math.max(lower + 20, Math.ceil((spot + 50) / 5) * 5);

    for (let strike = lower; strike <= upper; strike += 5) {
        strikes.push(Number(strike.toFixed(2)));
    }
    return strikes;
};

const getSpotForSymbol = (symbol: string) => {
    const random = createSeededRandom(symbol.toUpperCase());
    const span = SPOT_MAX - SPOT_MIN;
    const base = SPOT_MIN + (hashString(symbol) % span);
    const jitter = random() * 5;
    return Number((base + jitter).toFixed(2));
};

const createContract = (symbol: string, expiry: string, strike: number, side: OptionSide, spot: number): OptionContract => {
    const random = createSeededRandom(`${symbol}-${expiry}-${strike}-${side}`);
    const intrinsic = Math.max(0, side === 'call' ? spot - strike : strike - spot);
    const timeValue = Math.max(0.5, (0.02 * spot) * (0.4 + random()));
    const midPrice = Math.max(0.1, intrinsic + timeValue);
    const spreadPct = 0.01 + random() * 0.02;
    const spread = midPrice * spreadPct;
    const mid = Number(midPrice.toFixed(2));

    const bid = Number(Math.max(0.01, mid - spread / 2).toFixed(2));
    const ask = Number(Math.max(mid + spread / 2, bid + 0.01).toFixed(2));
    const last = Number(Math.max(0.01, mid + (random() - 0.5) * spread).toFixed(2));
    const openInterest = Math.floor(random() * 1500) + 25;
    const volume = Math.floor(random() * 800);
    const impliedVol = Number((0.15 + random() * 0.35).toFixed(4));

    return {
        symbol,
        expiry,
        strike,
        side,
        bid,
        ask,
        last,
        openInterest,
        volume,
        impliedVol,
    };
};

export const buildExpiriesResponse = (symbol: string, count = DEFAULT_EXPIRY_COUNT): ExpiriesResponse => {
    const today = new Date();
    const start = getUpcomingFriday(today);
    const expiries: string[] = [];

    for (let index = 0; index < count; index += 1) {
        const expiry = new Date(start);
        expiry.setUTCDate(start.getUTCDate() + index * 7);
        expiries.push(formatDate(expiry));
    }

    return { symbol, expiries };
};

const resolveSpot = async (symbol: string) => {
    const latest = await fetchLatestSpot(symbol);

    if (latest && Number.isFinite(latest.spot) && latest.spot > 0) {
        return latest;
    }

    const fallback = getSpotForSymbol(symbol);
    if (fallback <= 0) {
        throw new Error(`Failed to resolve a positive spot for ${symbol}`);
    }

    return {
        spot: fallback,
        source: 'alternate',
        asOf: new Date().toISOString(),
        alternate: latest?.alternate,
        error: latest?.error ? `Upstream spot unavailable: ${latest.error}` : 'Upstream spot unavailable',
    };
};

export const buildChainResponse = async (symbol: string, expiry: string): Promise<ChainResponse> => {
    const normalizedSymbol = symbol.toUpperCase();
    const spotInfo = await resolveSpot(normalizedSymbol);
    const spot = spotInfo.spot;
    const strikes = generateStrikes(spot);

    const contracts = strikes.flatMap((strike) => [
        createContract(normalizedSymbol, expiry, strike, 'call', spot),
        createContract(normalizedSymbol, expiry, strike, 'put', spot),
    ]);

    return {
        symbol: normalizedSymbol,
        spot,
        spotTimestamp: spotInfo.asOf,
        spotSource: spotInfo.source,
        spotAlternate: spotInfo.alternate,
        expiry,
        fetchedAt: new Date().toISOString(),
        contracts,
    };
};

export const calculateDte = (expiry: string) => daysToExpiry(expiry) ?? 0;

const passesFilters = (contract: OptionContract, spot: number, dte: number, filters?: AnalyzeRequest['filters']) => {
    if (!filters) return true;

    if (filters.dteMin !== undefined && dte < filters.dteMin) return false;
    if (filters.dteMax !== undefined && dte > filters.dteMax) return false;

    const moneyness = spot > 0 ? contract.strike / spot : 0;
    if (filters.moneynessMin !== undefined && moneyness < filters.moneynessMin) return false;
    if (filters.moneynessMax !== undefined && moneyness > filters.moneynessMax) return false;

    if (filters.minOpenInterest !== undefined && (contract.openInterest ?? 0) < filters.minOpenInterest) return false;

    if (filters.maxSpreadPct !== undefined) {
        const mid = (contract.ask + contract.bid) / 2;
        const spread = contract.ask - contract.bid;
        const spreadPct = mid > 0 ? (spread / mid) * 100 : Number.POSITIVE_INFINITY;
        if (spreadPct > filters.maxSpreadPct) return false;
    }

    return true;
};

export const buildAnalyzeResponse = async (request: AnalyzeRequest): Promise<AnalyzeResponse> => {
    const chain = await buildChainResponse(request.symbol, request.expiry);
    const dte = calculateDte(request.expiry);
    const tYears = timeToExpiryYears(request.expiry);
    const filteredContracts = chain.contracts.filter((contract) => passesFilters(contract, chain.spot, dte, request.filters));

    return {
        symbol: chain.symbol,
        spot: chain.spot,
        expiry: chain.expiry,
        dte,
        tYears: Number((tYears ?? 0).toFixed(6)),
        r: request.r,
        q: request.q,
        priceRule: 'mid',
        filteredCount: filteredContracts.length,
        totalCount: chain.contracts.length,
    };
};
