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
            const res = await fetch(`/api/watchlist/${symbol}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to remove');
            setWatchlist((prev) => prev.filter((item) => item.symbol !== symbol));
            setAlerts((prev) => prev.filter((alert) => alert.symbol !== symbol));
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

    const handleToggle = async (alert: AlertDisplay, isActive: boolean) => {
        setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, isActive } : a)));
        try {
            const res = await fetch(`/api/alerts/${alert.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
            });
            if (!res.ok) throw new Error('Failed to toggle');
            toast.success(`Alert ${isActive ? 'enabled' : 'disabled'}`);
        } catch (err) {
            console.error('Toggle alert error', err);
            setAlerts((prev) => prev.map((a) => (a.id === alert.id ? { ...a, isActive: !isActive } : a)));
            toast.error('Unable to update alert status');
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
                            <th className="py-3 pr-4 text-right">Actions</th>
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
                                        <td className="py-3 pr-4 text-gray-300">{item.symbol}</td>
                                        <td className="py-3 pr-4 text-gray-100">{item.currentPrice ? formatPrice(item.currentPrice) : '—'}</td>
                                        <td className={`py-3 pr-4 ${changeColor}`}>
                                            {item.changePercent ? `${item.changePercent.toFixed(2)}%` : '—'}
                                        </td>
                                        <td className="py-3 pr-4 text-gray-100">{item.marketCap ? formatMarketCapValue(item.marketCap) : '—'}</td>
                                        <td className="py-3 pr-4 text-gray-100">{alertForSymbol ? 'Yes' : 'No'}</td>
                                        <td className="py-3 pr-4 text-right flex flex-wrap gap-2 justify-end">
                                            <Link href={`/stocks/${item.symbol}`} className="text-yellow-400 text-sm hover:text-yellow-300">View</Link>
                                            <button
                                                className="text-sm text-red-400 hover:text-red-300"
                                                onClick={() => handleRemove(item.symbol)}
                                                disabled={loadingSymbol === item.symbol}
                                            >
                                                {loadingSymbol === item.symbol ? 'Removing...' : 'Remove'}
                                            </button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="border-gray-700 text-gray-100"
                                                onClick={() => openAlertModal(item.symbol, item.company)}
                                            >
                                                {alertForSymbol ? 'Edit Alert' : 'Add Alert'}
                                            </Button>
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
                                        <label className="flex items-center gap-2 text-xs text-gray-400">
                                            <input
                                                type="checkbox"
                                                checked={alert.isActive}
                                                onChange={(e) => handleToggle(alert, e.target.checked)}
                                                className="accent-yellow-400"
                                            />
                                            {alert.isActive ? 'On' : 'Off'}
                                        </label>
                                        <button className="text-yellow-400 text-xs" onClick={() => openAlertModal(alert.symbol, alert.symbol)}>
                                            Edit
                                        </button>
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
