import { normalizeSymbol } from "@/lib/probability/validation";

export const getPipSize = (symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    if (normalized === "EURUSD") {
        return 0.0001;
    }
    return 0.0001;
};

export const scaleMoveToXUnits = (move: number, symbol: string) =>
    move / getPipSize(symbol);
