export type GlobalMarketIndex = {
    ticker: string;
    label: string;
    symbol: string;
    name: string;
    region: string;
};

export const GLOBAL_MARKET_INDEXES: GlobalMarketIndex[] = [
    { ticker: "SPX", label: "S&P 500", symbol: "^GSPC", name: "S&P 500", region: "US" },
    { ticker: "NDX", label: "NASDAQ 100", symbol: "^NDX", name: "NASDAQ 100", region: "US" },
    { ticker: "DJI", label: "Dow Jones", symbol: "^DJI", name: "Dow Jones Industrial Average", region: "US" },
    { ticker: "RUT", label: "Russell 2000", symbol: "^RUT", name: "Russell 2000", region: "US" },
    { ticker: "SX5E", label: "Euro Stoxx 50", symbol: "^STOXX50E", name: "Euro Stoxx 50", region: "Europe" },
    { ticker: "FTSE", label: "FTSE 100", symbol: "^FTSE", name: "FTSE 100", region: "Europe" },
    { ticker: "DAX", label: "DAX", symbol: "^GDAXI", name: "DAX", region: "Europe" },
    { ticker: "N225", label: "Nikkei 225", symbol: "^N225", name: "Nikkei 225", region: "Asia" },
    { ticker: "HSI", label: "Hang Seng", symbol: "^HSI", name: "Hang Seng", region: "Asia" },
    { ticker: "NIFTY", label: "Nifty 50", symbol: "^NSEI", name: "Nifty 50", region: "Asia" },
    { ticker: "BVSP", label: "Bovespa", symbol: "^BVSP", name: "Bovespa", region: "Americas" },
];
