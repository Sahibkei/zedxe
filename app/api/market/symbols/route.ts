import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SYMBOLS = [
    {
        symbol: "EURUSD",
        timeframes: ["M5", "M15", "M30", "H1"],
        pip_size: 0.0001,
        point_size: 0.00001,
    },
];

export async function GET() {
    const dataSource = process.env.TWELVEDATA_API_KEY ? "twelvedata" : "mock";

    return NextResponse.json({
        symbols: SYMBOLS,
        timeframes: ["M5", "M15", "M30", "H1"],
        data_source: dataSource,
    });
}
