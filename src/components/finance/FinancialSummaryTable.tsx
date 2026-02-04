import { formatCompactFinancialValue } from "@/utils/formatters";
import type { StockFinancialRow } from "@/lib/stocks/stockProfileV2.types";

const formatFinancialValue = (value?: number, currency?: string) => {
    return formatCompactFinancialValue(value, currency);
};

export default function FinancialSummaryTable({
    rows,
    title,
    fallbackCurrency,
}: {
    rows: StockFinancialRow[];
    title: string;
    fallbackCurrency?: string;
}) {
    if (!rows || rows.length === 0) {
        return <p className="text-sm text-slate-400">No data available.</p>;
    }

    return (
        <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="min-w-[760px] w-full text-sm text-slate-200">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-slate-400">
                    <tr>
                        <th className="px-3 py-2">{title}</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                        <th className="px-3 py-2 text-right">Gross Profit</th>
                        <th className="px-3 py-2 text-right">Operating Income</th>
                        <th className="px-3 py-2 text-right">Net Income</th>
                        <th className="px-3 py-2 text-right">EPS</th>
                        <th className="px-3 py-2 text-right">Operating CF</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={`${title}-${row.label}`} className="border-t border-white/10">
                            <td className="px-3 py-2 font-medium text-slate-100">{row.label}</td>
                            <td className="px-3 py-2 text-right">
                                {formatFinancialValue(row.revenue, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {formatFinancialValue(row.grossProfit, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {formatFinancialValue(row.operatingIncome, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {formatFinancialValue(row.netIncome, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {formatFinancialValue(row.eps, row.currency ?? fallbackCurrency)}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {formatFinancialValue(row.operatingCashFlow, row.currency ?? fallbackCurrency)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
