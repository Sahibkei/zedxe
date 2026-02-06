export function canonicalizeSymbol(raw: string | undefined | null): string {
    if (!raw) {
        throw new Error("Symbol is required");
    }
    const cleaned = raw.replace(/\s+/g, "").trim().toUpperCase();
    if (!cleaned) {
        throw new Error("Symbol is required");
    }
    return cleaned;
}

export function canonicalPathSymbol(raw: string): string {
    return canonicalizeSymbol(raw);
}
