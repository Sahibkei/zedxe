import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DATA_DIR = path.join(process.cwd(), "data", "ohlc");

const SYMBOL_META: Record<string, { pip_size: number; point_size: number }> = {
    EURUSD: { pip_size: 0.0001, point_size: 0.00001 },
    XAUUSD: { pip_size: 0.1, point_size: 0.01 },
};

const DEFAULT_PIP_SIZE = 0.0001;
const DEFAULT_POINT_SIZE = 0.0001;

export async function GET() {
    const symbols = new Map<string, Set<string>>();

    try {
        const files = await fs.readdir(DATA_DIR);
        for (const file of files) {
            const match = file.match(
                /^([A-Za-z0-9]+)_([A-Za-z0-9]+)\.sample\.csv$/
            );
            if (!match) {
                continue;
            }
            const [, symbol, timeframe] = match;
            if (!symbols.has(symbol)) {
                symbols.set(symbol, new Set());
            }
            symbols.get(symbol)?.add(timeframe);

            if (timeframe === "M5") {
                symbols.get(symbol)?.add("M15");
                symbols.get(symbol)?.add("M30");
                symbols.get(symbol)?.add("H1");
            }
        }
    } catch (error) {
        return NextResponse.json({ symbols: [] });
    }

    const response = Array.from(symbols.entries()).map(
        ([symbol, timeframes]) => {
            const meta = SYMBOL_META[symbol];
            return {
                symbol,
                timeframes: Array.from(timeframes).sort(),
                pip_size: meta?.pip_size ?? DEFAULT_PIP_SIZE,
                point_size: meta?.point_size ?? DEFAULT_POINT_SIZE,
            };
        }
    );

    return NextResponse.json({ symbols: response });
}
