import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { canonicalPathSymbol } from "@/src/lib/symbol";
import { getStockProfileData } from "./data";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
    const { symbol } = await params;
    const canonicalSymbol = canonicalPathSymbol(symbol);
    const { profile } = await getStockProfileData(canonicalSymbol);
    return {
        title: `${profile.symbol} · Stock Profile · ZedXe`,
    };
}

const StockProfilePage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = canonicalPathSymbol(symbol);
    redirect(`/stocks/${canonicalSymbol}/overview`);
};

export default StockProfilePage;
