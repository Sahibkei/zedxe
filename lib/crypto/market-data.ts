import { coingeckoFetch } from '@/lib/coingecko';

export type GlobalMarketData = {
    totalMarketCapUsd: number;
};

export type MarketCoin = {
    id: string;
    symbol: string;
    name: string;
    image: string;
    current_price: number;
    market_cap: number;
    circulating_supply: number;
    price_change_percentage_24h_in_currency: number | null;
    price_change_percentage_7d_in_currency: number | null;
    price_change_percentage_30d_in_currency: number | null;
};

type GlobalResponse = {
    data: {
        total_market_cap: Record<string, number>;
    };
};

type CoinMarketsResponse = Array<{
    id: string;
    symbol: string;
    name: string;
    image?: string | null;
    current_price?: number | null;
    market_cap?: number | null;
    circulating_supply?: number | null;
    price_change_percentage_24h_in_currency?: number | null;
    price_change_percentage_7d_in_currency?: number | null;
    price_change_percentage_30d_in_currency?: number | null;
}>;

export type CryptoPageData = {
    totalMarketCapUsd: number;
    rows: MarketCoin[];
};

export async function getGlobalCryptoMarketData(): Promise<GlobalMarketData> {
    const res = await coingeckoFetch<GlobalResponse>('/global');
    const usdCap = res.data.total_market_cap?.usd ?? 0;
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
