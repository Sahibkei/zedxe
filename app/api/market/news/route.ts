import { NextResponse } from 'next/server';

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

const fetchJSON = async <T>(url: string): Promise<T> => {
    const res = await fetch(url, { cache: 'force-cache', next: { revalidate: 300 } });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Fetch failed ${res.status}: ${text}`);
    }
    return (await res.json()) as T;
};

export async function GET() {
    const token = process.env.FINNHUB_API_KEY ?? process.env.NEXT_PUBLIC_FINNHUB_API_KEY;
    if (!token) {
        return NextResponse.json({ items: [] });
    }

    try {
        type FinnhubNewsItem = { headline?: string; source?: string; url?: string; datetime?: number; category?: string };
        const url = `${FINNHUB_BASE_URL}/news?category=general&token=${token}`;
        const data = await fetchJSON<FinnhubNewsItem[]>(url);
        const items = (data || [])
            .filter((item) => item?.headline && item?.url && item?.source && item?.datetime)
            .slice(0, 6)
            .map((item) => ({
                headline: item.headline as string,
                source: item.source as string,
                url: item.url as string,
                datetime: item.datetime as number,
                category: item.category,
            }));

        return NextResponse.json({ items });
    } catch (error) {
        console.error('Market news fetch failed:', error);
        return NextResponse.json({ items: [] });
    }
}
