export const formatNumber = (value: number, maximumFractionDigits = 4) =>
    value.toLocaleString(undefined, { maximumFractionDigits });

export const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'A$',
    NZD: 'NZ$',
    JPY: '¥',
    CNY: '¥',
    INR: '₹',
};

/**
 * Formats large financial values using compact units (K, M, B, T) while preserving currency symbols.
 */
export const formatCompactFinancialValue = (value?: number, currency?: string) => {
    if (value === undefined || value === null || Number.isNaN(value)) return '—';

    const upperCurrency = currency?.toUpperCase();
    const symbol = upperCurrency ? CURRENCY_SYMBOLS[upperCurrency] || '' : '';
    const sign = value < 0 ? '-' : '';
    const absolute = Math.abs(value);

    const formatWithUnit = (val: number, unit?: string) => {
        const formatted = val.toFixed(2);
        const prefix = symbol || '';
        const suffix = unit ?? '';
        const currencyCode = !symbol && upperCurrency ? ` ${upperCurrency}` : '';

        return `${sign}${prefix}${formatted}${suffix}${currencyCode}`.trim();
    };

    if (absolute >= 1e12) return formatWithUnit(absolute / 1e12, 'T');
    if (absolute >= 1e9) return formatWithUnit(absolute / 1e9, 'B');
    if (absolute >= 1e6) return formatWithUnit(absolute / 1e6, 'M');
    if (absolute >= 1e3) return formatWithUnit(absolute / 1e3, 'K');

    return formatWithUnit(absolute);
};
