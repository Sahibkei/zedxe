"use client";

import { Bell, Clock, Pause, Play, Trash2 } from "lucide-react";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";

const conditionLabel: Record<AlertCondition, string> = {
    greater_than: "Price greater than",
    less_than: "Price less than",
    crosses_above: "Crosses above",
    crosses_below: "Crosses below",
};

const frequencyLabel: Record<AlertFrequency, string> = {
    once: "Trigger once",
    once_per_hour: "Once per hour",
    once_per_day: "Once per day",
};

const formatDate = (date?: Date | string | null) => {
    if (!date) return "Never";
    const parsed = typeof date === "string" ? new Date(date) : date;
    return parsed.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

const AlertsPanel = ({
    alerts,
    onEdit,
    onToggleActive,
    onDelete,
}: {
    alerts: AlertDisplay[];
    onEdit: (alert: AlertDisplay) => void;
    onToggleActive: (alert: AlertDisplay, isActive: boolean) => Promise<void> | void;
    onDelete: (alertId: string) => Promise<void> | void;
}) => {
    const sortedAlerts = useMemo(
        () =>
            [...alerts].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [alerts]
    );

    return (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-100">
                    <Bell className="h-5 w-5 text-yellow-400" />
                    <h3 className="text-lg font-semibold">Alerts</h3>
                </div>
                <span className="rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">{alerts.length} active</span>
            </div>

            {sortedAlerts.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-800 bg-gray-950/70 p-6 text-center">
                    <Bell className="h-8 w-8 text-gray-500" />
                    <p className="text-sm text-gray-400">You haven&apos;t set any alerts yet. Add one from your watchlist.</p>
                </div>
            )}

            <div className="flex flex-col gap-3">
                {sortedAlerts.map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-gray-800 bg-[#0f0f0f] p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                                <p className="text-xs uppercase tracking-wide text-gray-500">{alert.symbol}</p>
                                <h4 className="text-base font-semibold text-gray-100">{alert.alertName}</h4>
                                <p className="text-sm text-gray-400">{alert.company}</p>
                            </div>
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    alert.isActive ? "bg-green-500/20 text-green-400" : "bg-gray-800 text-gray-400"
                                }`}
                            >
                                {alert.isActive ? "Active" : "Paused"}
                            </span>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-3 text-sm text-gray-300 sm:grid-cols-2">
                            <div className="rounded-md border border-gray-800 bg-black/20 p-3">
                                <p className="text-xs text-gray-500">Condition</p>
                                <p className="font-medium text-gray-100">{conditionLabel[alert.condition]}</p>
                                <p className="text-xs text-gray-500">Target: {formatPrice(alert.thresholdValue)}</p>
                            </div>
                            <div className="rounded-md border border-gray-800 bg-black/20 p-3">
                                <p className="text-xs text-gray-500">Frequency</p>
                                <p className="font-medium text-gray-100">{frequencyLabel[alert.frequency]}</p>
                                <p className="flex items-center gap-2 text-xs text-gray-500">
                                    <Clock className="h-3.5 w-3.5" /> Last hit: {formatDate(alert.lastTriggeredAt)}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                className="border-gray-700 text-gray-200"
                                onClick={() => onEdit(alert)}
                            >
                                Edit
                            </Button>
                            <Button
                                type="button"
                                className={alert.isActive ? "bg-gray-800 text-gray-100 hover:bg-gray-700" : "bg-green-500 text-black hover:bg-green-400"}
                                onClick={() => onToggleActive(alert, !alert.isActive)}
                            >
                                {alert.isActive ? (
                                    <span className="flex items-center gap-2"><Pause className="h-4 w-4" /> Pause</span>
                                ) : (
                                    <span className="flex items-center gap-2"><Play className="h-4 w-4" /> Resume</span>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                className="bg-red-600 text-white hover:bg-red-500"
                                onClick={() => onDelete(alert.id)}
                            >
                                <span className="flex items-center gap-2">
                                    <Trash2 className="h-4 w-4" /> Delete
                                </span>
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AlertsPanel;
