import { NextResponse } from "next/server";
import { fetchJsonWithTimeout } from "@/lib/http/fetchWithTimeout";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_SYMBOL = "^GSPC";

const INDEX_SOURCES = {
    "^GSPC": {
        page: "List_of_S%26P_500_companies",
        headers: ["Symbol", "Security", "GICS Sector", "GICS Sub-Industry"],
    },
    "^NDX": {
        page: "Nasdaq-100",
        headers: ["Ticker", "Company", "GICS Sector", "GICS Sub-Industry"],
        fallbackHeaders: ["Ticker", "Company", "ICB Industry", "ICB Subsector"],
    },
    "^DJI": {
        page: "Dow_Jones_Industrial_Average",
        headers: ["Company", "Exchange", "Symbol", "Industry"],
    },
} as const;

type SupportedIndexSymbol = keyof typeof INDEX_SOURCES;

type WikipediaParseResponse = {
    parse?: {
        text?: string;
    };
};

type Constituent = {
    symbol: string;
    name: string;
    sector: string;
    industry: string;
};

type IndexConstituentsResponse = {
    updatedAt: string;
    symbol: string;
    name: string;
    sectors: string[];
    constituents: Constituent[];
};

const cache = new Map<string, { expiresAt: number; payload: IndexConstituentsResponse }>();

const INDEX_LABELS: Record<SupportedIndexSymbol, string> = {
    "^GSPC": "S&P 500",
    "^NDX": "Nasdaq-100",
    "^DJI": "Dow Jones Industrial Average",
};

const parseSymbol = (raw: string | null) => (raw ?? DEFAULT_SYMBOL).trim().toUpperCase() || DEFAULT_SYMBOL;

const isSupportedIndexSymbol = (value: string): value is SupportedIndexSymbol => value in INDEX_SOURCES;

const decodeHtml = (value: string) =>
    value
        .replace(/&#160;|&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#039;|&apos;/g, "'")
        .replace(/&ndash;/g, "-")
        .replace(/&mdash;/g, "-")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\[[^\]]*]/g, "")
        .trim();

const cleanCell = (html: string) =>
    decodeHtml(
        html
            .replace(/<sup[\s\S]*?<\/sup>/gi, "")
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<\/?(?:span|small|div|a|b|i|p)[^>]*>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
    );

const extractTables = (html: string) =>
    Array.from(html.matchAll(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>[\s\S]*?<\/table>/gi)).map(
        (match) => match[0]
    );

const extractRows = (tableHtml: string) =>
    Array.from(tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map((rowMatch) =>
        Array.from(rowMatch[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)).map((cellMatch) =>
            cleanCell(cellMatch[1])
        )
    );

const findTableByHeaders = (html: string, requiredHeaders: string[]) => {
    const normalizedRequired = requiredHeaders.map((header) => header.toLowerCase());
    for (const table of extractTables(html)) {
        const rows = extractRows(table);
        const headerRow = rows.find((row) => row.length >= requiredHeaders.length) ?? [];
        const normalizedHeaderRow = headerRow.map((cell) => cell.toLowerCase());
        const matches = normalizedRequired.every((header) =>
            normalizedHeaderRow.some((cell) => cell.includes(header))
        );
        if (matches) return rows;
    }
    return null;
};

const parseConstituents = (symbol: SupportedIndexSymbol, html: string): Constituent[] => {
    const source = INDEX_SOURCES[symbol];
    const rows =
        findTableByHeaders(html, [...source.headers]) ??
        ("fallbackHeaders" in source && source.fallbackHeaders
            ? findTableByHeaders(html, [...source.fallbackHeaders])
            : null);

    if (!rows?.length) return [];

    const header = rows[0];
    const indexOf = (name: string) =>
        header.findIndex((cell) => cell.toLowerCase().includes(name.toLowerCase()));

    const symbolIndex =
        symbol === "^DJI" ? indexOf("Symbol") : indexOf(symbol === "^GSPC" ? "Symbol" : "Ticker");
    const nameIndex = indexOf(symbol === "^GSPC" ? "Security" : "Company");
    const sectorIndex =
        indexOf("GICS Sector") >= 0
            ? indexOf("GICS Sector")
            : indexOf("ICB Industry") >= 0
              ? indexOf("ICB Industry")
              : indexOf("Industry");
    const industryIndex =
        indexOf("GICS Sub-Industry") >= 0
            ? indexOf("GICS Sub-Industry")
            : indexOf("ICB Subsector") >= 0
              ? indexOf("ICB Subsector")
              : indexOf("Industry");

    return rows
        .slice(1)
        .map((row) => ({
            symbol: row[symbolIndex] ?? "",
            name: row[nameIndex] ?? "",
            sector: row[sectorIndex] ?? "Other",
            industry: row[industryIndex] ?? row[sectorIndex] ?? "Other",
        }))
        .filter((item) => item.symbol && item.name)
        .map((item) => ({
            ...item,
            symbol: item.symbol.toUpperCase(),
        }));
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const symbol = parseSymbol(searchParams.get("symbol"));
    if (!isSupportedIndexSymbol(symbol)) {
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                symbol,
                name: symbol,
                sectors: [],
                constituents: [],
            } satisfies IndexConstituentsResponse
        );
    }

    const cached = cache.get(symbol);
    if (cached && cached.expiresAt > Date.now()) {
        return NextResponse.json(cached.payload);
    }

    const source = INDEX_SOURCES[symbol];
    const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${source.page}&prop=text&formatversion=2&format=json`;
    const result = await fetchJsonWithTimeout<WikipediaParseResponse>(
        url,
        {
            cache: "no-store",
            headers: {
                Accept: "application/json",
                "User-Agent": "Mozilla/5.0",
            },
        },
        { timeoutMs: 10000, retries: 1, backoffBaseMs: 250 }
    );

    if (!result.ok) {
        return NextResponse.json(
            {
                updatedAt: new Date().toISOString(),
                symbol,
                name: INDEX_LABELS[symbol],
                sectors: [],
                constituents: [],
            } satisfies IndexConstituentsResponse
        );
    }

    const html = result.data.parse?.text ?? "";
    const constituents = parseConstituents(symbol, html);
    const payload: IndexConstituentsResponse = {
        updatedAt: new Date().toISOString(),
        symbol,
        name: INDEX_LABELS[symbol],
        sectors: Array.from(new Set(constituents.map((item) => item.sector))).sort(),
        constituents,
    };

    cache.set(symbol, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    return NextResponse.json(payload);
}
