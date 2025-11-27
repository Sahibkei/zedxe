"use client";

import { useState } from "react";
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
        frequency: alert?.frequency || 'once',
    };

    const handleSave = (saved: AlertDisplay) => {
        setAlert(saved);
    };

    return (
        <div className="flex items-center gap-3">
            <WatchlistButton symbol={symbol} company={company} isInWatchlist={isInWatchlist} />
            <Button className="bg-yellow-500 text-black hover:bg-yellow-400" onClick={() => setModalOpen(true)}>
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
