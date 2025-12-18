const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const normalizeSymbol = (symbol: string) => symbol.trim().toUpperCase();

export const isValidIsoDate = (value: string) => {
    if (!ISO_DATE_REGEX.test(value)) return false;

    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return false;

    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();

    const [yyyy, mm, dd] = value.split('-').map((part) => Number(part));
    return year === yyyy && month === mm && day === dd;
};

export const requireQuery = (searchParams: URLSearchParams, key: string) => {
    const value = searchParams.get(key);
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
};
