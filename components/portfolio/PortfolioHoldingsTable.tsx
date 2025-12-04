import type { PositionSummary } from '@/lib/portfolio/portfolio-service';

const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
    }).format(value || 0);
};

const formatNumber = (value: number, digits = 2) => {
    if (!Number.isFinite(value)) return '—';
    return value.toFixed(digits);
};

const getChangeClass = (value: number) => {
    if (!Number.isFinite(value) || value === 0) return 'text-gray-300';
    return value > 0 ? 'text-green-400' : 'text-red-400';
};

const calculateTotals = (positions: PositionSummary[]) => {
    const totalPnlAbs = positions.reduce((sum, p) => sum + p.pnlAbs, 0);
    const totalCost = positions.reduce((sum, p) => sum + p.avgPrice * p.quantity, 0);
    const totalPnlPct = totalCost !== 0 ? (totalPnlAbs / totalCost) * 100 : 0;
    return { totalPnlAbs, totalPnlPct };
};

const PortfolioHoldingsTable = ({
    positions,
    baseCurrency,
}: {
    positions: PositionSummary[];
    baseCurrency: string;
}) => {
    const { totalPnlAbs, totalPnlPct } = calculateTotals(positions);

    return (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800 text-sm">
                    <thead className="bg-gray-900/60 text-gray-400">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Company</th>
                            <th className="px-4 py-3 text-left font-semibold">Symbol</th>
                            <th className="px-4 py-3 text-right font-semibold">Quantity</th>
                            <th className="px-4 py-3 text-right font-semibold">Avg Price</th>
                            <th className="px-4 py-3 text-right font-semibold">Current Price</th>
                            <th className="px-4 py-3 text-right font-semibold">Current Value</th>
                            <th className="px-4 py-3 text-right font-semibold">P/L</th>
                            <th className="px-4 py-3 text-right font-semibold">P/L (%)</th>
                            <th className="px-4 py-3 text-right font-semibold">Weight (%)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 bg-gray-950/40 text-gray-100">
                        {positions.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-6 text-center text-gray-400">
                                    No holdings yet. Add your first transaction.
                                </td>
                            </tr>
                        ) : (
                            positions.map((position) => (
                                <tr key={position.symbol}>
                                    <td className="px-4 py-3">{position.companyName || position.symbol}</td>
                                    <td className="px-4 py-3 text-gray-300">{position.symbol}</td>
                                    <td className="px-4 py-3 text-right">{formatNumber(position.quantity, 4)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(position.avgPrice, baseCurrency)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(position.currentPrice, baseCurrency)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(position.currentValue, baseCurrency)}</td>
                                    <td className={`px-4 py-3 text-right ${getChangeClass(position.pnlAbs)}`}>
                                        {formatCurrency(position.pnlAbs, baseCurrency)}
                                    </td>
                                    <td className={`px-4 py-3 text-right ${getChangeClass(position.pnlPct)}`}>
                                        {formatNumber(position.pnlPct)}%
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-300">{formatNumber(position.weightPct)}%</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot className="bg-gray-900/60 text-gray-100">
                        <tr>
                            <td colSpan={6} className="px-4 py-3 text-right font-semibold">
                                Total P/L
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${getChangeClass(totalPnlAbs)}`}>
                                {formatCurrency(totalPnlAbs, baseCurrency)}
                            </td>
                            <td className={`px-4 py-3 text-right font-semibold ${getChangeClass(totalPnlPct)}`}>
                                {formatNumber(totalPnlPct)}%
                            </td>
                            <td className="px-4 py-3" />
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

export default PortfolioHoldingsTable;
