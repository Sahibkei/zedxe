"use client";

import { useMemo, useState, useTransition } from 'react';
import { RefreshCw } from 'lucide-react';

import PortfolioAllocationPie from '@/components/portfolio/PortfolioAllocationPie';
import CryptoHoldingsTable from '@/components/portfolio/CryptoHoldingsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SUPPORTED_CHAINS } from '@/lib/crypto/constants';
import type { CryptoPortfolioSnapshotLean } from '@/lib/crypto/portfolio-service';
import { refreshCryptoPortfolioAction } from '@/lib/crypto/actions';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0);

const CryptoPortfolioPanel = ({ initialSnapshot }: { initialSnapshot: CryptoPortfolioSnapshotLean | null }) => {
    const [walletAddress, setWalletAddress] = useState(initialSnapshot?.walletAddress || '');
    const [snapshot, setSnapshot] = useState<CryptoPortfolioSnapshotLean | null>(initialSnapshot);
    const [error, setError] = useState('');
    const [isPending, startTransition] = useTransition();

    const allocationData = useMemo(
        () => snapshot?.holdings.map((h) => ({ symbol: h.symbol, weightPct: h.allocationPct })) || [],
        [snapshot]
    );

    const handleRefresh = () => {
        if (!walletAddress.trim()) {
            setError('Please enter a wallet address.');
            return;
        }
        startTransition(async () => {
            const res = await refreshCryptoPortfolioAction(walletAddress.trim());
            if (res.success) {
                setSnapshot(res.snapshot);
                setError('');
            } else {
                setError(res.error || 'Unable to load this wallet right now.');
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <span>Supported chains:</span>
                            {SUPPORTED_CHAINS.map((chain) => (
                                <span key={chain.id} className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-200">
                                    {chain.label}
                                </span>
                            ))}
                        </div>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <Input
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                placeholder="Paste EVM wallet address"
                                className="w-full md:w-96"
                            />
                            <Button
                                onClick={handleRefresh}
                                disabled={isPending}
                                className="md:w-auto"
                                variant="secondary"
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
                                {snapshot ? 'Refresh' : 'Load portfolio'}
                            </Button>
                        </div>
                        {error && <p className="text-sm text-red-400">{error}</p>}
                        {snapshot?.updatedAt && (
                            <p className="text-xs text-gray-500">Last updated: {new Date(snapshot.updatedAt).toLocaleString()}</p>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Total Value (USDT ≈ USD)</p>
                        <p className="text-3xl font-bold text-gray-100">{formatCurrency(snapshot?.totalValueUsd || 0)}</p>
                    </div>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                <div className="space-y-4">
                    <CryptoHoldingsTable holdings={snapshot?.holdings || []} />
                </div>
                <div className="space-y-4">
                    <PortfolioAllocationPie positions={allocationData} />
                </div>
            </div>
        </div>
    );
};

export default CryptoPortfolioPanel;
