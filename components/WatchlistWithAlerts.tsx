"use client";

import { useState } from "react";
import { toast } from "sonner";

import AlertModal from "@/components/AlertModal";
import AlertsPanel from "@/components/AlertsPanel";
import WatchlistTable from "@/components/WatchlistTable";

const buildFormState = (item: WatchlistEntryWithData): AlertFormState => ({
    alertId: undefined,
    symbol: item.symbol,
    company: item.company,
    alertName: `${item.symbol} price alert`,
    condition: "greater_than",
    thresholdValue: item.currentPrice ?? "",
    frequency: "once_per_hour",
    isActive: true,
});

const WatchlistWithAlerts = ({ watchlist, alerts: initialAlerts }: { watchlist: WatchlistEntryWithData[]; alerts: AlertDisplay[] }) => {
    const [alerts, setAlerts] = useState<AlertDisplay[]>(initialAlerts);
    const [modalOpen, setModalOpen] = useState(false);
    const [formState, setFormState] = useState<AlertFormState | null>(null);

    const openCreate = (item: WatchlistEntryWithData) => {
        setFormState(buildFormState(item));
        setModalOpen(true);
    };

    const openEdit = (alert: AlertDisplay) => {
        setFormState({
            alertId: alert.id,
            symbol: alert.symbol,
            company: alert.company,
            alertName: alert.alertName,
            condition: alert.condition,
            thresholdValue: alert.thresholdValue,
            frequency: alert.frequency,
            isActive: alert.isActive,
        });
        setModalOpen(true);
    };

    const handleSave = (saved: AlertDisplay) => {
        setAlerts((prev) => {
            const existingIndex = prev.findIndex((item) => item.id === saved.id);
            if (existingIndex >= 0) {
                const copy = [...prev];
                copy[existingIndex] = saved;
                return copy;
            }
            return [saved, ...prev];
        });
        setModalOpen(false);
    };

    const handleToggle = async (alert: AlertDisplay, isActive: boolean) => {
        try {
            const res = await fetch("/api/alerts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: alert.id, isActive }),
            });

            if (res.status === 401) {
                toast.error("Please sign in to manage alerts.");
                return;
            }
            if (!res.ok) throw new Error("Failed to update alert");

            const data = await res.json();
            setAlerts(data.alerts || []);
            toast.success(`Alert ${isActive ? "resumed" : "paused"}`);
        } catch (error) {
            console.error("toggle alert error", error);
            toast.error("Unable to update alert right now.");
        }
    };

    const handleDelete = async (alertId: string) => {
        try {
            const res = await fetch(`/api/alerts?id=${alertId}`, { method: "DELETE" });
            if (res.status === 401) {
                toast.error("Please sign in to manage alerts.");
                return;
            }
            if (!res.ok) throw new Error("Failed to delete alert");
            const data = await res.json();
            setAlerts(data.alerts || []);
            toast.success("Alert deleted");
        } catch (error) {
            console.error("delete alert error", error);
            toast.error("Unable to delete alert right now.");
        }
    };

    const currentFormState = formState ?? buildFormState(watchlist[0]);

    return (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <WatchlistTable watchlist={watchlist} onAddAlert={openCreate} />
            <AlertsPanel alerts={alerts} onEdit={openEdit} onToggleActive={handleToggle} onDelete={handleDelete} />

            {modalOpen && (
                <AlertModal
                    open={modalOpen}
                    onClose={() => setModalOpen(false)}
                    initialState={currentFormState}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

export default WatchlistWithAlerts;
