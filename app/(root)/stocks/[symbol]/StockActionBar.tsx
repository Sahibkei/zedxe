"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

import WatchlistButton from "@/components/WatchlistButton";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/AlertModal";
import { cn } from "@/lib/utils";

const StockActionBar = ({
    symbol,
    company,
    isInWatchlist,
    initialAlert,
    compact = false,
}: {
    symbol: string;
    company: string;
    isInWatchlist: boolean;
    initialAlert?: AlertDisplay;
    compact?: boolean;
}) => {
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

    const actionButtonClass = cn(
        "border-border/70 bg-transparent text-foreground hover:bg-muted/25",
        compact ? "h-9 rounded-lg px-3 text-xs font-semibold" : "h-9 rounded-md px-3 text-sm"
    );

    return (
        <div className={cn("flex flex-wrap items-center gap-2", compact && "justify-end")}>
            <WatchlistButton symbol={symbol} company={company} isInWatchlist={isInWatchlist} variant="compact" />
            <Button asChild variant="outline" size="sm" className={actionButtonClass}>
                <Link href={`/stocks/${symbol}/options`}>Options Analysis</Link>
            </Button>
            <Button
                variant="outline"
                size="sm"
                className={actionButtonClass}
                onClick={() => setModalOpen(true)}
            >
                <Bell className="h-3.5 w-3.5" />
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
