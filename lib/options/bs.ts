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

export function intrinsicValue(side: 'call' | 'put', S: number, K: number): number {
    if (!Number.isFinite(S) || !Number.isFinite(K)) return NaN;
    if (side === 'call') return Math.max(0, S - K);
    return Math.max(0, K - S);
}

export function moneyness(S: number, K: number): number {
    if (!Number.isFinite(S) || S <= 0 || !Number.isFinite(K)) return NaN;
    return K / S;
}

export function bsPrice(params: { side: 'call' | 'put'; S: number; K: number; r: number; q: number; t: number; sigma: number }): number {
    const { side, S, K, r, q, t, sigma } = params;
    if (!Number.isFinite(S) || !Number.isFinite(K) || !Number.isFinite(r) || !Number.isFinite(q) || !Number.isFinite(t) || !Number.isFinite(sigma)) {
        return NaN;
    }
    if (S <= 0 || K <= 0 || t <= 0 || sigma <= 0) return NaN;

    const sqrtT = Math.sqrt(t);
    const denominator = sigma * sqrtT;
    if (denominator === 0) return NaN;

    const logMoneyness = Math.log(S / K);
    const d1 = (logMoneyness + (r - q + 0.5 * sigma * sigma) * t) / denominator;
    const d2 = d1 - denominator;

    const discountedSpot = S * Math.exp(-q * t);
    const discountedStrike = K * Math.exp(-r * t);

    if (side === 'call') {
        return discountedSpot * normCdf(d1) - discountedStrike * normCdf(d2);
    }

    return discountedStrike * normCdf(-d2) - discountedSpot * normCdf(-d1);
}

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

    let low = 1e-6;
    let high = 5;
    const tolerance = 1e-6;

    for (let iteration = 0; iteration < 80; iteration += 1) {
        const mid = (low + high) / 2;
        const theoretical = bsPrice({ side, S, K, r, q, t, sigma: mid });
        if (!Number.isFinite(theoretical)) return null;

        const diff = theoretical - price;
        if (Math.abs(diff) < tolerance) {
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
