import type { PortfolioRatios } from '@/lib/portfolio/portfolio-service';

const RatioRow = ({ label, value }: { label: string; value: number | null }) => {
    return (
        <div className="flex items-center justify-between border-b border-gray-800 py-2 last:border-b-0">
            <span className="text-sm text-gray-400">{label}</span>
            <span className="text-sm font-medium text-gray-100">{value ?? 'Coming soon'}</span>
        </div>
    );
};

const PortfolioRatiosCard = ({ ratios }: { ratios: PortfolioRatios }) => {
    return (
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-4">
            <h3 className="text-lg font-semibold text-gray-100">Portfolio Ratios</h3>
            <div className="mt-4 divide-y divide-gray-800">
                <RatioRow label="Beta" value={ratios.beta} />
                <RatioRow label="Sharpe Ratio" value={ratios.sharpe} />
                <RatioRow label="Benchmark Return" value={ratios.benchmarkReturn} />
                <RatioRow label="Total Return %" value={ratios.totalReturnPct} />
            </div>
        </div>
    );
};

export default PortfolioRatiosCard;
