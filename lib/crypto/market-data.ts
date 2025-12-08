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
    price_change_percentage_24h_in_currency?: number | null;
    price_change_percentage_7d_in_currency?: number | null;
    price_change_percentage_30d_in_currency?: number | null;
};

type CoinGeckoGlobalResponse = {
    data: {
        total_market_cap: Record<string, number>;
    };
};

export async function getGlobalCryptoMarketData(): Promise<GlobalMarketData> {
    const response = await coingeckoFetch<CoinGeckoGlobalResponse>('/global');
    const totalMarketCapUsd = response.data.total_market_cap?.usd ?? 0;
    return { totalMarketCapUsd };
}

export async function getTopCryptoMarketCoins(): Promise<MarketCoin[]> {
    return coingeckoFetch<MarketCoin[]>(
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
}
