import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getCanonicalSymbol, getStockProfileData } from "./data";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    const { profile } = await getStockProfileData(canonicalSymbol);
    return {
        title: `${profile.header.symbol} · Stock Profile · ZedXe`,
    };
}

const StockProfilePage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    if (symbol !== canonicalSymbol) {
        redirect(`/stocks/${canonicalSymbol}/overview`);
    }
    redirect(`/stocks/${canonicalSymbol}/overview`);
};

export default StockProfilePage;
