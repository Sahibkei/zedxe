import type { StatementValueType } from "@/lib/stocks/stockProfileV2.types";

const DASH = "--";

const compactNumber = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
});

const fullNumber = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
});

const integerNumber = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
});

export const formatNumberShort = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;
    return compactNumber.format(value);
};

export const formatNumber = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;
    return fullNumber.format(value);
};

export const formatInteger = (value?: number | null) => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;
    return integerNumber.format(value);
};

export const formatCurrencyShort = (value?: number | null, currency = "USD") => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;

    const prefix = currency.toUpperCase() === "USD" ? "$" : `${currency.toUpperCase()} `;
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";

    if (abs >= 1e12) return `${sign}${prefix}${(abs / 1e12).toFixed(2)}T`;
    if (abs >= 1e9) return `${sign}${prefix}${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}${prefix}${(abs / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${sign}${prefix}${(abs / 1e3).toFixed(2)}K`;

    return `${sign}${prefix}${abs.toFixed(2)}`;
};

export const formatCurrency = (value?: number | null, currency = "USD") => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `${currency.toUpperCase()} ${formatNumber(value)}`;
    }
};

export const formatPercent = (value?: number | null, digits = 2) => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;
    return `${value.toFixed(digits)}%`;
};

export const formatSignedPercent = (value?: number | null, digits = 2) => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(digits)}%`;
};

export const formatRatio = (value?: number | null, digits = 2) => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;
    return value.toFixed(digits);
};

export const formatStatementValue = (value: number | undefined, valueType: StatementValueType | undefined, currency?: string) => {
    if (typeof value !== "number" || Number.isNaN(value)) return DASH;

    if (valueType === "perShare") {
        return formatCurrency(value, currency || "USD");
    }

    if (valueType === "count") {
        return formatInteger(value);
    }

    return formatCurrencyShort(value, currency || "USD");
};

export const calculateCagr = (current?: number, previous?: number, years?: number) => {
    if (
        typeof current !== "number" ||
        typeof previous !== "number" ||
        typeof years !== "number" ||
        years <= 0 ||
        previous <= 0
    ) {
        return undefined;
    }

    return (Math.pow(current / previous, 1 / years) - 1) * 100;
};

export const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export const DASH_VALUE = DASH;
