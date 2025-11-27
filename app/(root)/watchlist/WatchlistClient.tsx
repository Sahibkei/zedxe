"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AlertModal from "@/components/AlertModal";
import { toast } from "sonner";
import { formatMarketCapValue, formatPrice } from "@/lib/utils";

const formatConditionSymbol = (condition: AlertCondition) => {
    switch (condition) {
    case 'greater_than':
        return '>';
    case 'less_than':
        return '<';
    case 'greater_or_equal':
        return '>=';
    case 'less_or_equal':
        return '<=';
    case 'crosses_above':
        return 'crosses above';
    case 'crosses_below':
        return 'crosses below';
    default:
        return '';
    }
};

const WatchlistClient = ({ initialWatchlist, initialAlerts }: { initialWatchlist: WatchlistStockWithData[]; initialAlerts: AlertDisplay[] }) => {
    const [watchlist, setWatchlist] = useState<WatchlistStockWithData[]>(initialWatchlist);
    const [alerts, setAlerts] = useState<AlertDisplay[]>(initialAlerts);
    const [openModal, setOpenModal] = useState(false);
    const [modalState, setModalState] = useState<AlertFormState | null>(null);
    const [loadingSymbol, setLoadingSymbol] = useState<string | null>(null);
    const [alertPendingId, setAlertPendingId] = useState<string | null>(null);
    const [alertToggleId, setAlertToggleId] = useState<string | null>(null);

    const mapApiAlert = (alert: Partial<AlertDisplay> & { _id?: string; userId?: string }): AlertDisplay => ({
        id: String(alert._id || alert.id),
        userId: alert.userId ? String(alert.userId) : '',
        symbol: alert.symbol || '',
        name: alert.name,
        condition: alert.condition as AlertCondition,
        thresholdValue: Number(alert.thresholdValue),
        frequency: (alert.frequency as AlertFrequency) || 'once_per_day',
        isActive: Boolean(alert.isActive),
        lastTriggeredAt: alert.lastTriggeredAt || null,
    });

    const refreshAlerts = async (): Promise<AlertDisplay[] | undefined> => {
        try {
            const res = await fetch('/api/alerts', { credentials: 'include' });
            if (!res.ok) return;
            const json = await res.json();
            if (Array.isArray(json.data)) {
                const mapped = json.data.map(mapApiAlert);
                setAlerts(mapped);
                return mapped;
            }
        } catch (err) {
            console.error('refreshAlerts error', err);
        }
    };

    const symbolAlertMap = useMemo(() => {
        return alerts.reduce<Record<string, AlertDisplay[]>>((acc, alert) => {
            acc[alert.symbol] = acc[alert.symbol] ? [...acc[alert.symbol], alert] : [alert];
            return acc;
        }, {});
    }, [alerts]);

    const openAlertModal = (symbol: string, company: string) => {
        const existing = symbolAlertMap[symbol]?.[0];
        setModalState({
            alertId: existing?.id,
            symbol,
            company,
            name: existing?.name || `${symbol} price alert`,
            condition: existing?.condition || 'greater_than',
            thresholdValue: existing?.thresholdValue ?? '',
            frequency: existing?.frequency || 'once_per_day',
        });
        setOpenModal(true);
    };

    const handleRemove = async (symbol: string) => {
        setLoadingSymbol(symbol);
        try {
            const res = await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to remove');
            setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
            setAlerts((prev) => prev.filter((alert) => alert.symbol !== symbol));
            await refreshAlerts();
            toast.success(`${symbol} removed`);
        } catch (err) {
            console.error('Remove watchlist item error', err);
            toast.error('Unable to remove from watchlist');
        } finally {
            setLoadingSymbol(null);
        }
    };

    const handleSaveAlert = (alert: AlertDisplay) => {
        setAlerts((prev) => {
            const without = prev.filter((a) => a.id !== alert.id && a.symbol !== alert.symbol);
            return [...without, alert];
        });
        setWatchlist((prev) => prev.map((item) => (item.symbol === alert.symbol ? { ...item, hasAlert: true } : item)));
    };

    const handleDeleteAlert = async (alertId: string, symbol: string) => {
        const prevAlerts = alerts;
        setAlertPendingId(alertId);
        setAlerts((prev) => prev.filter((a) => a.id !== alertId));
        try {
            const res = await fetch(`/api/alerts/${alertId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to delete alert');
            toast.success('Alert removed');
            const latest = await refreshAlerts();
            const symbolHasAlert = (latest || prevAlerts).some((a) => a.id !== alertId && a.symbol === symbol);
            setWatchlist((prev) => prev.map((item) => (item.symbol === symbol ? { ...item, hasAlert: symbolHasAlert } : item)));
        } catch (err) {
            console.error('Delete alert error', err);
            setAlerts(prevAlerts);
            toast.error('Unable to delete alert');
        } finally {
            setAlertPendingId(null);
        }
    };

    const handleToggle = async (alert: AlertDisplay, isActive: boolean) => {
        setAlertToggleId(alert.id);
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, isActive } : a)));
        try {
            const res = await fetch(`/api/alerts/${alert.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ isActive }),
            });
            if (!res.ok) throw new Error('Failed to toggle');
            await refreshAlerts();
            toast.success(`Alert ${isActive ? 'enabled' : 'disabled'}`);
        } catch (err) {
            console.error('Toggle alert error', err);
            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, isActive: !isActive } : a)));
            toast.error('Unable to update alert status');
        } finally {
            setAlertToggleId(null);
        }
    };

    const alertsList = [...alerts].sort((a, b) => a.symbol.localeCompare(b.symbol));

    return (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            <section className="xl:col-span-3 bg-[#0f0f0f] border border-gray-800 rounded-lg p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold text-gray-100">Watchlist</h1>
                        <p className="text-gray-400 text-sm">Manage the symbols you care about and attach alerts.</p>
                    </div>
                    <div className="text-sm text-gray-400">{watchlist.length} symbols</div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead>
                        <tr className="text-gray-400 border-b border-gray-800">
                            <th className="py-3 pr-4">Company</th>
                            <th className="py-3 pr-4">Symbol</th>
                            <th className="py-3 pr-4">Last Price</th>
                            <th className="py-3 pr-4">Change %</th>
                            <th className="py-3 pr-4">Market Cap</th>
                            <th className="py-3 pr-4">Alert?</th>
                            <th className="py-3 pr-4 text-center">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {watchlist.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="py-6 text-center text-gray-500">No symbols yet.</td>
                            </tr>
                        ) : (
                            watchlist.map((item) => {
                                const changeColor = item.changePercent && item.changePercent > 0 ? 'text-green-400' : item.changePercent && item.changePercent < 0 ? 'text-red-400' : 'text-gray-300';
                                const alertForSymbol = symbolAlertMap[item.symbol]?.[0];
                                return (
                                    <tr key={item.id} className="border-b border-gray-900 hover:bg-black/30">
                                        <td className="py-3 pr-4 text-gray-100">{item.company}</td>
                                        <td className="py-3 pr-4">
                                            <Link
                                                href={`/stocks/${item.symbol}`}
                                                className="text-gray-300 hover:text-yellow-400 transition-colors underline-offset-4 hover:underline"
                                            >
                                                {item.symbol}
                                            </Link>
                                        </td>
                                        <td className="py-3 pr-4 text-gray-100">{item.currentPrice ? formatPrice(item.currentPrice) : '—'}</td>
                                        <td className={`py-3 pr-4 ${changeColor}`}>
                                            {item.changePercent ? `${item.changePercent.toFixed(2)}%` : '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-gray-100">{item.marketCap ? formatMarketCapValue(item.marketCap) : '—'}</td>
                                        <td className="py-3 pr-4 text-gray-100">{alertForSymbol ? 'Yes' : 'No'}</td>
                                        <td className="py-3 pr-4">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    className="bg-[#111] border border-gray-700 text-gray-100 hover:bg-gray-900"
                                                >
                                                    <Link href={`/stocks/${item.symbol}`}>View</Link>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-yellow-500 text-black hover:bg-yellow-400"
                                                    onClick={() => openAlertModal(item.symbol, item.company)}
                                                >
                                                    {alertForSymbol ? 'Edit Alert' : 'Add Alert'}
                                                </Button>
                                                {alertForSymbol ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="border-gray-800 text-red-300 hover:text-red-200 hover:border-red-500"
                                                        onClick={() => handleDeleteAlert(alertForSymbol.id, item.symbol)}
                                                        disabled={alertPendingId === alertForSymbol.id}
                                                    >
                                                        {alertPendingId === alertForSymbol.id ? 'Removing...' : 'Remove Alert'}
                                                    </Button>
                                                ) : null}
                                                <Button
                                                    size="sm"
                                                    className="bg-yellow-500 text-black hover:bg-yellow-400"
                                                    onClick={() => handleRemove(item.symbol)}
                                                    disabled={loadingSymbol === item.symbol}
                                                >
                                                    {loadingSymbol === item.symbol ? 'Removing...' : 'Remove from Watchlist'}
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                        </tbody>
                    </table>
                </div>
            </section>

            <aside className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-5 shadow-lg">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl text-gray-100 font-semibold">Alerts</h2>
                        <p className="text-xs text-gray-400">Enable, disable or edit your triggers.</p>
                    </div>
                    <span className="text-sm text-gray-400">{alertsList.length} active</span>
                </div>
                <div className="space-y-3">
                    {alertsList.length === 0 ? (
                        <p className="text-gray-500 text-sm">No alerts yet. Add one from your watchlist.</p>
                    ) : (
                        alertsList.map((alert) => (
                            <div key={alert.id} className="border border-gray-800 rounded-md p-3 bg-black/30">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-gray-100 font-medium">{alert.symbol}</div>
                                        <div className="text-xs text-gray-400">
                                            {formatConditionSymbol(alert.condition)} {formatPrice(alert.thresholdValue)} • {alert.frequency.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className={`border-gray-700 bg-[#111] text-xs px-3 ${alert.isActive ? 'text-yellow-300' : 'text-gray-400'}`}
                                            onClick={() => handleToggle(alert, !alert.isActive)}
                                            disabled={alertToggleId === alert.id}
                                        >
                                            {alertToggleId === alert.id ? 'Saving...' : alert.isActive ? 'On' : 'Off'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-gray-700 bg-[#111] text-gray-100 hover:bg-gray-900 text-xs"
                                            onClick={() => openAlertModal(alert.symbol, alert.symbol)}
                                        >
                                            Edit
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-gray-800 text-red-300 hover:text-red-200 hover:border-red-500 text-xs"
                                            onClick={() => handleDeleteAlert(alert.id, alert.symbol)}
                                            disabled={alertPendingId === alert.id}
                                        >
                                            {alertPendingId === alert.id ? 'Removing...' : 'Remove'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </aside>

            {modalState && (
                <AlertModal
                    open={openModal}
                    onClose={() => setOpenModal(false)}
                    initialState={modalState}
                    onSave={handleSaveAlert}
                />
            )}
        </div>
    );
};

export default WatchlistClient;
