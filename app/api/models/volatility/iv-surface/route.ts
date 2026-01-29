import { NextRequest, NextResponse } from "next/server";

type DeribitIndexPriceResponse = {
    result?: {
        index_price?: number;
    };
};

type DeribitInstrument = {
    instrument_name: string;
    expiration_timestamp: number;
    strike: number;
};

type DeribitInstrumentsResponse = {
    result?: DeribitInstrument[];
};

type DeribitBookSummary = {
    instrument_name: string;
    mark_iv: number | null;
};

type DeribitBookSummaryResponse = {
    result?: DeribitBookSummary[];
};

type DeribitHistoricalVolatilityEntry = {
    value: number;
    timestamp?: number;
};

type DeribitHistoricalVolatilityResponse = {
    result?: DeribitHistoricalVolatilityEntry[];
};

type IVPoint = {
    x: number;
    y: number;
    z: number;
    expiry: number;
};

type RawIVPoint = {
    instrument_name: string;
    strike: number;
    expiry: number;
    dteDays: number;
    x: number;
    markIvPct: number;
};

type SurfaceGrid = {
    x: number[];
    y: number[];
    z: number[][];
};

type GridStats = {
    zMin: number | null;
    zMax: number | null;
    zP5: number | null;
    zP95: number | null;
};

type SurfaceResponse = {
    symbol: string;
    snapshot_ts: string;
    spot: number | null;
    rv: number | null;
    skew: number | null;
    kurt: number | null;
    grid: SurfaceGrid;
    points_count: number;
    debug_samples?: RawIVPoint[];
    grid_stats?: GridStats;
    source: "deribit";
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const clampNumber = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const percentile = (values: number[], p: number) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
};

const median = (values: number[]) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
};

const linspace = (min: number, max: number, steps: number) => {
    if (steps <= 1) return [min];
    const step = (max - min) / (steps - 1);
    return Array.from({ length: steps }, (_, i) => min + step * i);
};

const nearestNeighborFill = (row: Array<number | null>) => {
    const result = [...row];
    const hasValues = result.some((value) => value !== null);
    if (!hasValues) {
        return result.map(() => 0);
    }
    for (let i = 0; i < result.length; i += 1) {
        if (result[i] !== null) continue;
        let left = i - 1;
        while (left >= 0 && result[left] === null) left -= 1;
        let right = i + 1;
        while (right < result.length && result[right] === null) right += 1;
        if (left < 0 && right >= result.length) {
            result[i] = 0;
        } else if (left < 0) {
            result[i] = result[right];
        } else if (right >= result.length) {
            result[i] = result[left];
        } else {
            const leftDist = i - left;
            const rightDist = right - i;
            result[i] = leftDist <= rightDist ? result[left] : result[right];
        }
    }
    return result.map((value) => value ?? 0);
};

const smoothRow = (row: number[]) => {
    if (row.length < 3) return row;
    return row.map((value, index) => {
        const left = row[index - 1] ?? value;
        const right = row[index + 1] ?? value;
        return (left + value + right) / 3;
    });
};

const solveQuadraticLeastSquares = (points: Array<{ x: number; z: number }>) => {
    if (points.length < 3) return null;
    let s1 = 0;
    let sx = 0;
    let sx2 = 0;
    let sx3 = 0;
    let sx4 = 0;
    let sz = 0;
    let sxz = 0;
    let sx2z = 0;
    for (const point of points) {
        const x = point.x;
        const x2 = x * x;
        const x3 = x2 * x;
        const x4 = x2 * x2;
        s1 += 1;
        sx += x;
        sx2 += x2;
        sx3 += x3;
        sx4 += x4;
        sz += point.z;
        sxz += x * point.z;
        sx2z += x2 * point.z;
    }

    const det =
        s1 * (sx2 * sx4 - sx3 * sx3) -
        sx * (sx * sx4 - sx2 * sx3) +
        sx2 * (sx * sx3 - sx2 * sx2);

    if (!Number.isFinite(det) || Math.abs(det) < 1e-10) {
        return null;
    }

    const detA =
        sz * (sx2 * sx4 - sx3 * sx3) -
        sx * (sxz * sx4 - sx3 * sx2z) +
        sx2 * (sxz * sx3 - sx2 * sx2z);
    const detB =
        s1 * (sxz * sx4 - sx3 * sx2z) -
        sz * (sx * sx4 - sx2 * sx3) +
        sx2 * (sx * sx2z - sx2 * sxz);
    const detC =
        s1 * (sx2 * sx2z - sx3 * sxz) -
        sx * (sx * sx2z - sx2 * sxz) +
        sz * (sx * sx3 - sx2 * sx2);

    return {
        a: detA / det,
        b: detB / det,
        c: detC / det,
    };
};

const parseNumber = (value: string | null, fallback: number) => {
    if (!value) return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

type FetchError = {
    message: string;
    status: number;
    detail?: string;
};

const fetchJson = async <T>(
    url: string,
    options?: { timeoutMs?: number; revalidate?: number }
): Promise<T> => {
    const timeoutMs = options?.timeoutMs ?? 8000;
    const revalidate = options?.revalidate ?? 30;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            next: { revalidate },
        });
        if (!response.ok) {
            const detail = await response.text().catch(() => "");
            throw {
                message: "Upstream response not OK",
                status: 502,
                detail,
            } satisfies FetchError;
        }
        try {
            return (await response.json()) as T;
        } catch (error) {
            throw {
                message: "Failed to parse JSON",
                status: 502,
                detail: error instanceof Error ? error.message : "Unknown parse error",
            } satisfies FetchError;
        }
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw {
                message: "Upstream request timed out",
                status: 503,
            } satisfies FetchError;
        }
        if (typeof error === "object" && error !== null && "status" in error) {
            throw error as FetchError;
        }
        throw {
            message: "Upstream request failed",
            status: 502,
            detail: error instanceof Error ? error.message : "Unknown error",
        } satisfies FetchError;
    } finally {
        clearTimeout(timeout);
    }
};

const getSpot = async () => {
    const data = await fetchJson<DeribitIndexPriceResponse>(
        "https://www.deribit.com/api/v2/public/get_index_price?index_name=btc_usd"
    );
    const spot = data.result?.index_price;
    return Number.isFinite(spot ?? NaN) ? (spot as number) : null;
};

const getInstruments = async () => {
    const data = await fetchJson<DeribitInstrumentsResponse>(
        "https://www.deribit.com/api/v2/public/get_instruments?currency=BTC&kind=option&expired=false"
    );
    return data.result ?? [];
};

const getBookSummaries = async () => {
    const data = await fetchJson<DeribitBookSummaryResponse>(
        "https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option"
    );
    return data.result ?? [];
};

const getHistoricalVolatility = async () => {
    const data = await fetchJson<DeribitHistoricalVolatilityResponse>(
        "https://www.deribit.com/api/v2/public/get_historical_volatility?currency=BTC",
        { timeoutMs: 12000, revalidate: 300 }
    );
    return data.result ?? [];
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = (searchParams.get("symbol") ?? "BTC").toUpperCase();
    const debug = searchParams.get("debug") === "1";

    if (symbol !== "BTC") {
        return NextResponse.json(
            { error: "Only BTC is supported at this time." },
            { status: 400 }
        );
    }

    const maxDays = clampNumber(
        parseNumber(searchParams.get("maxDays"), 180),
        7,
        365
    );
    const expiries = clampNumber(
        parseNumber(searchParams.get("expiries"), 25),
        5,
        60
    );
    const xMin = clampNumber(
        parseNumber(searchParams.get("xMin"), -0.8),
        -2,
        -0.1
    );
    const xMax = clampNumber(
        parseNumber(searchParams.get("xMax"), 0.8),
        0.1,
        2
    );
    const xSteps = clampNumber(
        Math.round(parseNumber(searchParams.get("xSteps"), 60)),
        10,
        120
    );

    if (xMin >= xMax) {
        return NextResponse.json(
            { error: "xMin must be less than xMax." },
            { status: 400 }
        );
    }

    const snapshot = new Date();
    let spot: number | null = null;
    let instruments: DeribitInstrument[] = [];
    let summaries: DeribitBookSummary[] = [];
    let historicalVol: DeribitHistoricalVolatilityEntry[] = [];
    try {
        [spot, instruments, summaries, historicalVol] = await Promise.all([
            getSpot(),
            getInstruments(),
            getBookSummaries(),
            getHistoricalVolatility(),
        ]);
    } catch (error) {
        const detail =
            typeof error === "object" && error !== null && "detail" in error
                ? (error as FetchError).detail
                : undefined;
        const status =
            typeof error === "object" && error !== null && "status" in error
                ? (error as FetchError).status
                : 502;
        return NextResponse.json(
            {
                error: "Upstream data unavailable",
                detail,
            },
            { status: status >= 500 ? status : 502 }
        );
    }

    const summaryMap = new Map(
        summaries.map((summary) => [summary.instrument_name, summary])
    );

    const now = snapshot.getTime();
    const maxExpiryTs = now + maxDays * MS_PER_DAY;

    const points: IVPoint[] = [];
    const rawPoints: RawIVPoint[] = [];

    for (const instrument of instruments) {
        const summary = summaryMap.get(instrument.instrument_name);
        const markIv = summary?.mark_iv;
        if (!Number.isFinite(markIv ?? NaN)) continue;
        if ((markIv as number) <= 0) continue;
        if (!Number.isFinite(spot ?? NaN)) continue;
        if (!Number.isFinite(instrument.strike ?? NaN)) continue;
        if (instrument.strike <= 0) continue;
        if (instrument.expiration_timestamp > maxExpiryTs) continue;
        if (instrument.expiration_timestamp <= now) continue;

        const dteDays =
            (instrument.expiration_timestamp - now) / MS_PER_DAY;
        const x = Math.log(instrument.strike / (spot as number));
        const y = Number(dteDays.toFixed(2));
        const markIvPct = markIv as number;
        const z = markIvPct / 100;

        rawPoints.push({
            instrument_name: instrument.instrument_name,
            strike: instrument.strike,
            expiry: instrument.expiration_timestamp,
            dteDays: y,
            x,
            markIvPct,
        });

        if (x < xMin || x > xMax) continue;

        points.push({
            x,
            y,
            z,
            expiry: instrument.expiration_timestamp,
        });
    }

    const expiriesSorted = Array.from(
        new Set(points.map((point) => point.expiry))
    )
        .sort((a, b) => a - b)
        .slice(0, expiries);

    const yGrid = expiriesSorted.map((expiry) =>
        Number(((expiry - now) / MS_PER_DAY).toFixed(2))
    );
    const xGrid = linspace(xMin, xMax, xSteps);

    const step = xGrid.length > 1 ? xGrid[1] - xGrid[0] : 1;

    const zGrid: number[][] = expiriesSorted.map((expiry) => {
        const rowBuckets: Array<number[]> = Array.from(
            { length: xGrid.length },
            () => []
        );
        const expiryPoints = points.filter((point) => point.expiry === expiry);
        const expiryValues = expiryPoints.map((point) =>
            clampNumber(point.z, 0.05, 2.5)
        );
        const zP5 = percentile(expiryValues, 0.05);
        const zP95 = percentile(expiryValues, 0.95);
        for (const point of expiryPoints) {
            const zBase = clampNumber(point.z, 0.05, 2.5);
            const zValue =
                zP5 !== null && zP95 !== null
                    ? clampNumber(zBase, zP5, zP95)
                    : zBase;
            const rawIndex = (point.x - xMin) / step;
            const bucketIndex = Math.round(rawIndex);
            if (bucketIndex < 0 || bucketIndex >= xGrid.length) continue;
            rowBuckets[bucketIndex].push(zValue);
        }
        const row = rowBuckets.map((bucket) => median(bucket));
        const filled = nearestNeighborFill(row);
        return smoothRow(filled);
    });

    const targetExpiry = expiriesSorted.reduce<null | number>((best, expiry) => {
        if (best === null) return expiry;
        const bestDiff = Math.abs(best - (now + 30 * MS_PER_DAY));
        const diff = Math.abs(expiry - (now + 30 * MS_PER_DAY));
        return diff < bestDiff ? expiry : best;
    }, null);

    let skew: number | null = null;
    let kurt: number | null = null;
    if (targetExpiry !== null) {
        const smilePoints = points
            .filter((point) => point.expiry === targetExpiry)
            .map((point) => ({ x: point.x, z: point.z }));
        const fit = solveQuadraticLeastSquares(smilePoints);
        if (fit) {
            skew = fit.b;
            kurt = fit.c;
        }
    }

    let rv: number | null = null;
    if (historicalVol.length > 0) {
        const last = historicalVol[historicalVol.length - 1];
        if (Number.isFinite(last?.value ?? NaN)) {
            rv = last.value > 1 ? last.value / 100 : last.value;
        }
    }

    const flattenedZ = zGrid.flat();
    const gridStats: GridStats = {
        zMin: flattenedZ.length ? Math.min(...flattenedZ) : null,
        zMax: flattenedZ.length ? Math.max(...flattenedZ) : null,
        zP5: flattenedZ.length ? percentile(flattenedZ, 0.05) : null,
        zP95: flattenedZ.length ? percentile(flattenedZ, 0.95) : null,
    };

    let debugSamples: RawIVPoint[] | undefined;
    if (debug) {
        const sortedByAbsX = [...rawPoints].sort(
            (a, b) => Math.abs(a.x) - Math.abs(b.x)
        );
        const atm = sortedByAbsX.slice(0, 12);
        const wings = [...rawPoints]
            .sort((a, b) => Math.abs(b.x) - Math.abs(a.x))
            .slice(0, 13);
        debugSamples = [...atm, ...wings].slice(0, 25);
    }

    const response: SurfaceResponse = {
        symbol,
        snapshot_ts: snapshot.toISOString(),
        spot,
        rv,
        skew,
        kurt,
        grid: {
            x: xGrid,
            y: yGrid,
            z: zGrid,
        },
        points_count: points.length,
        ...(debug ? { debug_samples: debugSamples, grid_stats: gridStats } : {}),
        source: "deribit",
    };

    return NextResponse.json(response, {
        headers: {
            "Cache-Control": "s-maxage=30, stale-while-revalidate=300",
        },
    });
}
