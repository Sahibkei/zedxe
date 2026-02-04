"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';

import PortfolioAllocationPie from '@/components/portfolio/PortfolioAllocationPie';
import CryptoHoldingsTable from '@/components/portfolio/CryptoHoldingsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SUPPORTED_CHAINS } from '@/lib/crypto/constants';
import type { CryptoPortfolioSnapshotLean } from '@/lib/crypto/portfolio-service';
import {
    deleteCryptoSnapshotAction,
    refreshCryptoPortfolioAction,
    updateCryptoSnapshotMetaAction,
} from '@/lib/crypto/actions';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value || 0);

const CryptoPortfolioPanel = ({ initialSnapshots }: { initialSnapshots: CryptoPortfolioSnapshotLean[] }) => {
    const [snapshots, setSnapshots] = useState<CryptoPortfolioSnapshotLean[]>(initialSnapshots);
    const [selectedSnapshotId, setSelectedSnapshotId] = useState(initialSnapshots[0]?.id || '');
    const [walletName, setWalletName] = useState(initialSnapshots[0]?.name || '');
    const [walletAddress, setWalletAddress] = useState(initialSnapshots[0]?.walletAddress || '');
    const [snapshot, setSnapshot] = useState<CryptoPortfolioSnapshotLean | null>(initialSnapshots[0] || null);
    const [error, setError] = useState('');
    const [isRefreshing, startRefresh] = useTransition();
    const [isSavingMeta, startSaveMeta] = useTransition();

    const allocationData = useMemo(
        () => snapshot?.holdings.map((h) => ({ symbol: h.symbol, weightPct: h.allocationPct })) || [],
        [snapshot]
    );

    useEffect(() => {
        if (!selectedSnapshotId) {
            setSnapshot(null);
            setWalletName('');
            setWalletAddress('');
            return;
        }

        const found = snapshots.find((s) => s.id === selectedSnapshotId) || null;
        setSnapshot(found);
        setWalletName(found?.name || '');
        setWalletAddress(found?.walletAddress || '');
    }, [selectedSnapshotId, snapshots]);

    const handleRefresh = () => {
        if (!walletAddress.trim()) {
            setError('Please enter a wallet address.');
            return;
        }
        startRefresh(async () => {
            const res = await refreshCryptoPortfolioAction({ walletAddress: walletAddress.trim(), name: walletName.trim() });
            if (res.success) {
                const refreshed = res.snapshot;
                setSnapshots((prev) => {
                    const existingIndex = prev.findIndex((s) => s.id === refreshed.id);
                    if (existingIndex >= 0) {
                        const next = [...prev];
                        next[existingIndex] = refreshed;
                        return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                    }
                    return [refreshed, ...prev];
                });
                setSelectedSnapshotId(refreshed.id);
                setSnapshot(refreshed);
                setError('');
            } else {
                setError(res.error || 'Unable to load this wallet right now.');
            }
        });
    };

    const handleSaveMeta = () => {
        if (!selectedSnapshotId) {
            setError('Select a saved wallet to update.');
            return;
        }

        if (!walletAddress.trim()) {
            setError('Wallet address is required.');
            return;
        }

        startSaveMeta(async () => {
            const res = await updateCryptoSnapshotMetaAction(selectedSnapshotId, {
                name: walletName.trim(),
                walletAddress: walletAddress.trim(),
            });
            if (res.success && res.snapshot) {
                const updated = res.snapshot;
                setSnapshots((prev) => {
                    const next = prev.map((s) => (s.id === updated.id ? updated : s));
                    return next.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
                });
                setSnapshot(updated);
                setSelectedSnapshotId(updated.id);
                setError('');
            } else {
                setError(res.error || 'Unable to update this wallet.');
            }
        });
    };

    const handleDelete = () => {
        if (!selectedSnapshotId) return;
        const confirmed = window.confirm('Delete this saved wallet?');
        if (!confirmed) return;

        startSaveMeta(async () => {
            const res = await deleteCryptoSnapshotAction(selectedSnapshotId);
            if (res.success) {
                setSnapshots((prev) => {
                    const remaining = prev.filter((s) => s.id !== selectedSnapshotId);
                    const nextSelection = remaining[0]?.id || '';
                    setSelectedSnapshotId(nextSelection);
                    const nextSnapshot = remaining.find((s) => s.id === nextSelection) || null;
                    setSnapshot(nextSnapshot || null);
                    setWalletName(nextSnapshot?.name || '');
                    setWalletAddress(nextSnapshot?.walletAddress || '');
                    return remaining;
                });
                setError('');
            } else {
                setError(res.error || 'Unable to delete this wallet.');
            }
        });
    };

    const handleSelectWallet = (value: string) => {
        setError('');
        if (value === 'new') {
            setSelectedSnapshotId('');
            setWalletName('');
            setWalletAddress('');
            setSnapshot(null);
            return;
        }
        setSelectedSnapshotId(value);
    };

    const formatWalletLabel = (s: CryptoPortfolioSnapshotLean) => s.name || `${s.walletAddress.slice(0, 6)}...${s.walletAddress.slice(-4)}`;

    return (
        <div className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <span>Supported chains:</span>
                            {SUPPORTED_CHAINS.map((chain) => (
                                <span key={chain.id} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">
                                    {chain.label}
                                </span>
                            ))}
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-slate-400">Total Value (USDT ≈ USD)</p>
                            <p className="text-3xl font-semibold text-slate-100">
                                {formatCurrency(snapshot?.totalValueUsd || 0)}
                            </p>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label className="text-sm text-slate-300">Saved wallets</Label>
                            <Select value={selectedSnapshotId || 'new'} onValueChange={handleSelectWallet}>
                                <SelectTrigger className="w-full border-white/10 bg-slate-950/60 text-slate-100">
                                    <SelectValue placeholder="Select a saved wallet" />
                                </SelectTrigger>
                                <SelectContent className="border-white/10 bg-slate-950 text-slate-100">
                                    {snapshots.map((s) => (
                                        <SelectItem key={s.id} value={s.id} className="hover:bg-white/10">
                                            {formatWalletLabel(s)}
                                        </SelectItem>
                                    ))}
                                    <SelectItem value="new" className="hover:bg-white/10">
                                        + New wallet
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm text-slate-300" htmlFor="walletName">
                                Wallet name
                            </Label>
                            <Input
                                id="walletName"
                                value={walletName}
                                onChange={(e) => setWalletName(e.target.value)}
                                placeholder="e.g., Main DeFi Wallet"
                                className="w-full"
                            />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label className="text-sm text-slate-300" htmlFor="walletAddress">
                                Wallet address
                            </Label>
                            <Input
                                id="walletAddress"
                                value={walletAddress}
                                onChange={(e) => setWalletAddress(e.target.value)}
                                placeholder="Paste EVM wallet address"
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end md:space-x-3">
                            {selectedSnapshotId && (
                                <Button
                                    variant="ghost"
                                    className="border border-white/10 text-red-400 hover:bg-white/10"
                                    onClick={handleDelete}
                                    disabled={isSavingMeta}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </Button>
                            )}
                            {selectedSnapshotId && (
                                <Button
                                    variant="outline"
                                    className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                                    onClick={handleSaveMeta}
                                    disabled={isSavingMeta}
                                >
                                    Save changes
                                </Button>
                            )}
                            <Button
                                onClick={handleRefresh}
                                disabled={isRefreshing}
                                className="md:w-auto bg-slate-100 text-slate-900 hover:bg-white"
                                variant="secondary"
                            >
                                <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                {snapshot ? 'Refresh balances' : 'Save & refresh'}
                            </Button>
                        </div>
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                    {snapshot?.updatedAt && (
                        <p className="text-xs text-slate-500">Last updated: {new Date(snapshot.updatedAt).toLocaleString()}</p>
                    )}
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
