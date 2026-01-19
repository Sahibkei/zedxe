export type Timeframe = "M5" | "M15" | "M30" | "H1";

export type Candle = {
    datetime: string;
    open: number;
    high: number;
    low: number;
    close: number;
};

export type TwelveDataError = {
    type: "missing_api_key" | "api_error" | "invalid_response" | "timeout";
    message: string;
    status?: number;
    code?: number;
};

export type FetchTimeSeriesResult =
    | {
          ok: true;
          candles: Candle[];
      }
    | {
          ok: false;
          error: TwelveDataError;
      };

const INTERVAL_MAP: Record<Timeframe, string> = {
    M5: "5min",
    M15: "15min",
    M30: "30min",
    H1: "1h",
};

const normalizeSymbolForApi = (symbol: string) => {
    const trimmed = symbol.trim().toUpperCase();
    if (trimmed.includes("/")) {
        return trimmed;
    }
    if (trimmed.length === 6) {
        return `${trimmed.slice(0, 3)}/${trimmed.slice(3)}`;
    }
    return trimmed;
};

const sortCandlesOldestFirst = (candles: Candle[]) =>
    [...candles].sort((a, b) => a.datetime.localeCompare(b.datetime));

const getTimeoutMs = () => {
    const raw = process.env.TWELVEDATA_TIMEOUT_MS;
    if (!raw) {
        return 8000;
    }
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 8000;
    }
    return Math.floor(parsed);
};

export const fetchTimeSeries = async ({
    symbol,
    timeframe,
    outputsize,
}: {
    symbol: string;
    timeframe: Timeframe;
    outputsize: number;
}): Promise<FetchTimeSeriesResult> => {
    const apiKey = process.env.TWELVEDATA_API_KEY;
    if (!apiKey) {
        return {
            ok: false,
            error: {
                type: "missing_api_key",
                message: "TWELVEDATA_API_KEY is not configured",
            },
        };
    }

    const normalizedSymbol = normalizeSymbolForApi(symbol);
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", normalizedSymbol);
    url.searchParams.set("interval", INTERVAL_MAP[timeframe]);
    url.searchParams.set("outputsize", String(outputsize));
    url.searchParams.set("apikey", apiKey);

    const controller = new AbortController();
    const timeoutMs = getTimeoutMs();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
        response = await fetch(url.toString(), {
            next: { revalidate: 15 },
            signal: controller.signal,
        });
    } catch (error) {
        if (controller.signal.aborted) {
            return {
                ok: false,
                error: {
                    type: "timeout",
                    message: `TwelveData request timed out after ${timeoutMs}ms`,
                },
            };
        }
        return {
            ok: false,
            error: {
                type: "api_error",
                message: `Failed to reach TwelveData: ${String(error)}`,
            },
        };
    } finally {
        clearTimeout(timeout);
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch (error) {
        return {
            ok: false,
            error: {
                type: "invalid_response",
                message: `Invalid JSON from TwelveData: ${String(error)}`,
                status: response.status,
            },
        };
    }

    if (!response.ok) {
        const message =
            typeof payload === "object" && payload !== null
                ? String(
                      (payload as { message?: string }).message ??
                          "TwelveData request failed"
                  )
                : "TwelveData request failed";
        const code =
            typeof payload === "object" && payload !== null
                ? (payload as { code?: number }).code
                : undefined;
        return {
            ok: false,
            error: {
                type: "api_error",
                message,
                status: response.status,
                code,
            },
        };
    }

    if (
        typeof payload !== "object" ||
        payload === null ||
        "status" in payload
    ) {
        const errorPayload = payload as
            | { status?: string; message?: string; code?: number }
            | undefined;
        if (errorPayload?.status === "error") {
            return {
                ok: false,
                error: {
                    type: "api_error",
                    message: errorPayload.message ?? "TwelveData error",
                    code: errorPayload.code,
                },
            };
        }
    }

    const values = (payload as { values?: Candle[] }).values;
    if (!Array.isArray(values)) {
        return {
            ok: false,
            error: {
                type: "invalid_response",
                message: "TwelveData payload missing values",
            },
        };
    }

    const candles = values
        .map((value) => {
            const datetime =
                typeof value.datetime === "string"
                    ? value.datetime.trim()
                    : value.datetime
                    ? String(value.datetime).trim()
                    : "";
            if (!datetime) {
                return null;
            }
            return {
                datetime,
                open: Number(value.open),
                high: Number(value.high),
                low: Number(value.low),
                close: Number(value.close),
            };
        })
        .filter(
            (value): value is Candle =>
                Boolean(value) &&
                Number.isFinite(value.open) &&
                Number.isFinite(value.high) &&
                Number.isFinite(value.low) &&
                Number.isFinite(value.close)
        );

    if (!candles.length) {
        return {
            ok: false,
            error: {
                type: "invalid_response",
                message: "TwelveData returned no candles",
            },
        };
    }

    return { ok: true, candles: sortCandlesOldestFirst(candles) };
};
