export type VolMomoInterval = "5m" | "15m" | "1h" | "4h" | "1d";
export type VolMomoMode = "quantile" | "sigma";

export type VolMomoMeta = {
    symbol: string;
    interval: VolMomoInterval;
    lookbackDays: number;
    k: number;
    bins: number;
    minSamples: number;
    mode: VolMomoMode;
    hBars: number;
    source: string;
    nCandles: number;
    startTs: number;
    endTs: number;
    nSamples: number;
    firstClose: number;
    lastClose: number;
};

export type VolMomoAxes = {
    xLabel: string;
    yLabel: string;
    xEdges: number[];
    yEdges: number[];
    xTickLabels: string[];
    yTickLabels: string[];
};

export type VolMomoResponse = {
    meta: VolMomoMeta;
    axes: VolMomoAxes;
    grids: {
        pWin: Array<Array<number | null>>;
        meanFwd: Array<Array<number | null>>;
        count: number[][];
    };
    current: {
        zm: number;
        zv: number;
        momo: number;
        vol: number;
        i: number;
        j: number;
    };
};

export type VolMomoSample = {
    binI: number;
    binJ: number;
    forwardReturn: number;
};

export type VolMomoAnalysis = {
    response: VolMomoResponse;
    samples: VolMomoSample[];
};

export type VolMomoCellResponse = {
    meta: {
        i: number;
        j: number;
        count: number;
        mean: number | null;
        median: number | null;
        p05: number | null;
        p95: number | null;
        pWin: number | null;
    };
    histogram: {
        edges: number[];
        counts: number[];
    };
};

export type Candle = {
    openTime: number;
    closeTime: number;
    close: number;
};

const BINANCE_ENDPOINTS = [
    "https://api.binance.com/api/v3/klines",
    "https://data-api.binance.vision/api/v3/klines",
];

const INTERVAL_MS: Record<VolMomoInterval, number> = {
    "5m": 5 * 60 * 1000,
    "15m": 15 * 60 * 1000,
    "1h": 60 * 60 * 1000,
    "4h": 4 * 60 * 60 * 1000,
    "1d": 24 * 60 * 60 * 1000,
};

const DAY_MS = 24 * 60 * 60 * 1000;

const clampNumber = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), max);

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

const stddev = (values: number[], mu?: number) => {
    if (values.length < 2) return 0;
    const avg = mu ?? mean(values);
    const variance =
        values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
        (values.length - 1);
    return Math.sqrt(variance);
};

const quantile = (values: number[], q: number) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const pos = (sorted.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    const next = sorted[base + 1];
    if (next === undefined) return sorted[base];
    return sorted[base] + rest * (next - sorted[base]);
};

const buildQuantileEdges = (values: number[], bins: number) => {
    const edges: number[] = [];
    for (let i = 0; i <= bins; i += 1) {
        edges.push(quantile(values, i / bins));
    }
    for (let i = 1; i < edges.length; i += 1) {
        if (edges[i] <= edges[i - 1]) {
            edges[i] = edges[i - 1] + 1e-8;
        }
    }
    return edges;
};

const buildSigmaEdges = (bins: number) => {
    const edges: number[] = [];
    const step = 6 / bins;
    for (let i = 0; i <= bins; i += 1) {
        edges.push(-3 + step * i);
    }
    return edges;
};

const buildTickLabels = (edges: number[]) => {
    const labels: string[] = [];
    for (let i = 0; i < edges.length - 1; i += 1) {
        labels.push(`${edges[i].toFixed(2)}..${edges[i + 1].toFixed(2)}`);
    }
    return labels;
};

const findBin = (value: number, edges: number[]) => {
    if (Number.isNaN(value)) return -1;
    if (value <= edges[0]) return 0;
    if (value >= edges[edges.length - 1]) return edges.length - 2;
    for (let i = 0; i < edges.length - 1; i += 1) {
        if (value >= edges[i] && value < edges[i + 1]) {
            return i;
        }
    }
    return -1;
};

const extractCloses = (candles: Candle[]) => candles.map((candle) => candle.close);

/**
 * Fetch OHLC candles from Binance with fallback endpoints.
 * @param params - Symbol, interval, and time range for the request.
 * @returns Result with candles or an error message.
 */
export const fetchBinanceCandles = async (params: {
    symbol: string;
    interval: VolMomoInterval;
    startTime: number;
    endTime: number;
    requiredCandles: number;
}): Promise<{ ok: true; candles: Candle[] } | { ok: false; error: string }> => {
    const allCandles: Candle[] = [];
    let cursor = params.startTime;
    const intervalMs = INTERVAL_MS[params.interval];
    const maxLoops = 200;

    for (let loop = 0; loop < maxLoops && cursor < params.endTime; loop += 1) {
        if (allCandles.length >= params.requiredCandles) {
            break;
        }
        const requestParams = new URLSearchParams({
            symbol: params.symbol,
            interval: params.interval,
            startTime: cursor.toString(),
            endTime: params.endTime.toString(),
            limit: "1000",
        });

        let responsePayload: unknown = null;
        let lastError: unknown = null;

        for (const endpoint of BINANCE_ENDPOINTS) {
            try {
                const response = await fetch(`${endpoint}?${requestParams.toString()}`, {
                    cache: "no-store",
                });
                if (!response.ok) {
                    lastError = new Error(`Binance HTTP ${response.status}`);
                    continue;
                }
                responsePayload = await response.json();
                lastError = null;
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!Array.isArray(responsePayload)) {
            return {
                ok: false,
                error: `Failed to load klines: ${String(lastError ?? "invalid response")}`,
            };
        }

        const parsed = responsePayload
            .map((entry) => {
                const [openTime, , , , close, , closeTime] = entry as [
                    number,
                    string,
                    string,
                    string,
                    string,
                    string,
                    number,
                ];
                const closeValue = Number(close);
                if (!Number.isFinite(openTime) || !Number.isFinite(closeTime)) return null;
                if (!Number.isFinite(closeValue)) return null;
                return {
                    openTime,
                    closeTime,
                    close: closeValue,
                } satisfies Candle;
            })
            .filter((item): item is Candle => item !== null);

        if (parsed.length === 0) {
            break;
        }

        allCandles.push(...parsed);
        const last = parsed[parsed.length - 1];
        if (!last) break;
        const nextCursor = last.openTime + intervalMs;
        if (nextCursor <= cursor) break;
        cursor = nextCursor;
        if (parsed.length < 1000) break;
    }

    const now = Date.now();
    const filtered = allCandles.filter((candle) => candle.closeTime <= now);

    if (!filtered.length) {
        return { ok: false, error: "No candles returned from Binance." };
    }

    const deduped = filtered.filter((candle, index, arr) => {
        const prev = arr[index - 1];
        return !prev || prev.openTime !== candle.openTime;
    });

    return { ok: true, candles: deduped };
};

/**
 * Compute the Volatility × Momentum grids and sample metadata.
 * @param params - Input series, binning, and model configuration.
 * @returns Analysis payload containing API response and raw samples.
 */
export const computeVolMomoAnalysis = (params: {
    candles: Candle[];
    interval: VolMomoInterval;
    lookbackDays: number;
    k: number;
    bins: number;
    minSamples: number;
    mode: VolMomoMode;
    hBars: number;
    symbol: string;
    source: string;
}): { ok: true; analysis: VolMomoAnalysis } | { ok: false; error: string } => {
    const { candles, interval, lookbackDays, k, bins, minSamples, mode, hBars, symbol, source } =
        params;

    if (candles.length < k + hBars + 5) {
        return { ok: false, error: "Not enough candles to compute model." };
    }

    const intervalMs = INTERVAL_MS[interval];
    const lookbackBars = Math.round((lookbackDays * DAY_MS) / intervalMs);
    const requiredBars = Math.max(lookbackBars + k + hBars + 2, k + hBars + 2);
    const slicedCandles = candles.slice(-requiredBars);
    const closes = extractCloses(slicedCandles);

    if (closes.length < k + hBars + 2) {
        return { ok: false, error: "Not enough candles after lookback window." };
    }

    const ret1: number[] = [];
    for (let i = 1; i < closes.length; i += 1) {
        ret1.push(Math.log(closes[i] / closes[i - 1]));
    }

    const momos: number[] = [];
    const vols: number[] = [];
    const fwds: number[] = [];

    for (let t = k; t < closes.length - hBars; t += 1) {
        const prevClose = closes[t - k];
        const currentClose = closes[t];
        if (!prevClose || !currentClose) continue;
        const momentum = currentClose / prevClose - 1;
        const returnsSlice = ret1.slice(t - k, t);
        if (returnsSlice.length < k) continue;
        const vol = stddev(returnsSlice);
        const futureClose = closes[t + hBars];
        if (!futureClose) continue;
        const forwardReturn = futureClose / currentClose - 1;
        if (
            !Number.isFinite(momentum) ||
            !Number.isFinite(vol) ||
            !Number.isFinite(forwardReturn)
        ) {
            continue;
        }
        momos.push(momentum);
        vols.push(vol);
        fwds.push(forwardReturn);
    }

    if (momos.length === 0) {
        return { ok: false, error: "No valid samples after filtering." };
    }

    const momoMean = mean(momos);
    const momoStd = stddev(momos, momoMean) || 1;
    const volMean = mean(vols);
    const volStd = stddev(vols, volMean) || 1;

    const valuesX = mode === "sigma" ? momos.map((v) => (v - momoMean) / momoStd) : momos;
    const valuesY = mode === "sigma" ? vols.map((v) => (v - volMean) / volStd) : vols;

    const xEdges = mode === "sigma" ? buildSigmaEdges(bins) : buildQuantileEdges(valuesX, bins);
    const yEdges = mode === "sigma" ? buildSigmaEdges(bins) : buildQuantileEdges(valuesY, bins);

    const counts: number[][] = Array.from({ length: bins }, () => Array(bins).fill(0));
    const sumFwd: number[][] = Array.from({ length: bins }, () => Array(bins).fill(0));
    const sumWin: number[][] = Array.from({ length: bins }, () => Array(bins).fill(0));
    const samples: VolMomoSample[] = [];

    for (let idx = 0; idx < valuesX.length; idx += 1) {
        const i = findBin(valuesX[idx], xEdges);
        const j = findBin(valuesY[idx], yEdges);
        if (i < 0 || j < 0) continue;
        const fwd = fwds[idx];
        counts[j][i] += 1;
        sumFwd[j][i] += fwd;
        sumWin[j][i] += fwd > 0 ? 1 : 0;
        samples.push({ binI: i, binJ: j, forwardReturn: fwd });
    }

    const meanFwd: Array<Array<number | null>> = Array.from({ length: bins }, () =>
        Array(bins).fill(null)
    );
    const pWin: Array<Array<number | null>> = Array.from({ length: bins }, () =>
        Array(bins).fill(null)
    );

    for (let j = 0; j < bins; j += 1) {
        for (let i = 0; i < bins; i += 1) {
            const count = counts[j][i];
            if (count >= minSamples) {
                meanFwd[j][i] = sumFwd[j][i] / count;
                pWin[j][i] = sumWin[j][i] / count;
            }
        }
    }

    const nSamples = samples.length;
    const totalCounts = counts.reduce(
        (sum, row) => sum + row.reduce((rowSum, value) => rowSum + value, 0),
        0
    );
    if (totalCounts !== nSamples) {
        console.warn("VolMomo sample mismatch", { totalCounts, nSamples });
    }

    const lastIndex = closes.length - 1;
    const currentMomo = closes[lastIndex] / closes[lastIndex - k] - 1;
    const currentReturns = ret1.slice(lastIndex - k, lastIndex);
    const currentVol = stddev(currentReturns);
    const currentZm = (currentMomo - momoMean) / momoStd;
    const currentZv = (currentVol - volMean) / volStd;
    const currentX = mode === "sigma" ? currentZm : currentMomo;
    const currentY = mode === "sigma" ? currentZv : currentVol;
    const currentI = clampNumber(findBin(currentX, xEdges), 0, bins - 1);
    const currentJ = clampNumber(findBin(currentY, yEdges), 0, bins - 1);

    const response: VolMomoResponse = {
        meta: {
            symbol,
            interval,
            lookbackDays,
            k,
            bins,
            minSamples,
            mode,
            hBars,
            source,
            nCandles: slicedCandles.length,
            startTs: slicedCandles[0]?.openTime ?? 0,
            endTs: slicedCandles[slicedCandles.length - 1]?.closeTime ?? 0,
            nSamples,
            firstClose: slicedCandles[0]?.close ?? 0,
            lastClose: slicedCandles[slicedCandles.length - 1]?.close ?? 0,
        },
        axes: {
            xLabel: "momentum",
            yLabel: "volatility",
            xEdges,
            yEdges,
            xTickLabels: buildTickLabels(xEdges),
            yTickLabels: buildTickLabels(yEdges),
        },
        grids: {
            pWin,
            meanFwd,
            count: counts,
        },
        current: {
            zm: currentZm,
            zv: currentZv,
            momo: currentMomo,
            vol: currentVol,
            i: currentI,
            j: currentJ,
        },
    };

    return { ok: true, analysis: { response, samples } };
};

/**
 * Build a histogram for forward returns in a selected cell.
 * @param values - Forward return samples for a cell.
 * @param bins - Number of histogram buckets.
 * @returns Histogram edges and counts.
 */
export const buildHistogram = (values: number[], bins = 30) => {
    if (values.length === 0) {
        return { edges: [0, 1], counts: [0] };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) {
        return { edges: [min - 1e-6, max + 1e-6], counts: [values.length] };
    }
    const step = (max - min) / bins;
    const edges = Array.from({ length: bins + 1 }, (_, i) => min + step * i);
    const counts = Array.from({ length: bins }, () => 0);
    for (const value of values) {
        const index = clampNumber(Math.floor((value - min) / step), 0, bins - 1);
        counts[index] += 1;
    }
    return { edges, counts };
};

/**
 * Resolve interval duration in milliseconds.
 * @param interval - Candle interval identifier.
 * @returns Interval duration in milliseconds.
 */
export const intervalMs = (interval: VolMomoInterval) => INTERVAL_MS[interval];

/**
 * Compute the number of bars per day for a given interval.
 * @param interval - Candle interval identifier.
 * @returns Bars per day count.
 */
export const barsPerDay = (interval: VolMomoInterval) => DAY_MS / INTERVAL_MS[interval];

/**
 * Compute percentile values from a dataset.
 * @param values - Numeric dataset for percentiles.
 * @returns Percentile summary values.
 */
export const summarizePercentiles = (values: number[]) => {
    if (values.length === 0) {
        return { mean: null, median: null, p05: null, p95: null };
    }
    const sorted = [...values].sort((a, b) => a - b);
    const avg = mean(values);
    const median = quantile(sorted, 0.5);
    const p05 = quantile(sorted, 0.05);
    const p95 = quantile(sorted, 0.95);
    return { mean: avg, median, p05, p95 };
};
