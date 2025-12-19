const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = MS_PER_DAY * 365;
const MARKET_CLOSE_UTC_HOUR = 21; // Approx 4:00 PM America/New_York (ignores DST drift)
const MARKET_CLOSE_UTC_MINUTE = 0;
const MIN_EXPIRY_MS = 60 * 1000; // one minute safety floor

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const expiryToTimestamp = (expiry: string): number | null => {
    if (!expiry || typeof expiry !== 'string') return null;
    const [year, month, day] = expiry.split('-').map((part) => Number(part));
    if (!isFiniteNumber(year) || !isFiniteNumber(month) || !isFiniteNumber(day)) return null;
    const utc = Date.UTC(year, month - 1, day, MARKET_CLOSE_UTC_HOUR, MARKET_CLOSE_UTC_MINUTE, 0, 0);
    if (!Number.isFinite(utc)) return null;
    return utc;
};

export const daysToExpiry = (expiry: string, nowMs = Date.now()): number | null => {
    const expiryMs = expiryToTimestamp(expiry);
    if (expiryMs === null) return null;
    const diffMs = expiryMs - nowMs;
    if (!Number.isFinite(diffMs)) return null;
    return Math.max(0, Math.round(diffMs / MS_PER_DAY));
};

export const timeToExpiryYears = (expiry: string, nowMs = Date.now()): number | null => {
    const expiryMs = expiryToTimestamp(expiry);
    if (expiryMs === null) return null;
    const diffMs = expiryMs - nowMs;
    if (!Number.isFinite(diffMs)) return null;
    if (diffMs < -MIN_EXPIRY_MS) return null;
    const clamped = Math.max(diffMs, MIN_EXPIRY_MS);
    return clamped / MS_PER_YEAR;
};

export const msPerYear = MS_PER_YEAR;
export const msPerDay = MS_PER_DAY;
