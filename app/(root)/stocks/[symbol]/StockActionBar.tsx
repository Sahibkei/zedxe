"use client";

import { useState } from "react";
import Link from "next/link";
import WatchlistButton from "@/components/WatchlistButton";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/AlertModal";

const StockActionBar = ({ symbol, company, isInWatchlist, initialAlert }: { symbol: string; company: string; isInWatchlist: boolean; initialAlert?: AlertDisplay }) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [alert, setAlert] = useState<AlertDisplay | undefined>(initialAlert);

    const initialState: AlertFormState = {
        alertId: alert?.id,
        symbol,
        company,
        alertName: alert?.alertName || `${symbol} price alert`,
        condition: alert?.condition || 'greater_than',
        thresholdValue: alert?.thresholdValue ?? '',
        frequency: alert?.frequency || 'once_per_day',
        isActive: alert?.isActive ?? true,
    };

    const handleSave = (saved: AlertDisplay) => {
        setAlert(saved);
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            <WatchlistButton
                symbol={symbol}
                company={company}
                isInWatchlist={isInWatchlist}
                className="h-10 w-auto rounded-lg px-4 text-sm font-semibold"
            />
            <Button
                asChild
                variant="outline"
                className="h-10 rounded-lg border-white/20 px-4 text-sm text-slate-100 hover:bg-white/5"
            >
                <Link href={`/stocks/${symbol}/options`}>Options Analysis</Link>
            </Button>
            <Button
                className="h-10 rounded-lg bg-yellow-500 px-4 text-sm font-semibold text-black hover:bg-yellow-400"
                onClick={() => setModalOpen(true)}
            >
                {alert ? 'Edit Alert' : 'Create Alert'}
            </Button>
            {modalOpen && (
                <AlertModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    initialState={initialState}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default StockActionBar;
