import { z } from "zod";

export const TIMEFRAMES = ["M5", "M15", "M30", "H1"] as const;
export const EVENTS = ["end", "touch"] as const;

export const MIN_HORIZON_BARS = 1;
export const MAX_HORIZON_BARS = 500;
export const MIN_LOOKBACK_BARS = 50;
export const MAX_LOOKBACK_BARS = 5000;
export const MIN_TARGET_X = 1;
export const MAX_TARGET_X = 500;

export const normalizeSymbol = (symbol: string) =>
    symbol.replace("/", "").toUpperCase();

export const symbolSchema = z
    .string()
    .trim()
    .transform((value) => value.toUpperCase().replace(/[^A-Z]/g, ""))
    .pipe(z.string().min(3).max(10).regex(/^[A-Z]+$/))
    .refine((value) => normalizeSymbol(value) === "EURUSD", {
        message: "Unsupported symbol",
    });

export const clampNumber = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));
