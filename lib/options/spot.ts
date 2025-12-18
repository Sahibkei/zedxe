const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

type YahooChartResponse = {
    chart?: {
        result?: Array<{
            meta?: {
                regularMarketPrice?: number;
                previousClose?: number;
                chartPreviousClose?: number;
            };
            indicators?: {
                quote?: Array<{ close?: Array<number | null> }>;
                adjclose?: Array<{ adjclose?: Array<number | null> }>;
            };
        }>;
    };
};

export type SpotResult = {
    spot: number;
    source: string;
    alternate?: number;
};

const pickLast = (values: Array<number | null | undefined>) => {
    for (let index = values.length - 1; index >= 0; index -= 1) {
        const candidate = values[index];
        if (isFiniteNumber(candidate) && candidate > 0) {
            return candidate;
        }
    }
    return null;
};

export async function fetchLatestSpot(symbol: string): Promise<SpotResult | null> {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
    const response = await fetch(url, { cache: 'no-store', next: { revalidate: 0 } });

    if (!response.ok) {
        return null;
    }

    const payload = (await response.json()) as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const meta = result?.meta ?? {};
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    const adjCloses = result?.indicators?.adjclose?.[0]?.adjclose ?? [];

    const lastClose = pickLast([...closes, ...adjCloses]);
    const regular = isFiniteNumber(meta.regularMarketPrice) && meta.regularMarketPrice > 0 ? meta.regularMarketPrice : null;
    const previous = isFiniteNumber(meta.previousClose) && meta.previousClose > 0 ? meta.previousClose : null;
    const chartPrev = isFiniteNumber(meta.chartPreviousClose) && meta.chartPreviousClose > 0 ? meta.chartPreviousClose : null;

    const primary = regular ?? lastClose ?? previous ?? chartPrev;
    if (!isFiniteNumber(primary) || primary <= 0) {
        return null;
    }

    const alternate = lastClose ?? previous ?? chartPrev ?? null;
    if (alternate && Math.abs(primary - alternate) / alternate > 0.1) {
        console.warn(
            `[options] Spot discrepancy for ${symbol}: primary=${primary.toFixed(2)} alternate=${alternate.toFixed(2)}; using primary`
        );
    }

    if (primary <= 0) {
        throw new Error(`Invalid spot (${primary}) for symbol ${symbol}`);
    }

    return { spot: primary, source: regular ? 'regularMarketPrice' : 'historicalClose', alternate: alternate ?? undefined };
}
