import { coingeckoFetch } from '@/lib/coingecko';

export type GlobalMarketData = {
    totalMarketCapUsd: number;
};

export type MarketCoin = {
    id: string;
    symbol: string;
    name: string;
    image: string;
    market_cap_rank: number | null;
    current_price: number;
    market_cap: number;
    circulating_supply: number;
    price_change_percentage_24h_in_currency: number | null;
    price_change_percentage_7d_in_currency: number | null;
    price_change_percentage_30d_in_currency: number | null;
};

export type CryptoCoinDetails = {
    id: string;
    name: string;
    symbol: string;
    rank: number | null;
    description?: string | null;

    currentPriceUsd: number | null;
    marketCapUsd: number | null;
    circulatingSupply: number | null;
    totalSupply?: number | null;

    priceChange24h: number | null;
    priceChange7d: number | null;
    priceChange30d: number | null;

    tradingViewSymbol?: string | null;
};

type GlobalResponse = {
    data: {
        total_market_cap: Record<string, number>;
    };
};

export type RawMarketCoin = {
    id: string;
    symbol: string;
    name: string;
    image: string | null;
    current_price: number | null;
    market_cap: number | null;
    circulating_supply: number | null;
    market_cap_rank?: number | null;
    price_change_percentage_24h_in_currency?: number | null;
    price_change_percentage_7d_in_currency?: number | null;
    price_change_percentage_30d_in_currency?: number | null;
};

type CoinMarketsResponse = RawMarketCoin[];

export type CryptoPageData = {
    totalMarketCapUsd: number;
    rows: MarketCoin[];
};

type CoinDetailResponse = {
    id: string;
    symbol: string;
    name: string;
    market_cap_rank?: number | null;
    description?: { en?: string | null };
    market_data?: {
        current_price?: Record<string, number | null>;
        market_cap?: Record<string, number | null>;
        circulating_supply?: number | null;
        total_supply?: number | null;
        price_change_percentage_24h?: number | null;
        price_change_percentage_7d?: number | null;
        price_change_percentage_30d?: number | null;
    };
    tickers?: {
        market?: { identifier?: string | null };
        base?: string | null;
        target?: string | null;
    }[];
};

export async function getGlobalCryptoMarketData(): Promise<GlobalMarketData> {
    const res = await coingeckoFetch<GlobalResponse>('/global');
    const usdCap = res.data?.total_market_cap?.usd ?? 0;
    return { totalMarketCapUsd: usdCap };
}

export async function getTopCryptoMarketCoins(): Promise<MarketCoin[]> {
    const response = await coingeckoFetch<CoinMarketsResponse>(
        '/coins/markets',
        {
            vs_currency: 'usd',
            order: 'market_cap_desc',
            per_page: 100,
            page: 1,
            sparkline: false,
            price_change_percentage: '24h,7d,30d',
        }
    );

    return response
        .filter((coin) => Boolean(coin.id && coin.name && coin.symbol && coin.image))
        .map((coin) => ({
            id: coin.id,
            symbol: coin.symbol,
            name: coin.name,
            image: coin.image ?? '',
            market_cap_rank: coin.market_cap_rank ?? null,
            current_price: coin.current_price ?? 0,
            market_cap: coin.market_cap ?? 0,
            circulating_supply: coin.circulating_supply ?? 0,
            price_change_percentage_24h_in_currency: coin.price_change_percentage_24h_in_currency ?? null,
            price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency ?? null,
            price_change_percentage_30d_in_currency: coin.price_change_percentage_30d_in_currency ?? null,
        }));
}

export async function getCryptoPageData(): Promise<CryptoPageData> {
    try {
        const [global, markets] = await Promise.all([
            getGlobalCryptoMarketData(),
            getTopCryptoMarketCoins(),
        ]);

        return {
            totalMarketCapUsd: global.totalMarketCapUsd,
            rows: markets,
        };
    } catch (error) {
        console.error('Failed to load crypto page data', error);
        return {
            totalMarketCapUsd: 0,
            rows: [],
        };
    }
}

function deriveTradingViewSymbol(symbol: string, tickers?: CoinDetailResponse['tickers']) {
    const upperSymbol = symbol.toUpperCase();

    const binanceUsdtTicker = tickers?.find(
        (ticker) => ticker.market?.identifier?.toLowerCase() === 'binance' && ticker.target?.toUpperCase() === 'USDT'
    );

    if (binanceUsdtTicker?.base) {
        return `BINANCE:${binanceUsdtTicker.base.toUpperCase()}USDT`;
    }

    const coinbaseUsdTicker = tickers?.find(
        (ticker) => ticker.market?.identifier?.toLowerCase() === 'coinbase' && ticker.target?.toUpperCase() === 'USD'
    );

    if (coinbaseUsdTicker?.base) {
        return `COINBASE:${coinbaseUsdTicker.base.toUpperCase()}USD`;
    }

    if (upperSymbol === 'BTC') return 'BINANCE:BTCUSDT';
    if (upperSymbol === 'ETH') return 'BINANCE:ETHUSDT';
    if (upperSymbol === 'SOL') return 'BINANCE:SOLUSDT';

    return `BINANCE:${upperSymbol}USDT`;
}

export async function getCryptoCoinDetails(id: string): Promise<CryptoCoinDetails | null> {
    try {
        const data = await coingeckoFetch<CoinDetailResponse>(
            `/coins/${id}`,
            {
                localization: false,
                tickers: true,
                market_data: true,
                community_data: false,
                developer_data: false,
                sparkline: false,
            },
            { revalidateSeconds: 300 }
        );

        const tradingViewSymbol = deriveTradingViewSymbol(data.symbol, data.tickers);

        return {
            id: data.id,
            name: data.name,
            symbol: data.symbol,
            rank: data.market_cap_rank ?? null,
            description: data.description?.en ?? null,
            currentPriceUsd: data.market_data?.current_price?.usd ?? null,
            marketCapUsd: data.market_data?.market_cap?.usd ?? null,
            circulatingSupply: data.market_data?.circulating_supply ?? null,
            totalSupply: data.market_data?.total_supply ?? null,
            priceChange24h: data.market_data?.price_change_percentage_24h ?? null,
            priceChange7d: data.market_data?.price_change_percentage_7d ?? null,
            priceChange30d: data.market_data?.price_change_percentage_30d ?? null,
            tradingViewSymbol,
        };
    } catch (error) {
        console.error(`Failed to load crypto coin details for ${id}`, error);
        return null;
    }
}
