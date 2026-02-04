import type { PortfolioRatios } from '@/lib/portfolio/portfolio-service';

const RatioRow = ({ label, value }: { label: string; value: string }) => {
    return (
        <div className="flex items-center justify-between border-b border-white/10 py-2 last:border-b-0">
            <span className="text-sm text-slate-400">{label}</span>
            <span className="text-sm font-medium text-slate-100">{value}</span>
        </div>
    );
};

const PortfolioRatiosCard = ({ ratios }: { ratios: PortfolioRatios }) => {
    const formatNumber = (value: number | null, decimals = 2) => {
        if (value == null) return 'N/A';
        return value.toFixed(decimals);
    };

    const formatPercent = (value: number | null, decimals = 2) => {
        if (value == null) return 'N/A';
        const sign = value > 0 ? '+' : '';
        return `${sign}${value.toFixed(decimals)}%`;
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-lg">
            <h3 className="text-lg font-semibold text-slate-100">Portfolio Ratios</h3>
            <div className="mt-4 divide-y divide-white/10">
                <RatioRow label="Beta" value={formatNumber(ratios.beta)} />
                <RatioRow label="Sharpe Ratio" value={formatNumber(ratios.sharpe)} />
                <RatioRow label="Benchmark Return" value={formatPercent(ratios.benchmarkReturnPct)} />
                <RatioRow label="Total Return %" value={formatPercent(ratios.totalReturnPct)} />
            </div>
        </div>
    );
};

export default PortfolioRatiosCard;
