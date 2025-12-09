import { NextRequest, NextResponse } from 'next/server';

import { OrderflowTrade } from '@/database/models/orderflow-trade.model';
import { connectToDatabase } from '@/database/mongoose';

const DEFAULT_SESSION_WINDOW_SECONDS = 86_400;
const MAX_SESSION_WINDOW_SECONDS = 86_400;
const CLUSTER_WINDOW_MS = 60_000;

const parseWindowSeconds = (value: string | null, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, MAX_SESSION_WINDOW_SECONDS);
};

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol')?.trim().toLowerCase();

    if (!symbol) {
        return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
    }

    const sessionWindowSeconds = parseWindowSeconds(
        searchParams.get('sessionWindowSeconds'),
        DEFAULT_SESSION_WINDOW_SECONDS,
    );

    const since = new Date(Date.now() - sessionWindowSeconds * 1000);

    try {
        await connectToDatabase();

        const trades = await OrderflowTrade.find({ symbol, timestamp: { $gte: since } })
            .sort({ timestamp: 1 })
            .lean();

        if (trades.length === 0) {
            return NextResponse.json({
                buyVolume: 0,
                sellVolume: 0,
                netDelta: 0,
                vwap: null,
                largestCluster: null,
            });
        }

        let buyVolume = 0;
        let sellVolume = 0;
        let notional = 0;
        let totalVolume = 0;

        const clusters = new Map<
            number,
            { buyVolume: number; sellVolume: number; tradeCount: number }
        >();

        trades.forEach((trade) => {
            const volume = Number(trade.quantity) || 0;
            const price = Number(trade.price) || 0;
            const timestamp = new Date(trade.timestamp).getTime();

            if (trade.side === 'buy') {
                buyVolume += volume;
            } else {
                sellVolume += volume;
            }

            totalVolume += volume;
            notional += price * volume;

            const bucketStart = Math.floor(timestamp / CLUSTER_WINDOW_MS) * CLUSTER_WINDOW_MS;
            const cluster = clusters.get(bucketStart) ?? { buyVolume: 0, sellVolume: 0, tradeCount: 0 };

            if (trade.side === 'buy') {
                cluster.buyVolume += volume;
            } else {
                cluster.sellVolume += volume;
            }
            cluster.tradeCount += 1;

            clusters.set(bucketStart, cluster);
        });

        let largestCluster: {
            startTimestamp: number;
            endTimestamp: number;
            volume: number;
            buyVolume: number;
            sellVolume: number;
            tradeCount: number;
        } | null = null;

        clusters.forEach((cluster, startTimestamp) => {
            const volume = cluster.buyVolume + cluster.sellVolume;
            if (!largestCluster || volume > largestCluster.volume) {
                largestCluster = {
                    startTimestamp,
                    endTimestamp: startTimestamp + CLUSTER_WINDOW_MS,
                    volume,
                    buyVolume: cluster.buyVolume,
                    sellVolume: cluster.sellVolume,
                    tradeCount: cluster.tradeCount,
                };
            }
        });

        const vwap = totalVolume > 0 ? notional / totalVolume : null;
        const netDelta = buyVolume - sellVolume;

        return NextResponse.json({ buyVolume, sellVolume, netDelta, vwap, largestCluster });
    } catch (error) {
        console.error('GET /api/orderflow/session-stats error', error);
        return NextResponse.json({ error: 'Failed to load session stats' }, { status: 500 });
    }
}
