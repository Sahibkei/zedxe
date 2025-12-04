"use client";

import { useEffect, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { deletePortfolio, updatePortfolioMeta } from '@/lib/portfolio/actions';
import { CURRENCIES } from '@/lib/constants';

type PortfolioMeta = { id: string; name: string; baseCurrency: string };

type PortfolioSettingsDialogProps = {
    portfolio: PortfolioMeta | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdated?: (updated: PortfolioMeta) => void;
    onDeleted?: () => void;
};

const PortfolioSettingsDialog = ({ portfolio, open, onOpenChange, onDeleted, onUpdated }: PortfolioSettingsDialogProps) => {
    const [name, setName] = useState(portfolio?.name || '');
    const [baseCurrency, setBaseCurrency] = useState(portfolio?.baseCurrency || CURRENCIES[0]);
    const [error, setError] = useState('');
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        if (!open) return;
        /* eslint-disable react-hooks/set-state-in-effect */
        setName(portfolio?.name || '');
        setBaseCurrency(portfolio?.baseCurrency || CURRENCIES[0]);
        setError('');
        setConfirmingDelete(false);
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [open, portfolio?.baseCurrency, portfolio?.name]);

    const canSave = Boolean(portfolio && name.trim().length > 1 && baseCurrency);

    const handleSave = () => {
        if (!portfolio) return;
        startTransition(async () => {
            const res = await updatePortfolioMeta({ id: portfolio.id, name: name.trim(), baseCurrency });
            if (res?.success) {
                onUpdated?.({ id: portfolio.id, name: name.trim(), baseCurrency });
                setError('');
                onOpenChange(false);
                return;
            }
            setError(res?.error || 'Unable to update portfolio.');
        });
    };

    const handleDelete = () => {
        if (!portfolio) return;
        startTransition(async () => {
            const res = await deletePortfolio(portfolio.id);
            if (res?.success) {
                setError('');
                onOpenChange(false);
                onDeleted?.();
                return;
            }
            setError(res?.error || 'Unable to delete portfolio.');
        });
    };

    const disabled = !portfolio || pending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-950 text-gray-100">
                <DialogHeader>
                    <DialogTitle>Portfolio settings</DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    <div className="space-y-3">
                        <h4 className="text-sm font-semibold text-gray-200">Details</h4>
                        <div className="space-y-2">
                            <Label htmlFor="portfolio-name">Name</Label>
                            <Input
                                id="portfolio-name"
                                placeholder="e.g. Retirement account"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                disabled={disabled}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Base currency</Label>
                            <Select value={baseCurrency} onValueChange={setBaseCurrency} disabled={disabled}>
                                <SelectTrigger className="bg-gray-900 text-gray-100">
                                    <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                                <SelectContent className="bg-gray-900 text-gray-100">
                                    {CURRENCIES.map((code) => (
                                        <SelectItem key={code} value={code}>
                                            {code}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {error && <p className="text-sm text-red-400">{error}</p>}

                    <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-red-300">Danger zone</p>
                                <p className="text-xs text-red-200/80">
                                    Deleting a portfolio will remove all associated transactions.
                                </p>
                            </div>
                            {!confirmingDelete ? (
                                <Button
                                    variant="destructive"
                                    className="bg-red-600 text-white hover:bg-red-500"
                                    onClick={() => setConfirmingDelete(true)}
                                    disabled={disabled}
                                >
                                    Delete portfolio
                                </Button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        className="border border-gray-800 bg-gray-900 text-gray-200"
                                        onClick={() => setConfirmingDelete(false)}
                                        disabled={pending}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        className="bg-red-600 text-white hover:bg-red-500"
                                        onClick={handleDelete}
                                        disabled={pending}
                                    >
                                        {pending ? 'Deleting...' : 'Confirm delete'}
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" className="border-gray-700 text-gray-100" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={!canSave || pending}
                        className="bg-yellow-500 text-black hover:bg-yellow-400"
                    >
                        {pending ? 'Saving...' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PortfolioSettingsDialog;
