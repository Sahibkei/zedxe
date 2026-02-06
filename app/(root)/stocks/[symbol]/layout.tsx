import StockProfileHeader from "@/components/stocks/StockProfileHeader";
import StockProfileSubnav from "@/components/stocks/StockProfileSubnav";

import { getCanonicalSymbol, getStockProfileData } from "./data";

const StockProfileLayout = async ({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ symbol: string }>;
}) => {
    const { symbol } = await params;
    const canonicalSymbol = getCanonicalSymbol(symbol);
    const { profile, quote } = await getStockProfileData(canonicalSymbol);

    return (
        <div className="min-h-screen bg-[#010409] text-slate-100">
            <div className="mx-auto w-full max-w-[1800px] px-6 pb-12 pt-24">
                <div className="space-y-6">
                    <div className="sticky top-20 z-20 bg-[#010409] pb-4">
                        <StockProfileHeader profile={profile} initialQuote={quote} />
                    </div>
                    <div className="sticky top-[148px] z-10 bg-[#010409] pb-4">
                        <StockProfileSubnav symbol={profile.symbol} />
                    </div>
                    <main>{children}</main>
                </div>
            </div>
        </div>
    );
};

export default StockProfileLayout;
