"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
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
        <div className="flex flex-wrap items-center gap-2">
            <WatchlistButton symbol={symbol} company={company} isInWatchlist={isInWatchlist} />
            <Button asChild variant="outline" className="border-border/70 bg-transparent text-foreground hover:bg-muted/20">
                <Link href={`/stocks/${symbol}/options`}>Options Analysis</Link>
            </Button>
            <Button
                variant="outline"
                className="border-border/70 bg-transparent text-foreground hover:bg-muted/20"
                onClick={() => setModalOpen(true)}
            >
                <Bell className="h-4 w-4" />
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
