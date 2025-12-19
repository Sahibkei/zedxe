import { bsGreeks, impliedVolBisection } from './bs';
import type { OptionChainQuote, OptionPriceSource, OptionSide } from './types';

export const OPTION_PRICE_SOURCES: OptionPriceSource[] = ['mid', 'bid', 'ask', 'last'];

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const selectPremium = (params: {
    bid: number;
    ask: number;
    last?: number;
    priceSource: OptionPriceSource;
}): number | null => {
    const { bid, ask, last, priceSource } = params;
    const mid = isFiniteNumber(bid) && isFiniteNumber(ask) ? (bid + ask) / 2 : null;
    const priceMap: Record<OptionPriceSource, number | undefined> = {
        mid: mid ?? undefined,
        bid,
        ask,
        last,
    };
    const premium = priceMap[priceSource];
    if (isFiniteNumber(premium)) return premium;
    return isFiniteNumber(mid) ? mid : null;
};

export const buildOptionChainQuote = (params: {
    side: OptionSide;
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
    const mid = isFiniteNumber(bid) && isFiniteNumber(ask) ? (bid + ask) / 2 : null;
    const premium = selectPremium({ bid, ask, last, priceSource });

    let iv = isFiniteNumber(impliedVol) ? impliedVol : null;
    if (!iv && isFiniteNumber(premium) && premium > 0) {
        iv = impliedVolBisection({ side, S: spot, K: strike, r, q, t: tYears, price: premium });
    }

    const greeks = iv ? bsGreeks({ side, S: spot, K: strike, r, q, t: tYears, sigma: iv }) : null;

    return {
        bid: isFiniteNumber(bid) ? bid : null,
        ask: isFiniteNumber(ask) ? ask : null,
        last: isFiniteNumber(last) ? last : null,
        mid: isFiniteNumber(mid) ? mid : null,
        iv: isFiniteNumber(iv) ? iv : null,
        delta: greeks?.delta ?? null,
        volume: isFiniteNumber(volume) ? volume : null,
        openInterest: isFiniteNumber(openInterest) ? openInterest : null,
    };
};
