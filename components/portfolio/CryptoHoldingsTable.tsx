import { SUPPORTED_CHAINS } from '@/lib/crypto/constants';
import type { CryptoHolding } from '@/lib/crypto/portfolio-service';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
    }).format(value || 0);
};

const formatNumber = (value: number, digits = 2) => {
    if (!Number.isFinite(value)) return '—';
    return value.toFixed(digits);
};

const chainLabelMap = SUPPORTED_CHAINS.reduce<Record<string, string>>((acc, chain) => {
    acc[chain.id] = chain.label;
    return acc;
}, {});

const CryptoHoldingsTable = ({ holdings }: { holdings: CryptoHolding[] }) => {
    return (
        <div className="rounded-lg border border-gray-800 bg-gray-900/40">
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-800 text-sm">
                    <thead className="bg-gray-900/60 text-gray-400">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Token</th>
                            <th className="px-4 py-3 text-left font-semibold">Symbol</th>
                            <th className="px-4 py-3 text-left font-semibold">Chain</th>
                            <th className="px-4 py-3 text-right font-semibold">Balance</th>
                            <th className="px-4 py-3 text-right font-semibold">Price (USD)</th>
                            <th className="px-4 py-3 text-right font-semibold">Value (USD)</th>
                            <th className="px-4 py-3 text-right font-semibold">Allocation</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800 bg-gray-950/40 text-gray-100">
                        {holdings.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-6 text-center text-gray-400">
                                    No crypto holdings yet. Paste a wallet address to load balances.
                                </td>
                            </tr>
                        ) : (
                            holdings.map((holding) => (
                                <tr key={`${holding.chainId}-${holding.tokenAddress}`}>
                                    <td className="px-4 py-3">{holding.name}</td>
                                    <td className="px-4 py-3 text-gray-300">{holding.symbol}</td>
                                    <td className="px-4 py-3 text-gray-300">{chainLabelMap[holding.chainId] || holding.chainId}</td>
                                    <td className="px-4 py-3 text-right">{holding.balanceFormatted || holding.balance || '—'}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(holding.usdPrice || 0)}</td>
                                    <td className="px-4 py-3 text-right">{formatCurrency(holding.usdValue || 0)}</td>
                                    <td className="px-4 py-3 text-right text-gray-300">{formatNumber(holding.allocationPct)}%</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CryptoHoldingsTable;
