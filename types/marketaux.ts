export interface MarketauxMeta {
    found: number;
    returned: number;
    limit: number;
    page: number;
}

export interface MarketauxEntity {
    symbol: string;
    name: string;
    type: string;
    industry: string | null;
    country: string | null;
    sentiment_score: number | null;
}

export interface MarketauxArticle {
    uuid: string;
    title: string;
    description?: string | null;
    snippet?: string | null;
    url: string;
    image_url?: string | null;
    language: string;
    published_at: string;
    source: string;
    entities: MarketauxEntity[];
}

export interface MarketauxResponse {
    meta: MarketauxMeta;
    data: MarketauxArticle[];
}
