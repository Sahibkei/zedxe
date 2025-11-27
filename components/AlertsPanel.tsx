"use client";

import Link from "next/link";
import { AlertTriangle, Bell, Clock3, TrendingUp } from "lucide-react";

const conditionCopy: Record<AlertCondition, string> = {
    greater_than: "Price above",
    less_than: "Price below",
    crosses_above: "Crosses above",
    crosses_below: "Crosses below",
};

const frequencyCopy: Record<AlertFrequency, string> = {
    once: "Notify once",
    once_per_day: "Once per day",
    once_per_hour: "Hourly",
};

const AlertsPanel = ({ alerts }: { alerts: AlertDisplay[] }) => {
    const activeAlerts = (alerts || []).filter((alert) => alert.isActive);

    return (
        <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-semibold text-white">Alerts</h3>
                    <p className="text-sm text-gray-400">Stay on top of key price moves.</p>
                </div>
                <Link
                    href="/search"
                    className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                    <Bell className="h-4 w-4" />
                    Create Alert
                </Link>
            </div>

            {activeAlerts.length === 0 ? (
                <div className="mt-6 rounded-xl border border-white/5 bg-white/5 p-5 text-sm text-gray-300">
                    No active alerts yet. Create one to get notified when your stocks move.
                </div>
            ) : (
                <div className="mt-5 space-y-3">
                    {activeAlerts.map((alert) => (
                        <div
                            key={alert.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-[#0d0f14] p-4"
                        >
                            <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-gray-200">
                                    <TrendingUp className="h-5 w-5" />
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-white">{alert.symbol}</span>
                                        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-300">
                                            Active
                                        </span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-200">{alert.alertName || `${alert.symbol} alert`}</div>
                                    <div className="text-xs text-gray-400">
                                        {conditionCopy[alert.condition]} ${alert.thresholdValue.toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col items-end gap-2 text-xs text-gray-400">
                                <div className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 font-medium text-white">
                                    <Clock3 className="h-3.5 w-3.5" />
                                    {frequencyCopy[alert.frequency]}
                                </div>
                                {alert.lastTriggeredAt ? (
                                    <div className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-gray-500">
                                        <AlertTriangle className="h-3 w-3" />
                                        Last triggered {new Date(alert.lastTriggeredAt).toLocaleDateString()}
                                    </div>
                                ) : (
                                    <div className="text-[11px] uppercase tracking-wide text-gray-500">Not triggered yet</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default AlertsPanel;
