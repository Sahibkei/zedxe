/**
 * Standard normal cumulative distribution function.
 */
export function normCdf(x: number): number {
    if (!Number.isFinite(x)) return NaN;
    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + 0.3275911 * absX);
    const coefficients = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429];
    const poly = coefficients.reduce((accumulator, coefficient) => accumulator * t + coefficient, 0);
    const erf = 1 - poly * Math.exp(-absX * absX);
    return 0.5 * (1 + sign * erf);
}

/**
 * Standard normal probability density function.
 */
export function normPdf(x: number): number {
    if (!Number.isFinite(x)) return NaN;
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

/**
 * Intrinsic value of an option (per share).
 */
export function intrinsicValue(side: 'call' | 'put', S: number, K: number): number {
    if (!Number.isFinite(S) || !Number.isFinite(K)) return NaN;
    if (side === 'call') return Math.max(0, S - K);
    return Math.max(0, K - S);
}

/**
 * Simple strike-to-spot moneyness ratio (K / S).
 */
export function moneyness(S: number, K: number): number {
    if (!Number.isFinite(S) || S <= 0 || !Number.isFinite(K)) return NaN;
    return K / S;
}

type BsD1D2 = {
    d1: number;
    d2: number;
    sqrtT: number;
    discountedSpot: number;
    discountedStrike: number;
};

/**
 * Compute the Black-Scholes d1/d2 terms and discounted spot/strike values.
 */
const computeD1D2 = (params: { S: number; K: number; r: number; q: number; t: number; sigma: number }): BsD1D2 | null => {
    const { S, K, r, q, t, sigma } = params;
    if (!Number.isFinite(S) || !Number.isFinite(K) || !Number.isFinite(r) || !Number.isFinite(q) || !Number.isFinite(t) || !Number.isFinite(sigma)) {
        return null;
    }
    if (S <= 0 || K <= 0 || t <= 0 || sigma <= 0) return null;

    const sqrtT = Math.sqrt(t);
    const denominator = sigma * sqrtT;
    if (denominator === 0) return null;

    const logMoneyness = Math.log(S / K);
    const d1 = (logMoneyness + (r - q + 0.5 * sigma * sigma) * t) / denominator;
    const d2 = d1 - denominator;
    const discountedSpot = S * Math.exp(-q * t);
    const discountedStrike = K * Math.exp(-r * t);
    return { d1, d2, sqrtT, discountedSpot, discountedStrike };
};

/**
 * Black-Scholes-Merton option value (per share).
 */
export function bsPrice(params: { side: 'call' | 'put'; S: number; K: number; r: number; q: number; t: number; sigma: number }): number {
    const { side, S, K, r, q, t, sigma } = params;
    const state = computeD1D2({ S, K, r, q, t, sigma });
    if (!state) return NaN;

    const { d1, d2, discountedSpot, discountedStrike } = state;

    if (side === 'call') {
        return discountedSpot * normCdf(d1) - discountedStrike * normCdf(d2);
    }

    return discountedStrike * normCdf(-d2) - discountedSpot * normCdf(-d1);
}

/**
 * Black-Scholes-Merton greeks.
 *
 * - Vega is returned per 1.00 volatility (e.g., divide by 100 for per 1% vol move).
 * - Theta is returned per year (annualized).
 */
export function bsGreeks(params: {
    side: 'call' | 'put';
    S: number;
    K: number;
    r: number;
    q: number;
    t: number;
    sigma: number;
}): { delta: number; gamma: number; vega: number; theta: number; rho: number } | null {
    const { side, S, K, r, q, t, sigma } = params;
    const state = computeD1D2({ S, K, r, q, t, sigma });
    if (!state) return null;

    const { d1, d2, sqrtT, discountedSpot, discountedStrike } = state;
    const pdf = normPdf(d1);
    const delta = side === 'call' ? Math.exp(-q * t) * normCdf(d1) : Math.exp(-q * t) * (normCdf(d1) - 1);
    const gamma = (Math.exp(-q * t) * pdf) / (S * sigma * sqrtT);
    const vega = discountedSpot * pdf * sqrtT;
    const thetaBase = -(discountedSpot * pdf * sigma) / (2 * sqrtT);
    const theta =
        side === 'call'
            ? thetaBase - r * discountedStrike * normCdf(d2) + q * discountedSpot * normCdf(d1)
            : thetaBase + r * discountedStrike * normCdf(-d2) - q * discountedSpot * normCdf(-d1);
    const rho = side === 'call' ? discountedStrike * t * normCdf(d2) : -discountedStrike * t * normCdf(-d2);

    if (![delta, gamma, vega, theta, rho].every(Number.isFinite)) return null;
    return { delta, gamma, vega, theta, rho };
}

/**
 * Risk-neutral probability of expiring in-the-money based on d2.
 */
export function bsProbITM(params: { side: 'call' | 'put'; S: number; K: number; r: number; q: number; t: number; sigma: number }): number | null {
    const { side, S, K, r, q, t, sigma } = params;
    const state = computeD1D2({ S, K, r, q, t, sigma });
    if (!state) return null;
    const { d2 } = state;
    const prob = side === 'call' ? normCdf(d2) : normCdf(-d2);
    return Number.isFinite(prob) ? prob : null;
}

/**
 * Solve for implied volatility using a simple bisection method.
 */
export function impliedVolBisection(params: {
    side: 'call' | 'put';
    S: number;
    K: number;
    r: number;
    q: number;
    t: number;
    price: number;
}): number | null {
    const { side, S, K, r, q, t, price } = params;
    if (t <= 0 || !Number.isFinite(price)) return null;

    const intrinsic = intrinsicValue(side, S, K);
    if (!Number.isFinite(intrinsic) || price <= intrinsic + 1e-6) return null;

    const discountedSpot = S * Math.exp(-q * t);
    const discountedStrike = K * Math.exp(-r * t);
    const callLower = Math.max(0, discountedSpot - discountedStrike);
    const callUpper = discountedSpot;
    const putLower = Math.max(0, discountedStrike - discountedSpot);
    const putUpper = discountedStrike;
    const lowerBound = side === 'call' ? callLower : putLower;
    const upperBound = side === 'call' ? callUpper : putUpper;
    const priceTolerance = 1e-6;
    if (price < lowerBound - priceTolerance || price > upperBound + priceTolerance) return null;

    let low = 1e-6;
    let high = 5;
    const priceTol = 1e-6;
    const volTol = 1e-6;
    const maxIter = 80;

    for (let iteration = 0; iteration < maxIter; iteration += 1) {
        const mid = (low + high) / 2;
        const theoretical = bsPrice({ side, S, K, r, q, t, sigma: mid });
        if (!Number.isFinite(theoretical)) return null;

        const diff = theoretical - price;
        if (Math.abs(diff) < priceTol || Math.abs(high - low) < volTol) {
            return mid;
        }

        if (theoretical > price) {
            high = mid;
        } else {
            low = mid;
        }
    }

    return (low + high) / 2;
}

export function impliedVolRecoverySample() {
    const params = { side: 'call' as const, S: 100, K: 105, r: 0.02, q: 0.0, t: 45 / 365, sigma: 0.25 };
    const price = bsPrice(params);
    const recovered = impliedVolBisection({ side: params.side, S: params.S, K: params.K, r: params.r, q: params.q, t: params.t, price });
    return { ...params, price, recovered };
}

export function verifyImpliedVolRecovery(tolerance = 1e-3) {
    const sample = impliedVolRecoverySample();
    if (sample.recovered === null || !Number.isFinite(sample.recovered)) return false;
    return Math.abs(sample.recovered - sample.sigma) < tolerance;
}
