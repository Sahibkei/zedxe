export interface MarketauxMeta {
    found?: number;
    returned?: number;
    limit?: number;
    page?: number;
}

export interface MarketauxEntity {
    symbol?: string | null;
    name?: string | null;
    type?: string | null;
    industry?: string | null;
    country?: string | null;
    sentiment_score?: number | null;
}

export interface MarketauxArticle {
    uuid: string;
    title?: string | null;
    description?: string | null;
    snippet?: string | null;
    content?: string | null;
    url?: string | null;
    image_url?: string | null;
    language?: string | null;
    published_at?: string | null;
    source?: string | null;
    entities?: MarketauxEntity[];
}

export interface MarketauxResponse {
    meta?: MarketauxMeta;
    data?: MarketauxArticle[];
}
