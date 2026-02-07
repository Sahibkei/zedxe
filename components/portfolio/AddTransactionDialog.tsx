"use client";

import { useEffect, useMemo, useState, useTransition } from 'react';

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
import { addTransaction } from '@/lib/portfolio/actions';
import { CURRENCIES } from '@/lib/constants';
import type { PortfolioLean } from '@/lib/portfolio/portfolio-service';
import type { TransactionType } from '@/database/models/transaction.model';
import { cn } from '@/lib/utils';

const AddTransactionDialog = ({
    portfolios,
    defaultPortfolioId,
    defaultSymbol,
    triggerVariant = 'button',
    open: controlledOpen,
    onOpenChange,
    onAdded,
    triggerLabel = '+ Add Transaction',
    triggerClassName,
}: {
    portfolios: PortfolioLean[];
    defaultPortfolioId?: string;
    defaultSymbol?: string;
    triggerVariant?: 'button' | 'icon' | 'link';
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    onAdded?: () => void;
    triggerLabel?: string;
    triggerClassName?: string;
}) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen ?? internalOpen;
    const handleOpenChange = onOpenChange ?? setInternalOpen;
    const initialPortfolioId = defaultPortfolioId || portfolios[0]?.id || '';
    const [portfolioId, setPortfolioId] = useState(initialPortfolioId);
    const [type, setType] = useState<TransactionType>('BUY');
    const [symbol, setSymbol] = useState(defaultSymbol || '');
    const [quantity, setQuantity] = useState('');
    const [price, setPrice] = useState('');
    const initialCurrency = portfolios.find((p) => p.id === initialPortfolioId)?.baseCurrency || 'USD';
    const [currency, setCurrency] = useState(initialCurrency);
    const [tradeDate, setTradeDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');
    const [pending, startTransition] = useTransition();

    const selectedPortfolio = useMemo(() => portfolios.find((p) => p.id === portfolioId), [portfolioId, portfolios]);

    const totalAmount = useMemo(() => {
        const qtyNum = Number(quantity);
        const priceNum = Number(price);
        if (!Number.isFinite(qtyNum) || !Number.isFinite(priceNum)) return 0;
        return qtyNum * priceNum;
    }, [price, quantity]);

    const canSubmit = useMemo(() => {
        return Boolean(portfolioId && symbol.trim() && Number(quantity) > 0 && Number(price) > 0 && currency);
    }, [currency, portfolioId, price, quantity, symbol]);

    useEffect(() => {
        if (!isOpen) return;
        /* eslint-disable react-hooks/set-state-in-effect */
        const nextPortfolioId = defaultPortfolioId || portfolios[0]?.id || '';
        setPortfolioId(nextPortfolioId);
        setSymbol(defaultSymbol || '');
        const base = portfolios.find((p) => p.id === (defaultPortfolioId || nextPortfolioId))?.baseCurrency;
        if (base) setCurrency(base);
        /* eslint-enable react-hooks/set-state-in-effect */
    }, [defaultPortfolioId, defaultSymbol, isOpen, portfolios]);

    const handleSubmit = () => {
        if (!canSubmit) return;
        startTransition(async () => {
            const res = await addTransaction({
                portfolioId,
                type,
                symbol,
                quantity: Number(quantity),
                price: Number(price),
                currency,
                tradeDate,
            });

            if (res?.success) {
                setError('');
                onAdded?.();
                handleOpenChange(false);
                setSymbol(defaultSymbol || '');
                setQuantity('');
                setPrice('');
                return;
            }
            setError(res?.error || 'Failed to add transaction.');
        });
    };

    const renderTrigger = () => {
        if (triggerVariant === 'icon') {
            return (
                <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                        "h-8 w-8 rounded-lg border border-border/70 bg-muted/20 text-foreground hover:bg-muted/30",
                        triggerClassName
                    )}
                >
                    +
                </Button>
            );
        }

        if (triggerVariant === 'link') {
            return (
                <Button variant="link" className={cn("h-8 px-0 text-primary", triggerClassName)}>
                    {triggerLabel}
                </Button>
            );
        }

        return (
            <Button
                variant="ghost"
                className={cn(
                    "h-9 rounded-lg border border-border/70 bg-primary/20 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-foreground hover:bg-primary/25",
                    triggerClassName
                )}
            >
                {triggerLabel}
            </Button>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {renderTrigger()}
            </DialogTrigger>
            <DialogContent className="bg-gray-950 text-gray-100">
                <DialogHeader>
                    <DialogTitle>Add Transaction</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label>Portfolio</Label>
                        <Select
                            value={portfolioId}
                            onValueChange={(value) => {
                                setPortfolioId(value);
                                const base = portfolios.find((p) => p.id === value)?.baseCurrency;
                                if (base) setCurrency(base);
                            }}
                        >
                            <SelectTrigger className="bg-gray-900 text-gray-100">
                                <SelectValue placeholder="Select portfolio" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 text-gray-100">
                                {portfolios.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name} ({p.baseCurrency})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Transaction Type</Label>
                        <Select value={type} onValueChange={(val) => setType(val as TransactionType)}>
                            <SelectTrigger className="bg-gray-900 text-gray-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 text-gray-100">
                                <SelectItem value="BUY">Buy</SelectItem>
                                <SelectItem value="SELL">Sell</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="symbol">Stock Symbol</Label>
                        <Input
                            id="symbol"
                            placeholder="AAPL"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                            id="quantity"
                            type="number"
                            min="0"
                            step="0.0001"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="price">Purchase Price</Label>
                        <Input
                            id="price"
                            type="number"
                            min="0"
                            step="0.01"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger className="bg-gray-900 text-gray-100">
                                <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent className="bg-gray-900 text-gray-100">
                                {(selectedPortfolio ? [selectedPortfolio.baseCurrency, ...CURRENCIES] : CURRENCIES)
                                    .filter((val, idx, arr) => arr.indexOf(val) === idx)
                                    .map((code) => (
                                        <SelectItem key={code} value={code}>
                                            {code}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="trade-date">Transaction Date</Label>
                        <Input
                            id="trade-date"
                            type="date"
                            value={tradeDate}
                            onChange={(e) => setTradeDate(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center justify-between rounded-md bg-gray-900/60 px-4 py-3 text-sm text-gray-300">
                    <span>Total Amount</span>
                    <span className="font-semibold">{totalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <DialogFooter>
                    <Button variant="outline" className="border-gray-700 text-gray-100" onClick={() => handleOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={pending || !canSubmit}
                        className="bg-yellow-500 text-black hover:bg-yellow-400"
                    >
                        {pending ? 'Saving...' : 'Add Transaction'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AddTransactionDialog;
