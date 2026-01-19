export const parseAsOf = (datetime: string) => {
    const trimmed = datetime.trim();
    if (!trimmed) {
        return new Date().toISOString();
    }
    const withTime = trimmed.includes("T")
        ? trimmed
        : trimmed.replace(" ", "T");
    const hasTimezone =
        /[zZ]$/.test(withTime) || /[+-]\d{2}:?\d{2}$/.test(withTime);
    const normalized = hasTimezone ? withTime : `${withTime}Z`;
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return new Date().toISOString();
    }
    return parsed.toISOString();
};
