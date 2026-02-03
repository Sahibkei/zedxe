import { ReactNode } from "react";

type OpenBBLayoutGridProps = {
    tickerInformation: ReactNode;
    tickerProfile: ReactNode;
    pricePerformance: ReactNode;
    revenueGrowth: ReactNode;
    keyMetrics: ReactNode;
    shareStatistics: ReactNode;
    valuationMultiples: ReactNode;
    managementTeam: ReactNode;
    revenueBusinessLine: ReactNode;
};

export function OpenBBLayoutGrid({
    tickerInformation,
    tickerProfile,
    pricePerformance,
    revenueGrowth,
    keyMetrics,
    shareStatistics,
    valuationMultiples,
    managementTeam,
    revenueBusinessLine,
}: OpenBBLayoutGridProps) {
    return (
        <div className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
                <div className="space-y-4">
                    {tickerInformation}
                    {tickerProfile}
                </div>
                <div className="min-h-[520px]">{pricePerformance}</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div>{revenueGrowth}</div>
                <div>{keyMetrics}</div>
                <div>{shareStatistics}</div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.35fr_1.65fr]">
                <div>{valuationMultiples}</div>
                <div>{managementTeam}</div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
                <div className="hidden lg:block lg:w-1/3" aria-hidden />
                <div className="flex-1">{revenueBusinessLine}</div>
            </div>
        </div>
    );
}

export default OpenBBLayoutGrid;
