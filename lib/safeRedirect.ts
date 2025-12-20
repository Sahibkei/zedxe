const DEFAULT_ALLOWED_PREFIXES = ["/dashboard", "/app"];

export const safeRedirect = (
    input: string | null | undefined,
    fallback = "/dashboard",
    allowedPrefixes = DEFAULT_ALLOWED_PREFIXES
): string => {
    if (!input) {
        return fallback;
    }

    let decoded = input;

    try {
        decoded = decodeURIComponent(input);
    } catch {
        decoded = input;
    }

    const candidate = decoded.trim();

    if (!candidate.startsWith("/")) {
        return fallback;
    }

    if (candidate.startsWith("//")) {
        return fallback;
    }

    if (candidate.includes("://")) {
        return fallback;
    }

    if (candidate.includes("\\")) {
        return fallback;
    }

    if (/\r|\n/.test(candidate)) {
        return fallback;
    }

    const matchesPrefix = allowedPrefixes.some((prefix) => candidate.startsWith(prefix));

    return matchesPrefix ? candidate : fallback;
};
