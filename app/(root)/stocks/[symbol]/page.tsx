import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getStockProfileData } from "./data";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
    const { symbol } = await params;
    const { profile } = await getStockProfileData(symbol);
    return {
        title: `${profile.header.symbol} · Stock Profile · ZedXe`,
    };
}

const StockProfilePage = async ({ params }: { params: Promise<{ symbol: string }> }) => {
    const { symbol } = await params;
    redirect(`/stocks/${symbol}/overview`);
};

export default StockProfilePage;
