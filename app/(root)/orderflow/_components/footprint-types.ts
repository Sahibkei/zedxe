export type FootprintLevel = {
    price: number;
    bid: number;
    ask: number;
    total: number;
};

export type CandleFootprint = {
    tSec: number;
    buyTotal: number;
    sellTotal: number;
    levels: FootprintLevel[];
};

export type FootprintMode = "Bid x Ask" | "Delta" | "Volume";
