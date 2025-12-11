import { VolumeBucket } from "@/app/(root)/orderflow/_components/orderflow-chart";
import { NormalizedTrade } from "@/hooks/useOrderflowStream";

export const bucketTrades = (
    trades: NormalizedTrade[],
    windowSeconds: number,
    bucketSizeSeconds: number,
    referenceTimestamp: number,
): VolumeBucket[] => {
    const windowStart = referenceTimestamp - windowSeconds * 1000;
    const bucketSizeMs = bucketSizeSeconds * 1000;
    const bucketCount = Math.ceil(windowSeconds / bucketSizeSeconds);

    const buckets: VolumeBucket[] = Array.from({ length: bucketCount }).map((_, index) => {
        const start = windowStart + index * bucketSizeMs;
        return {
            timestamp: start,
            buyVolume: 0,
            sellVolume: 0,
            delta: 0,
            totalVolume: 0,
            imbalance: 0,
            imbalancePercent: 0,
            dominantSide: null,
        };
    });

    trades.forEach((trade) => {
        if (trade.timestamp < windowStart) return;
        const bucketIndex = Math.floor((trade.timestamp - windowStart) / bucketSizeMs);
        if (bucketIndex < 0 || bucketIndex >= buckets.length) return;

        const bucket = buckets[bucketIndex];
        if (trade.side === "buy") {
            bucket.buyVolume += trade.quantity;
        } else {
            bucket.sellVolume += trade.quantity;
        }
        bucket.delta = bucket.buyVolume - bucket.sellVolume;
    });

    return buckets.map((bucket) => {
        const totalVolume = bucket.buyVolume + bucket.sellVolume;
        const imbalance = totalVolume > 0 ? (bucket.buyVolume - bucket.sellVolume) / totalVolume : 0;
        const imbalancePercent = Math.abs(imbalance) * 100;
        const dominantSide = totalVolume === 0 ? null : bucket.buyVolume >= bucket.sellVolume ? "buy" : "sell";

        return {
            ...bucket,
            totalVolume,
            imbalance,
            imbalancePercent,
            dominantSide,
        };
    });
};

