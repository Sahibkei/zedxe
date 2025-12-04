"use client";

import { useMemo, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createPortfolio } from '@/lib/portfolio/actions';
import type { PortfolioLean } from '@/lib/portfolio/portfolio-service';

const currencies = ['USD', 'EUR', 'GBP'];

const AddPortfolioDialog = ({
    triggerLabel = '+ New Portfolio',
    onCreated,
}: {
    triggerLabel?: string;
    onCreated?: (portfolio: PortfolioLean) => void;
}) => {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();

    const canSubmit = useMemo(() => name.trim().length > 1 && currency, [name, currency]);

    const handleSubmit = () => {
        if (!canSubmit) return;
        startTransition(async () => {
            const res = await createPortfolio({ name, baseCurrency: currency });
            if (res?.success && res.portfolio) {
                onCreated?.(res.portfolio);
                setName('');
                setCurrency('USD');
                setError('');
                setOpen(false);
                return;
            }
            setError(res?.error || 'Unable to create portfolio.');
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-yellow-500 text-black hover:bg-yellow-400">{triggerLabel}</Button>
            </DialogTrigger>
            <DialogContent className="bg-gray-950 text-gray-100">
                <DialogHeader>
                    <DialogTitle>Create Portfolio</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="portfolio-name">Account Name</Label>
                        <Input
                            id="portfolio-name"
                            placeholder="e.g. Long-Term Holdings"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger className="bg-gray-900 text-gray-100">
                                <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 text-gray-100">
                                {currencies.map((code) => (
                                    <SelectItem key={code} value={code}>
                                        {code}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" className="border-gray-700 text-gray-100" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={pending || !canSubmit}
                        className="bg-yellow-500 text-black hover:bg-yellow-400"
                    >
                        {pending ? 'Creating...' : 'Create Portfolio'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddPortfolioDialog;
