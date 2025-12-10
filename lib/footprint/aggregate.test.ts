import { aggregateFootprintBars } from './aggregate';
import { RawTrade } from './types';

interface TestCase {
    name: string;
    run: () => void;
}

const tests: TestCase[] = [];

const test = (name: string, run: () => void) => {
    tests.push({ name, run });
};

const expectEqual = (actual: unknown, expected: unknown, message?: string) => {
    if (actual !== expected) {
        throw new Error(message ?? `Expected ${expected} but received ${actual}`);
    }
};

const expectDeepEqual = (actual: unknown, expected: unknown, message?: string) => {
    const stringify = (value: unknown) => JSON.stringify(value, null, 2);
    if (stringify(actual) !== stringify(expected)) {
        throw new Error(message ?? `Expected ${stringify(expected)} but received ${stringify(actual)}`);
    }
};

test('aggregates trades into chronologically ordered footprint bars', () => {
    const trades: RawTrade[] = [
        { symbol: 'BTCUSDT', price: 100, quantity: 1, side: 'buy', ts: 0 },
        { symbol: 'BTCUSDT', price: 101, quantity: 2, side: 'sell', ts: 20_000 },
        { symbol: 'BTCUSDT', price: 102, quantity: 3, side: 'buy', ts: 59_000 },
        { symbol: 'BTCUSDT', price: 99, quantity: 1.5, side: 'sell', ts: 61_000 },
        { symbol: 'BTCUSDT', price: 98, quantity: 0.5, side: 'buy', ts: 65_000 },
    ];

    const [firstBar, secondBar] = aggregateFootprintBars(trades, { timeframe: '1m' });

    expectEqual(firstBar.startTime, 0);
    expectEqual(firstBar.endTime, 60_000);
    expectEqual(firstBar.open, 100);
    expectEqual(firstBar.close, 102);
    expectEqual(firstBar.high, 102);
    expectEqual(firstBar.low, 100);
    expectEqual(firstBar.totalAskVolume, 4);
    expectEqual(firstBar.totalBidVolume, 2);
    expectEqual(firstBar.delta, 2);

    expectDeepEqual(firstBar.cells, [
        { price: 100, bidVolume: 0, askVolume: 1, tradesCount: 1 },
        { price: 101, bidVolume: 2, askVolume: 0, tradesCount: 1 },
        { price: 102, bidVolume: 0, askVolume: 3, tradesCount: 1 },
    ]);

    expectEqual(secondBar.startTime, 60_000);
    expectEqual(secondBar.endTime, 120_000);
    expectEqual(secondBar.open, 99);
    expectEqual(secondBar.close, 98);
    expectEqual(secondBar.high, 99);
    expectEqual(secondBar.low, 98);
    expectEqual(secondBar.totalAskVolume, 0.5);
    expectEqual(secondBar.totalBidVolume, 1.5);
    expectEqual(secondBar.delta, -1);

    expectDeepEqual(secondBar.cells, [
        { price: 98, bidVolume: 0, askVolume: 0.5, tradesCount: 1 },
        { price: 99, bidVolume: 1.5, askVolume: 0, tradesCount: 1 },
    ]);
});

test('buckets trades by price step and separates symbols', () => {
    const trades: RawTrade[] = [
        { symbol: 'ETHUSDT', price: 2500.1, quantity: 1, side: 'buy', ts: 1000 },
        { symbol: 'ETHUSDT', price: 2500.3, quantity: 0.5, side: 'sell', ts: 2_000 },
        { symbol: 'ETHUSDT', price: 2500.6, quantity: 0.4, side: 'buy', ts: 3_000 },
        { symbol: 'BTCUSDT', price: 30_000.4, quantity: 0.2, side: 'sell', ts: 4_000 },
        { symbol: 'BTCUSDT', price: 30_000.9, quantity: 0.6, side: 'buy', ts: 5_000 },
    ];

    const bars = aggregateFootprintBars(trades, { timeframe: '5m', priceStep: 0.5 });

    expectEqual(bars.length, 2);

    const ethBar = bars.find((bar) => bar.symbol === 'ETHUSDT');
    const btcBar = bars.find((bar) => bar.symbol === 'BTCUSDT');

    if (!ethBar || !btcBar) {
        throw new Error('Expected bars for both ETHUSDT and BTCUSDT');
    }

    expectDeepEqual(ethBar.cells, [
        { price: 2500, bidVolume: 0.5, askVolume: 1, tradesCount: 2 },
        { price: 2500.5, bidVolume: 0, askVolume: 0.4, tradesCount: 1 },
    ]);
    expectEqual(ethBar.totalAskVolume, 1.4);
    expectEqual(ethBar.totalBidVolume, 0.5);

    expectDeepEqual(btcBar.cells, [
        { price: 30_000, bidVolume: 0.2, askVolume: 0, tradesCount: 1 },
        { price: 30_000.5, bidVolume: 0, askVolume: 0.6, tradesCount: 1 },
    ]);
    expectEqual(btcBar.startTime, 0);
    expectEqual(btcBar.endTime, 300_000);
    expectEqual(btcBar.open, 30_000.4);
    expectEqual(btcBar.close, 30_000.9);
});

let failed = false;

for (const { name, run } of tests) {
    try {
        run();
        console.log(`✔ ${name}`);
    } catch (error) {
        failed = true;
        console.error(`✘ ${name}`);
        console.error(error);
    }
}

if (failed) {
    throw new Error('Footprint aggregation tests failed');
}
