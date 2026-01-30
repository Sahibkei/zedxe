import type { VolMomoAnalysis } from "@/lib/models/vol-momo";

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 20;

const analysisCache = new Map<string, { expiresAt: number; value: VolMomoAnalysis }>();

const pruneCache = () => {
    const now = Date.now();
    for (const [key, entry] of analysisCache.entries()) {
        if (entry.expiresAt <= now) {
            analysisCache.delete(key);
        }
    }
    while (analysisCache.size > MAX_ENTRIES) {
        const oldestKey = analysisCache.keys().next().value;
        if (!oldestKey) break;
        analysisCache.delete(oldestKey);
    }
};

/**
 * Read a cached Vol-Momo analysis by key.
 * @param key - Unique cache key for the analysis.
 * @returns Cached analysis or null if missing/expired.
 */
export const getCachedVolMomoAnalysis = (key: string) => {
    pruneCache();
    const entry = analysisCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        analysisCache.delete(key);
        return null;
    }
    return entry.value;
};

/**
 * Store a Vol-Momo analysis in the cache.
 * @param key - Unique cache key for the analysis.
 * @param value - Analysis payload to cache.
 */
export const setCachedVolMomoAnalysis = (key: string, value: VolMomoAnalysis) => {
    pruneCache();
    analysisCache.delete(key);
    analysisCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
};

/**
 * Build a deterministic cache key for Vol-Momo API queries.
 * @param parts - Parts to concatenate into a cache key.
 * @returns Stable cache key string.
 */
export const buildVolMomoCacheKey = (parts: Array<string | number>) =>
    `vol-momo:${parts.join(":")}`;
