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
const TIMEFRAME_MULTIPLIERS: Record<string, number> = {
    M15: 3,
    M30: 6,
    H1: 12,
};

const countCsvRows = async (filePath: string) => {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/).filter(Boolean);
    return Math.max(0, lines.length - 1);
};

export async function GET() {
    const symbols = new Map<string, Set<string>>();
    const barsBySymbol = new Map<string, Record<string, number>>();

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

            const filePath = path.join(DATA_DIR, file);
            const rows = await countCsvRows(filePath);
            if (!barsBySymbol.has(symbol)) {
                barsBySymbol.set(symbol, {});
            }
            barsBySymbol.get(symbol)![timeframe] = rows;

            if (timeframe === "M5") {
                const derived = barsBySymbol.get(symbol)!;
                for (const [derivedTimeframe, multiple] of Object.entries(
                    TIMEFRAME_MULTIPLIERS
                )) {
                    symbols.get(symbol)?.add(derivedTimeframe);
                    derived[derivedTimeframe] = Math.floor(rows / multiple);
                }
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
                bars_by_timeframe: barsBySymbol.get(symbol) ?? {},
            };
        }
    );

    return NextResponse.json({ symbols: response });
}
