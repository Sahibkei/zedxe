import StockProfileHeader from "@/components/stocks/StockProfileHeader";
import StockProfileSubnav from "@/components/stocks/StockProfileSubnav";

import { getStockProfileData } from "./data";

const StockProfileLayout = async ({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ symbol: string }>;
}) => {
    const { symbol } = await params;
    const { profile } = await getStockProfileData(symbol);

    return (
        <div className="min-h-screen bg-[#010409] text-slate-100">
            <div className="mx-auto w-full max-w-[1800px] px-6 pb-12 pt-24">
                <div className="space-y-6">
                    <div className="sticky top-20 z-20">
                        <StockProfileHeader header={profile.header} />
                    </div>
                    <StockProfileSubnav symbol={profile.header.symbol} />
                    <main>{children}</main>
                </div>
            </div>
        </div>
    );
};

export default StockProfileLayout;
