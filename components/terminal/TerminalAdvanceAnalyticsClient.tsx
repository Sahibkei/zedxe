'use client';

import Image from 'next/image';
import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { EChartsOption } from 'echarts';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    ReferenceLine,
} from 'recharts';
import { Activity, ArrowUpRight, Building2, Download, FileBarChart2, FileText, Gauge, Layers3, Network, Newspaper } from 'lucide-react';
import EChart from '@/components/charts/EChart';
import ChartBuilder from '@/components/stock-profile/ChartBuilder';
import FinancialsTable, { collectExpandableIds, flattenRows } from '@/components/stock-profile/FinancialsTable';
import {
    calculateCagr,
    formatCurrency,
    formatCurrencyShort,
    formatInteger,
    formatPercent,
    formatRatio,
    formatSignedPercent,
    isFiniteNumber,
} from '@/components/stock-profile/formatters';
import TerminalAssetMetricsPanel from '@/components/terminal/TerminalAssetMetricsPanel';
import TerminalTradingViewAdvancedChart from '@/components/terminal/TerminalTradingViewAdvancedChart';
import type { FinnhubFinancialReport, FinnhubReportedItem } from '@/lib/stocks/providers/finnhub';
import type { StatementGrid, StatementRow, StockProfileV2Model } from '@/lib/stocks/stockProfileV2.types';
import { cn } from '@/lib/utils';

type AnalyticsTabKey = 'overview' | 'financials' | 'technical' | 'tracker' | 'news' | 'investor-relations';
type PeriodMode = 'annual' | 'quarterly';
type StatementKey = 'income' | 'balanceSheet' | 'cashFlow';

type HistoryPoint = {
    t: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number | null;
};

type HistoryResponse = {
    updatedAt: string;
    source: 'yahoo';
    symbol: string;
    name: string;
    currency: string | null;
    range: string;
    points: HistoryPoint[];
};

type ClientProps = {
    profile: StockProfileV2Model;
    newsItems: MarketNewsArticle[];
};

type MetricSection = {
    title: string;
    rows: Array<{ label: string; value: string }>;
};

type FlowTone = 'up' | 'down' | 'neutral';
type AppTheme = 'dark' | 'light';

type SankeyNodeDatum = {
    name: string;
    value: number;
    displayValue?: number;
    tone: FlowTone;
    depth: number;
};

type SankeyLinkDatum = {
    source: string;
    target: string;
    value: number;
    tone: FlowTone;
};

type SankeyChartData = {
    nodes: SankeyNodeDatum[];
    links: SankeyLinkDatum[];
};

type StatementGroupTemplate = {
    id: string;
    label: string;
    matchers: string[];
};

const DEFAULT_HISTORY_RANGE = '1Y';
const MAX_SERIES = 8;

const ANALYTICS_TABS: Array<{ key: AnalyticsTabKey; label: string; icon: typeof Layers3 }> = [
    { key: 'overview', label: 'Dashboard', icon: Layers3 },
    { key: 'financials', label: 'Financials', icon: FileBarChart2 },
    { key: 'technical', label: 'Technical Analysis', icon: Gauge },
    { key: 'tracker', label: 'Tracker', icon: Network },
    { key: 'news', label: 'News', icon: Newspaper },
    { key: 'investor-relations', label: 'Investor Relations', icon: FileText },
];

const HISTORY_RANGES = [
    { key: '1D', label: '1D' },
    { key: '1M', label: '1M' },
    { key: '3M', label: '3M' },
    { key: 'YTD', label: 'YTD' },
    { key: '1Y', label: '1Y' },
    { key: '5Y', label: '5Y' },
] as const;

const STATEMENT_TABS: Array<{ key: StatementKey; label: string }> = [
    { key: 'income', label: 'Income Statement' },
    { key: 'balanceSheet', label: 'Balance Sheet' },
    { key: 'cashFlow', label: 'Cash Flow' },
];

const tabSet = new Set(ANALYTICS_TABS.map((tab) => tab.key));

const tooltipStyle = {
    background: 'var(--terminal-panel)',
    border: '1px solid var(--terminal-border)',
    borderRadius: 10,
    color: 'var(--terminal-text)',
};

const parseTab = (value: string | null): AnalyticsTabKey =>
    value && tabSet.has(value as AnalyticsTabKey) ? (value as AnalyticsTabKey) : 'overview';

const relativeTime = (unixSeconds?: number) => {
    if (!unixSeconds) return 'Just now';
    const diff = Math.max(0, Date.now() - unixSeconds * 1000);
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

const formatStatementNumber = (value?: number, currency = 'USD') => {
    if (!isFiniteNumber(value)) return '--';
    return formatCurrencyShort(value, currency);
};

const formatDate = (value?: string) => {
    if (!value) return '--';
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return value;
    return new Date(parsed).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatChartDate = (unixSeconds: number) =>
    new Date(unixSeconds * 1000).toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
    });

const readThemeFromShell = () => {
    if (typeof document === 'undefined') return 'dark' as const;
    return document.querySelector('.terminal-shell')?.getAttribute('data-terminal-theme') === 'light' ? 'light' : 'dark';
};

const resolveTradingViewSymbol = (profile: StockProfileV2Model) => {
    const explicitSymbol = (profile.tvSymbol || '').trim().toUpperCase();
    if (explicitSymbol.includes(':')) return explicitSymbol;

    const ticker = (profile.finnhubSymbol || profile.symbolRaw || '').trim().toUpperCase();
    if (!ticker) return 'NASDAQ:NVDA';

    const exchange = (profile.company.exchange || '').trim().toUpperCase();
    if (exchange.includes('NASDAQ')) return `NASDAQ:${ticker}`;
    if (exchange === 'NYSE' || exchange.includes('NEW YORK STOCK EXCHANGE')) return `NYSE:${ticker}`;
    if (exchange.includes('NYSE ARCA') || exchange.includes('AMEX')) return `AMEX:${ticker}`;
    if (exchange.includes('CBOE')) return `CBOE:${ticker}`;
    if (exchange.includes('LSE')) return `LSE:${ticker}`;
    if (exchange.includes('TSX')) return `TSX:${ticker}`;

    return explicitSymbol || `NASDAQ:${ticker}`;
};

const findRowById = (rows: StatementRow[], targetId: string): StatementRow | undefined => {
    for (const row of rows) {
        if (row.id === targetId) return row;
        if (row.children?.length) {
            const nested = findRowById(row.children, targetId);
            if (nested) return nested;
        }
    }
    return undefined;
};

const readStatementValue = (grid: StatementGrid | undefined, rowId: string, columnKey?: string) => {
    if (!grid?.rows?.length) return undefined;
    const resolvedKey = columnKey ?? grid.columns[grid.columns.length - 1]?.key;
    if (!resolvedKey) return undefined;
    return findRowById(grid.rows, rowId)?.valuesByColumnKey[resolvedKey];
};

const hasRowNumbers = (row: StatementRow, columnKeys: string[]) => {
    let numericCount = 0;
    for (const key of columnKeys) {
        const value = row.valuesByColumnKey[key];
        if (typeof value === 'number' && Number.isFinite(value)) {
            numericCount += 1;
            if (numericCount >= 2) return true;
        }
    }
    return false;
};

const escapeCsvCell = (value: string) => {
    const normalized = value.replace(/"/g, '""');
    return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
};

const STATEMENT_GROUP_TEMPLATES: Record<StatementKey, StatementGroupTemplate[]> = {
    income: [
        { id: 'income-core', label: 'Revenue & Gross Profit', matchers: ['revenue', 'net sales', 'total revenues', 'cost of revenue', 'cost of sales', 'gross profit'] },
        { id: 'income-operations', label: 'Operating Income/Expenses', matchers: ['operating', 'research', 'selling general', 'selling, general', 'administrative', 'marketing'] },
        { id: 'income-non-operating', label: 'Non-Operating Income/Expense', matchers: ['interest', 'investment', 'other income', 'other expense', 'non operating', 'pretax', 'income before tax', 'income tax', 'net income', 'comprehensive income'] },
        { id: 'income-supplemental', label: 'Income Statement Supplemental', matchers: ['eps', 'share', 'dividend', 'stock compensation', 'stock-based', 'weighted average'] },
    ],
    balanceSheet: [
        { id: 'balance-current-assets', label: 'Current Assets', matchers: ['cash', 'receivable', 'inventory', 'prepaid', 'current assets', 'marketable', 'short term investment'] },
        { id: 'balance-noncurrent-assets', label: 'Non-Current Assets', matchers: ['property', 'equipment', 'goodwill', 'intangible', 'long-term investment', 'noncurrent assets', 'deferred tax assets', 'other assets'] },
        { id: 'balance-current-liabilities', label: 'Current Liabilities', matchers: ['accounts payable', 'accrued', 'current liabilities', 'short-term debt', 'deferred revenue', 'lease current'] },
        { id: 'balance-noncurrent-liabilities', label: 'Non-Current Liabilities', matchers: ['long-term debt', 'noncurrent liabilities', 'deferred tax liabilities', 'lease liability', 'other liabilities'] },
        { id: 'balance-equity', label: 'Equity', matchers: ['equity', 'retained earnings', 'common stock', 'stockholders', 'treasury stock', 'additional paid-in capital'] },
    ],
    cashFlow: [
        { id: 'cash-operating', label: 'Operating Cash Flow', matchers: ['operating activities', 'net income', 'depreciation', 'stock-based', 'working capital', 'receivable', 'inventory', 'payable', 'deferred tax'] },
        { id: 'cash-investing', label: 'Investing Cash Flow', matchers: ['investing activities', 'capital expenditure', 'property', 'acquisition', 'investment', 'purchase of'] },
        { id: 'cash-financing', label: 'Financing Cash Flow', matchers: ['financing activities', 'issuance of debt', 'repayment of debt', 'repurchase', 'dividend', 'equity'] },
        { id: 'cash-ending', label: 'End Cash Position', matchers: ['cash at end', 'cash at beginning', 'exchange rate', 'free cash flow', 'end cash'] },
    ],
};

const sortFinancialReports = (reports?: FinnhubFinancialReport[]) =>
    [...(reports || [])].sort((a, b) => {
        const aTime = a?.endDate ? new Date(a.endDate).getTime() : 0;
        const bTime = b?.endDate ? new Date(b.endDate).getTime() : 0;
        return bTime - aTime;
    });

const deriveQuarterFromDate = (value?: string) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    return Math.floor(date.getUTCMonth() / 3) + 1;
};

const formatFinancialPeriodLabel = (report: FinnhubFinancialReport, mode: PeriodMode) => {
    if (mode === 'quarterly') {
        const quarter = report.quarter || deriveQuarterFromDate(report.endDate);
        const year = report.year || (report.endDate ? new Date(report.endDate).getUTCFullYear() : undefined);
        return quarter && year ? `Q${quarter} ${year}` : formatDate(report.endDate);
    }

    const year = report.year || (report.endDate ? new Date(report.endDate).getUTCFullYear() : undefined);
    return year ? `FY ${year}` : formatDate(report.endDate);
};

const humanizeConceptName = (value?: string) => {
    if (!value) return 'Unnamed Metric';
    const raw = value.split('_').pop() || value;
    return raw
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/And/g, ' & ')
        .replace(/\s+/g, ' ')
        .trim();
};

const inferStatementValueType = (item: FinnhubReportedItem) => {
    const concept = `${item.concept || ''} ${item.label || ''}`.toLowerCase();
    const unit = (item.unit || '').toLowerCase();
    if (unit.includes('/share') || concept.includes('earnings per share') || concept.includes('eps')) return 'perShare' as const;
    if (unit.includes('share') || unit === 'shares') return 'count' as const;
    return 'currency' as const;
};

const matchesGroupMatcher = (haystack: string, matcher: string) => {
    const normalizedHaystack = haystack.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const normalizedMatcher = matcher.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!normalizedMatcher) return false;
    if (normalizedMatcher.includes(' ')) {
        return normalizedHaystack.includes(normalizedMatcher);
    }

    return normalizedHaystack.split(/\s+/).includes(normalizedMatcher);
};

const normalizeConceptKey = (concept?: string) => (concept || '').split('_').pop()?.toLowerCase() || '';

const canonicalStatementMetricKey = (statement: StatementKey, row: StatementRow) => {
    const normalizedConcept = normalizeConceptKey(row.concept);
    const normalizedLabel = row.label.trim().toLowerCase();

    if (statement === 'income') {
        if (['revenues', 'revenuefromcontractwithcustomerexcludingassessedtax'].includes(normalizedConcept)) return 'income-revenue';
        if (['costofrevenue', 'costofgoodsandservicessold'].includes(normalizedConcept)) return 'income-cost-of-revenue';
        if (normalizedConcept === 'grossprofit') return 'income-gross-profit';
        if (normalizedConcept === 'researchanddevelopmentexpense') return 'income-r-and-d';
        if (normalizedConcept === 'sellinggeneralandadministrativeexpense') return 'income-sga';
        if (normalizedConcept === 'operatingexpenses') return 'income-operating-expenses';
        if (normalizedConcept === 'operatingincomeloss') return 'income-operating-income';
        if (normalizedConcept === 'investmentincomeinterest') return 'income-interest-income';
        if (['interestexpense', 'interestexpensenonoperating'].includes(normalizedConcept)) return 'income-interest-expense';
        if (normalizedConcept === 'othernonoperatingincomeexpense') return 'income-other-income-net';
        if (normalizedConcept === 'nonoperatingincomeexpense') return 'income-total-other-income-net';
        if (
            normalizedConcept === 'incomelossfromcontinuingoperationsbeforeincometaxesextraordinaryitemsnoncontrollinginterest' ||
            normalizedConcept === 'incomelossfromcontinuingoperationsbeforeincometaxesminorityinterestandincomelossfromequitymethodinvestments'
        ) return 'income-before-tax';
        if (normalizedConcept === 'incometaxexpensebenefit') return 'income-tax-expense';
        if (normalizedConcept === 'netincomeloss') return 'income-net-income';
        if (normalizedConcept === 'earningspersharebasic') return 'income-eps-basic';
        if (normalizedConcept === 'earningspersharediluted') return 'income-eps-diluted';
        if (normalizedConcept === 'weightedaveragenumberofsharesoutstandingbasic') return 'income-shares-basic';
        if (normalizedConcept === 'weightedaveragenumberofdilutedsharesoutstanding') return 'income-shares-diluted';
    }

    return normalizedLabel.replace(/[^a-z0-9]+/g, '-');
};

const mergeDuplicateStatementRows = (rows: StatementRow[], statement: StatementKey): StatementRow[] => {
    const merged = new Map<string, StatementRow>();

    rows.forEach((row) => {
        const key = canonicalStatementMetricKey(statement, row);
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, {
                ...row,
                valuesByColumnKey: { ...row.valuesByColumnKey },
            });
            return;
        }

        Object.entries(row.valuesByColumnKey).forEach(([columnKey, value]) => {
            if (existing.valuesByColumnKey[columnKey] === undefined && value !== undefined) {
                existing.valuesByColumnKey[columnKey] = value;
            }
        });
    });

    return Array.from(merged.values());
};

const groupStatementRows = (rows: StatementRow[], statement: StatementKey): StatementRow[] => {
    const templates = STATEMENT_GROUP_TEMPLATES[statement];
    const buckets = templates.map((template) => ({ template, rows: [] as StatementRow[] }));
    const overflow: StatementRow[] = [];

    rows.forEach((row) => {
        const haystack = `${row.label} ${humanizeConceptName(row.concept)}`.toLowerCase();
        const bucket = buckets.find(({ template }) => template.matchers.some((matcher) => matchesGroupMatcher(haystack, matcher)));
        if (bucket) {
            bucket.rows.push(row);
            return;
        }
        overflow.push(row);
    });

    const grouped = buckets
        .filter((bucket) => bucket.rows.length > 0)
        .map(({ template, rows: childRows }) => ({
            id: template.id,
            label: template.label,
            valuesByColumnKey: {},
            children: childRows,
        } satisfies StatementRow));

    if (overflow.length > 0) {
        grouped.push({
            id: `${statement}-more`,
            label: 'More Reported Items',
            valuesByColumnKey: {},
            children: overflow,
        });
    }

    return grouped;
};

const filterStatementRows = (rows: StatementRow[], query: string): StatementRow[] => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.reduce<StatementRow[]>((acc, row) => {
        const childMatches = row.children?.length ? filterStatementRows(row.children, normalizedQuery) : [];
        const label = row.label.toLowerCase();
        const concept = (row.concept || '').toLowerCase();
        const selfMatches = label.includes(normalizedQuery) || concept.includes(normalizedQuery);

        if (selfMatches || childMatches.length > 0) {
            acc.push({
                ...row,
                children: childMatches.length > 0 ? childMatches : row.children,
            });
        }

        return acc;
    }, []);
};

const buildDetailedStatementGrid = (
    profile: StockProfileV2Model,
    statement: StatementKey,
    mode: PeriodMode
): StatementGrid | undefined => {
    const statementCode: 'ic' | 'bs' | 'cf' =
        statement === 'income' ? 'ic' : statement === 'balanceSheet' ? 'bs' : 'cf';

    const annualReports = sortFinancialReports(profile.financials.rawReports?.annual);
    const quarterlyReports = sortFinancialReports(profile.financials.rawReports?.quarterly);
    const sourceReports = (mode === 'quarterly' ? quarterlyReports : annualReports).filter(
        (report) => (report.report?.[statementCode] || []).length > 0
    );

    if (!sourceReports.length) {
        return mode === 'quarterly'
            ? profile.financials.statements?.quarterly?.[statement]
            : profile.financials.statements?.[statement];
    }

    const selectedReports = sourceReports.slice(0, 10);
    const columns: StatementGrid['columns'] = selectedReports.map((report, index) => ({
        key: `${mode}-${index}`,
        label: formatFinancialPeriodLabel(report, mode),
        date: report.endDate,
        type: 'annual',
        currency: report.currency,
    }));

    if (mode === 'annual' && quarterlyReports.length > 0) {
        columns.unshift({
            key: 'ttm',
            label: 'TTM',
            type: 'ttm',
            currency: quarterlyReports[0]?.currency || profile.company.currency,
        });
    }

    const conceptOrder: string[] = [];
    const conceptMeta = new Map<string, FinnhubReportedItem>();

    selectedReports.forEach((report) => {
        (report.report?.[statementCode] || []).forEach((item) => {
            const concept = item.concept || item.label;
            if (!concept || conceptMeta.has(concept)) return;
            conceptOrder.push(concept);
            conceptMeta.set(concept, item);
        });
    });

    const valueFromReport = (report: FinnhubFinancialReport, concept: string) => {
        const match = (report.report?.[statementCode] || []).find((item) => (item.concept || item.label) === concept);
        return typeof match?.value === 'number' ? match.value : undefined;
    };

    const detailRows: StatementRow[] = conceptOrder
        .map((concept) => {
            const meta = conceptMeta.get(concept);
            if (!meta) return null;

            const valuesByColumnKey: Record<string, number | undefined> = {};
            selectedReports.forEach((report, index) => {
                valuesByColumnKey[`${mode}-${index}`] = valueFromReport(report, concept);
            });

            if (mode === 'annual' && columns.some((column) => column.key === 'ttm')) {
                if (statementCode === 'bs') {
                    valuesByColumnKey.ttm = valueFromReport(quarterlyReports[0], concept);
                } else {
                    const ttmValues = quarterlyReports
                        .slice(0, 4)
                        .map((report) => valueFromReport(report, concept))
                        .filter((value): value is number => typeof value === 'number');
                    valuesByColumnKey.ttm = ttmValues.length ? ttmValues.reduce((sum, value) => sum + value, 0) : undefined;
                }
            }

            const hasAnyValue = Object.values(valuesByColumnKey).some((value) => typeof value === 'number' && Number.isFinite(value));
            if (!hasAnyValue) return null;

            return {
                id: `${statementCode}-${concept.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
                label: meta.label?.trim() || humanizeConceptName(meta.concept),
                concept,
                valueType: inferStatementValueType(meta),
                valuesByColumnKey,
            } satisfies StatementRow;
        })
        .filter((row): row is StatementRow => Boolean(row));

    return {
        columns,
        rows: groupStatementRows(mergeDuplicateStatementRows(detailRows, statement), statement),
        currency: selectedReports.find((report) => report.currency)?.currency || profile.company.currency || 'USD',
    };
};

const buildCsv = (grid: StatementGrid, fallbackCurrency?: string) => {
    void fallbackCurrency;
    const rows: string[] = [];
    rows.push(['Breakdown', ...grid.columns.map((column) => column.label)].map(escapeCsvCell).join(','));

    const visit = (items: StatementRow[], depth = 0) => {
        items.forEach((row) => {
            const label = `${'  '.repeat(depth)}${row.label}`;
            const values = grid.columns.map((column) => {
                const value = row.valuesByColumnKey[column.key];
                if (!isFiniteNumber(value)) return '';
                if (row.valueType === 'count') return `${Math.round(value)}`;
                if (row.valueType === 'perShare') return value.toFixed(2);
                return Number.isInteger(value) ? `${value}` : value.toFixed(2);
            });
            rows.push([label, ...values].map(escapeCsvCell).join(','));
            if (row.children?.length) visit(row.children, depth + 1);
        });
    };

    visit(grid.rows);
    return `\uFEFF${rows.join('\n')}`;
};

const downloadTextFile = (filename: string, content: string, type = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
};

const buildMetricSections = (profile: StockProfileV2Model): MetricSection[] => {
    const income = profile.financials.statements?.income;
    const cashFlow = profile.financials.statements?.cashFlow;
    const balanceSheet = profile.financials.statements?.balanceSheet;
    const currency = profile.company.currency || 'USD';

    const revenue = readStatementValue(income, 'revenue', 'ttm');
    const grossProfit = readStatementValue(income, 'gross-profit', 'ttm');
    const operatingIncome = readStatementValue(income, 'operating-income', 'ttm');
    const netIncome = readStatementValue(income, 'net-income', 'ttm');
    const operatingCashFlow = readStatementValue(cashFlow, 'operating-cash-flow', 'ttm');
    const capex = readStatementValue(cashFlow, 'capex', 'ttm');
    const totalAssets = readStatementValue(balanceSheet, 'total-assets');
    const cash = readStatementValue(balanceSheet, 'cash');
    const shortDebt = readStatementValue(balanceSheet, 'debt-current');
    const longDebt = readStatementValue(balanceSheet, 'debt-long');
    const totalEquity = readStatementValue(balanceSheet, 'total-equity');

    const annual = profile.financials.annual;
    const marketCap = profile.company.marketCap;
    const freeCashFlow = isFiniteNumber(operatingCashFlow) && isFiniteNumber(capex) ? operatingCashFlow + capex : undefined;
    const totalDebt =
        isFiniteNumber(shortDebt) || isFiniteNumber(longDebt) ? (shortDebt || 0) + (longDebt || 0) : undefined;
    const enterpriseValue =
        isFiniteNumber(marketCap) && isFiniteNumber(totalDebt) ? marketCap + totalDebt - (cash || 0) : undefined;
    const grossMargin =
        isFiniteNumber(revenue) && revenue !== 0 && isFiniteNumber(grossProfit) ? (grossProfit / revenue) * 100 : undefined;
    const operatingMargin =
        isFiniteNumber(revenue) && revenue !== 0 && isFiniteNumber(operatingIncome) ? (operatingIncome / revenue) * 100 : undefined;
    const netMargin =
        isFiniteNumber(revenue) && revenue !== 0 && isFiniteNumber(netIncome) ? (netIncome / revenue) * 100 : undefined;
    const fcfMargin =
        isFiniteNumber(revenue) && revenue !== 0 && isFiniteNumber(freeCashFlow) ? (freeCashFlow / revenue) * 100 : undefined;
    const returnOnAssets =
        isFiniteNumber(netIncome) && isFiniteNumber(totalAssets) && totalAssets !== 0 ? (netIncome / totalAssets) * 100 : undefined;
    const returnOnEquity =
        isFiniteNumber(netIncome) && isFiniteNumber(totalEquity) && totalEquity !== 0 ? (netIncome / totalEquity) * 100 : undefined;
    const rev3y = calculateCagr(annual[0]?.revenue, annual[3]?.revenue, 3);
    const rev5y = calculateCagr(annual[0]?.revenue, annual[5]?.revenue, 5);
    const rev10y = calculateCagr(annual[0]?.revenue, annual[9]?.revenue, 9);
    const eps3y = calculateCagr(annual[0]?.eps, annual[3]?.eps, 3);
    const eps5y = calculateCagr(annual[0]?.eps, annual[5]?.eps, 5);
    const eps10y = calculateCagr(annual[0]?.eps, annual[9]?.eps, 9);

    return [
        {
            title: 'Profile',
            rows: [
                { label: 'Market Cap', value: formatCurrencyShort(marketCap, currency) },
                { label: 'Enterprise Value', value: formatCurrencyShort(enterpriseValue, currency) },
                { label: 'Revenue (TTM)', value: formatCurrencyShort(revenue, currency) },
                { label: 'Shares Out', value: formatInteger(profile.company.shareOutstanding) },
                { label: 'Employees', value: formatInteger(profile.company.employees) },
            ],
        },
        {
            title: 'Valuation',
            rows: [
                { label: 'P/E', value: formatRatio(profile.metrics.pe) },
                { label: 'P/B', value: formatRatio(profile.metrics.pb) },
                { label: 'P/S', value: formatRatio(profile.metrics.ps) },
                { label: 'EV/EBITDA', value: formatRatio(profile.metrics.evToEbitda) },
                { label: 'Dividend Yield', value: formatPercent(profile.metrics.dividendYieldPercent) },
            ],
        },
        {
            title: 'Growth',
            rows: [
                { label: 'Revenue 3Y CAGR', value: formatPercent(rev3y) },
                { label: 'Revenue 5Y CAGR', value: formatPercent(rev5y) },
                { label: 'Revenue 10Y CAGR', value: formatPercent(rev10y) },
                { label: 'EPS 3Y CAGR', value: formatPercent(eps3y) },
                { label: 'EPS 5Y CAGR', value: formatPercent(eps5y) },
                { label: 'EPS 10Y CAGR', value: formatPercent(eps10y) },
            ],
        },
        {
            title: 'Margins',
            rows: [
                { label: 'Gross Margin', value: formatPercent(grossMargin) },
                { label: 'Operating Margin', value: formatPercent(operatingMargin) },
                { label: 'Net Margin', value: formatPercent(netMargin) },
                { label: 'FCF Margin', value: formatPercent(fcfMargin) },
            ],
        },
        {
            title: 'Financial Health',
            rows: [
                { label: 'Cash', value: formatCurrencyShort(cash, currency) },
                { label: 'Total Debt', value: formatCurrencyShort(totalDebt, currency) },
                { label: 'Debt / Equity', value: formatRatio(profile.metrics.debtToEquity) },
                { label: 'Current Ratio', value: formatRatio(profile.metrics.currentRatio) },
                { label: 'Free Cash Flow', value: formatCurrencyShort(freeCashFlow, currency) },
            ],
        },
        {
            title: 'Returns',
            rows: [
                { label: 'ROA', value: formatPercent(returnOnAssets) },
                { label: 'ROE', value: formatPercent(returnOnEquity) },
                { label: 'Country', value: profile.company.country || '--' },
                { label: 'Exchange', value: profile.company.exchange || '--' },
                { label: 'Industry', value: profile.company.industry || '--' },
            ],
        },
    ].map((section) => ({
        ...section,
        rows: section.rows.filter((row) => row.value && row.value !== '--'),
    }));
};

const buildBusinessDescription = (profile: StockProfileV2Model) => {
    const sourced = profile.company.companyDescription || profile.company.description;
    if (sourced?.trim()) return sourced.trim();

    const parts = [
        profile.company.name || profile.finnhubSymbol,
        profile.company.industry ? `operates in the ${profile.company.industry} industry` : null,
        profile.company.exchange ? `and trades on ${profile.company.exchange}` : null,
        profile.company.country ? `from ${profile.company.country}` : null,
    ].filter(Boolean);

    const financialBits = [
        profile.company.employees ? `${formatInteger(profile.company.employees)} employees` : null,
        profile.company.marketCap ? `a market capitalization of ${formatCurrencyShort(profile.company.marketCap, profile.company.currency || 'USD')}` : null,
        profile.company.ipo ? `an IPO date of ${formatDate(profile.company.ipo)}` : null,
    ].filter(Boolean);

    if (!parts.length && !financialBits.length) {
        return 'Business description is currently unavailable from upstream providers.';
    }

    const base = `${parts.join(' ')}.`.replace(/\s+\./g, '.');
    if (!financialBits.length) return base;
    return `${base} The company profile currently available in ZedXe includes ${financialBits.join(', ')}.`;
};

const OverviewTab = ({ profile, theme }: { profile: StockProfileV2Model; theme: 'dark' | 'light' }) => {
    const symbol = profile.finnhubSymbol;
    const [range, setRange] = useState<(typeof HISTORY_RANGES)[number]['key']>(DEFAULT_HISTORY_RANGE);
    const [payload, setPayload] = useState<HistoryResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const tradingViewSymbol = useMemo(() => resolveTradingViewSymbol(profile), [profile]);

    const chartInterval = useMemo(() => {
        const intervalMap: Record<(typeof HISTORY_RANGES)[number]['key'], string> = {
            '1D': '5',
            '1M': '60',
            '3M': 'D',
            YTD: 'D',
            '1Y': 'W',
            '5Y': 'M',
        };

        return intervalMap[range];
    }, [range]);

    useEffect(() => {
        let mounted = true;
        const controller = new AbortController();

        const load = async () => {
            setError(null);
            try {
                const response = await fetch(
                    `/api/market/history?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`,
                    { cache: 'no-store', signal: controller.signal }
                );
                const data = (await response.json()) as HistoryResponse;
                if (!mounted) return;
                setPayload(data);
            } catch (fetchError) {
                if (!mounted || controller.signal.aborted) return;
                setError(fetchError instanceof Error ? fetchError.message : 'Failed to load market history');
            }
        };

        void load();
        return () => {
            mounted = false;
            controller.abort();
        };
    }, [range, symbol]);

    const points = useMemo(
        () =>
            (payload?.points ?? []).filter((point) =>
                [point.o, point.h, point.l, point.c].every((value) => Number.isFinite(value) && value > 0)
            ),
        [payload?.points]
    );

    const drawdownData = useMemo(
        () =>
            points.reduce(
                (acc, point) => {
                    const peak = Math.max(acc.peak, point.c);
                    return {
                        peak,
                        rows: [
                            ...acc.rows,
                            {
                                t: point.t,
                                drawdown: peak > 0 ? ((point.c / peak) - 1) * 100 : 0,
                            },
                        ],
                    };
                },
                { peak: 0, rows: [] as Array<{ t: number; drawdown: number }> }
            ).rows,
        [points]
    );

    const quarterlySeries = useMemo(
        () =>
            profile.financials.quarterly.slice(0, 6).reverse().map((item) => ({
                label: item.label,
                revenue: item.revenue ? item.revenue / 1_000_000_000 : null,
                netIncome: item.netIncome ? item.netIncome / 1_000_000_000 : null,
                margin:
                    isFiniteNumber(item.revenue) && item.revenue !== 0 && isFiniteNumber(item.netIncome)
                        ? (item.netIncome / item.revenue) * 100
                        : null,
            })),
        [profile.financials.quarterly]
    );

    const incomeGrid = profile.financials.statements?.income;
    const currency = profile.company.currency || 'USD';

    const revenueBridgeData = useMemo(
        () =>
            [
                { label: 'Revenue', value: readStatementValue(incomeGrid, 'revenue', 'ttm'), tone: 'up' as const },
                { label: 'COGS', value: -(readStatementValue(incomeGrid, 'cost-of-revenue', 'ttm') || 0), tone: 'down' as const },
                { label: 'Gross Profit', value: readStatementValue(incomeGrid, 'gross-profit', 'ttm'), tone: 'up' as const },
                { label: 'Op Expenses', value: -(readStatementValue(incomeGrid, 'operating-expenses', 'ttm') || 0), tone: 'down' as const },
                { label: 'Op Income', value: readStatementValue(incomeGrid, 'operating-income', 'ttm'), tone: 'up' as const },
                { label: 'Tax', value: -(readStatementValue(incomeGrid, 'tax-provision', 'ttm') || 0), tone: 'down' as const },
                { label: 'Net Income', value: readStatementValue(incomeGrid, 'net-income', 'ttm'), tone: 'up' as const },
            ].map((item) => ({
                ...item,
                displayValue: isFiniteNumber(item.value) ? item.value / 1_000_000_000 : null,
            })),
        [incomeGrid]
    );

    const earningsSeries = useMemo(
        () =>
            profile.financials.quarterly.slice(0, 8).reverse().map((item, index, all) => ({
                label: item.label,
                actual: item.eps ?? null,
                trend:
                    index >= 3
                        ? [all[index - 3]?.eps, all[index - 2]?.eps, all[index - 1]?.eps, item.eps]
                              .filter((value): value is number => typeof value === 'number')
                              .reduce((sum, value, _, arr) => sum + value / arr.length, 0)
                        : null,
            })),
        [profile.financials.quarterly]
    );

    const summaryStats = useMemo(() => {
        if (!points.length) return null;
        const latest = points[points.length - 1];
        const first = points[0];
        const high = points.reduce((value, point) => Math.max(value, point.h), points[0].h);
        const low = points.reduce((value, point) => Math.min(value, point.l), points[0].l);
        const returnPct = first.c !== 0 ? ((latest.c - first.c) / first.c) * 100 : null;
        return { latest: latest.c, high, low, returnPct, updatedAt: payload?.updatedAt };
    }, [payload?.updatedAt, points]);

    const metricSections = useMemo(() => buildMetricSections(profile), [profile]);
    const description = buildBusinessDescription(profile);

    return (
        <section className="space-y-4">
            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <div>
                        <p className="text-sm font-semibold">Price Dashboard</p>
                        <p className="text-xs terminal-muted">Multi-range price view for {profile.company.name || symbol}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1">
                            {HISTORY_RANGES.map((item) => (
                                <button key={item.key} type="button" onClick={() => setRange(item.key)} className={cn('terminal-mini-btn', range === item.key && 'terminal-mini-btn-active')}>
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-1">
                                <span className="terminal-series-chip">TradingView Pro Chart</span>
                                <span className="terminal-series-chip">Indicators enabled</span>
                            </div>
                        </div>
                    </header>

                    <div className="min-h-0 flex-1 p-3">
                        <div className="overflow-hidden rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                            <TerminalTradingViewAdvancedChart
                                symbol={tradingViewSymbol}
                                interval={chartInterval}
                                theme={theme}
                                className="h-[760px] w-full"
                            />
                        </div>
                        {error ? <div className="mt-3 text-sm terminal-down">{error}</div> : null}
                    </div>
                </article>

            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <div>
                        <p className="text-sm font-semibold">Company Statistics</p>
                        <p className="text-xs terminal-muted">Profile, valuation, growth, and balance-sheet context</p>
                    </div>
                    <span className="terminal-series-chip">{summaryStats?.updatedAt ? `Updated ${new Date(summaryStats.updatedAt).toLocaleTimeString()}` : 'Live profile'}</span>
                </header>

                <div className="min-h-0 flex-1 overflow-auto p-3">
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {metricSections.map((section) => (
                            <div key={section.title} className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                                <p className="text-sm font-semibold">{section.title}</p>
                                <div className="mt-3 space-y-2">
                                    {section.rows.map((row) => (
                                        <div key={`${section.title}-${row.label}`} className="flex items-center justify-between gap-3 border-b border-[var(--terminal-border)]/65 pb-2 text-sm last:border-b-0 last:pb-0">
                                            <span className="terminal-muted">{row.label}</span>
                                            <span className="text-right font-medium">{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </article>

            <div className="grid gap-4 xl:grid-cols-2">
                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Revenue Growth</p>
                            <p className="text-xs terminal-muted">Quarterly revenue, net income, and net margin</p>
                        </div>
                        <span className="terminal-series-chip">Last 6 quarters</span>
                    </header>
                    <div className="h-[320px] p-3">
                        {quarterlySeries.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={quarterlySeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--terminal-border)" strokeDasharray="3 3" />
                                    <XAxis dataKey="label" tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" />
                                    <YAxis yAxisId="money" tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" tickFormatter={(value) => `${value}B`} width={42} />
                                    <YAxis yAxisId="margin" orientation="right" tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" tickFormatter={(value) => `${Number(value).toFixed(0)}%`} width={44} />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        formatter={(value, name) => {
                                            if (name === 'margin') return [`${Number(value).toFixed(2)}%`, 'Net margin'];
                                            return [`${Number(value).toFixed(2)}B`, name === 'revenue' ? 'Revenue' : 'Net income'];
                                        }}
                                    />
                                    <Bar yAxisId="money" dataKey="revenue" fill="#4f8cff" radius={[4, 4, 0, 0]} />
                                    <Bar yAxisId="money" dataKey="netIncome" fill="#36c2d8" radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="margin" type="monotone" dataKey="margin" stroke="#ff9f43" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm terminal-muted">Quarterly financials unavailable.</div>
                        )}
                    </div>
                </article>

                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Revenue To Profit Bridge</p>
                            <p className="text-xs terminal-muted">TTM income statement conversion</p>
                        </div>
                        <span className="terminal-series-chip">TTM</span>
                    </header>
                    <div className="h-[320px] p-3">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={revenueBridgeData} margin={{ top: 10, right: 12, left: 0, bottom: 6 }}>
                                <CartesianGrid stroke="var(--terminal-border)" strokeDasharray="3 3" />
                                <XAxis dataKey="label" tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" interval={0} angle={-12} textAnchor="end" height={64} />
                                <YAxis tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" tickFormatter={(value) => `${Number(value).toFixed(0)}B`} width={48} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${Number(value).toFixed(2)}B`, 'Value']} />
                                <ReferenceLine y={0} stroke="var(--terminal-border-strong)" />
                                <Bar dataKey="displayValue" radius={[4, 4, 0, 0]}>
                                    {revenueBridgeData.map((entry) => (
                                        <Cell
                                            key={entry.label}
                                            fill={entry.tone === 'down' ? '#ff5a6f' : entry.label === 'Net Income' ? '#36c2d8' : '#4f8cff'}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </article>

                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Drawdown</p>
                            <p className="text-xs terminal-muted">Peak-to-trough loss over the selected market-history range</p>
                        </div>
                        <span className="terminal-series-chip">{range}</span>
                    </header>
                    <div className="h-[320px] p-3">
                        {drawdownData.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={drawdownData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--terminal-border)" strokeDasharray="3 3" />
                                    <XAxis dataKey="t" tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" tickFormatter={(value) => formatChartDate(Number(value))} minTickGap={24} />
                                    <YAxis tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" tickFormatter={(value) => `${Number(value).toFixed(0)}%`} width={48} />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        labelFormatter={(value) => new Date(Number(value) * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        formatter={(value) => [`${Number(value).toFixed(2)}%`, 'Drawdown']}
                                    />
                                    <ReferenceLine y={0} stroke="var(--terminal-border-strong)" />
                                    <Area type="monotone" dataKey="drawdown" stroke="#ff5a6f" fill="#ff5a6f" fillOpacity={0.2} strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm terminal-muted">Drawdown becomes available once market history loads.</div>
                        )}
                    </div>
                </article>

                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Earnings Trend</p>
                            <p className="text-xs terminal-muted">Quarterly EPS actuals with trailing trend proxy while estimate feeds are pending</p>
                        </div>
                        <span className="terminal-series-chip">Actual + trend</span>
                    </header>
                    <div className="h-[320px] p-3">
                        {earningsSeries.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={earningsSeries} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                                    <CartesianGrid stroke="var(--terminal-border)" strokeDasharray="3 3" />
                                    <XAxis dataKey="label" tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" />
                                    <YAxis tick={{ fill: 'var(--terminal-muted)', fontSize: 11 }} stroke="var(--terminal-border-strong)" width={44} />
                                    <Tooltip
                                        contentStyle={tooltipStyle}
                                        formatter={(value, name) => [Number(value).toFixed(2), name === 'actual' ? 'EPS actual' : 'Trailing trend']}
                                    />
                                    <Bar dataKey="actual" fill="#2ec4b6" radius={[4, 4, 0, 0]} />
                                    <Line type="monotone" dataKey="trend" stroke="#8cc8ff" strokeDasharray="4 4" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm terminal-muted">Quarterly EPS data unavailable.</div>
                        )}
                    </div>
                </article>
            </div>

            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <div>
                        <p className="text-sm font-semibold">Business Description</p>
                        <p className="text-xs terminal-muted">Provider-sourced company overview</p>
                    </div>
                    {summaryStats ? (
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="terminal-series-chip">{formatCurrency(summaryStats.latest, payload?.currency ?? currency)}</span>
                            <span className={cn('terminal-series-chip', isFiniteNumber(summaryStats.returnPct) && summaryStats.returnPct >= 0 ? 'terminal-up' : 'terminal-down')}>
                                {summaryStats.returnPct !== null ? formatSignedPercent(summaryStats.returnPct, 2) : '--'}
                            </span>
                            <span className="terminal-series-chip">High {formatCurrency(summaryStats.high, payload?.currency ?? currency)}</span>
                            <span className="terminal-series-chip">Low {formatCurrency(summaryStats.low, payload?.currency ?? currency)}</span>
                        </div>
                    ) : null}
                </header>
                <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="space-y-3">
                        <p className="text-sm leading-7 terminal-muted">
                            {description}
                        </p>
                    </div>
                    <div className="grid gap-3">
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-xs uppercase tracking-[0.12em] terminal-muted">Website</p>
                            {profile.company.website ? (
                                <a href={profile.company.website} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold hover:text-[var(--terminal-accent)]">
                                    Open site
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </a>
                            ) : (
                                <p className="mt-2 text-sm terminal-muted">Unavailable</p>
                            )}
                        </div>
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-xs uppercase tracking-[0.12em] terminal-muted">IPO Date</p>
                            <p className="mt-2 text-sm font-semibold">{formatDate(profile.company.ipo)}</p>
                        </div>
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-3">
                            <p className="text-xs uppercase tracking-[0.12em] terminal-muted">Currency</p>
                            <p className="mt-2 text-sm font-semibold">{profile.company.currency || 'USD'}</p>
                        </div>
                    </div>
                </div>
            </article>
        </section>
    );
};

const FinancialsTab = ({ profile, theme }: { profile: StockProfileV2Model; theme: 'dark' | 'light' }) => {
    const [statement, setStatement] = useState<StatementKey>('income');
    const [periodMode, setPeriodMode] = useState<PeriodMode>('annual');
    const [metricQuery, setMetricQuery] = useState('');
    const [expandedByPanel, setExpandedByPanel] = useState<Record<string, Set<string>>>({});
    const [selectedByStatement, setSelectedByStatement] = useState<Record<StatementKey, string[]>>({
        income: [],
        balanceSheet: [],
        cashFlow: [],
    });
    const [selectionMessage, setSelectionMessage] = useState<string | null>(null);
    const [chartTitleByStatement, setChartTitleByStatement] = useState<Record<StatementKey, string>>({
        income: '',
        balanceSheet: '',
        cashFlow: '',
    });
    const [seriesColorsByStatement, setSeriesColorsByStatement] = useState<Record<StatementKey, Record<string, string>>>({
        income: {},
        balanceSheet: {},
        cashFlow: {},
    });

    const annualStatements = profile.financials.statements;
    const quarterlyStatements = profile.financials.statements?.quarterly;
    const hasQuarterly = Boolean(quarterlyStatements?.[statement]?.columns?.length);
    const effectivePeriodMode: PeriodMode = periodMode === 'quarterly' && !hasQuarterly ? 'annual' : periodMode;
    const activeSummaryGrid = effectivePeriodMode === 'quarterly' ? quarterlyStatements?.[statement] : annualStatements?.[statement];
    const activeGrid = useMemo(
        () => buildDetailedStatementGrid(profile, statement, effectivePeriodMode) || activeSummaryGrid,
        [activeSummaryGrid, effectivePeriodMode, profile, statement]
    );
    const periodKey = `${statement}-${effectivePeriodMode}`;
    const expandedIds = expandedByPanel[periodKey] || (activeGrid?.rows?.length ? collectExpandableIds(activeGrid.rows) : new Set<string>());

    const toggleExpand = (rowId: string) => {
        setExpandedByPanel((prev) => {
            const baseIds = prev[periodKey]
                ? new Set(prev[periodKey])
                : activeGrid?.rows?.length
                    ? collectExpandableIds(activeGrid.rows)
                    : new Set<string>();

            if (baseIds.has(rowId)) baseIds.delete(rowId);
            else baseIds.add(rowId);

            return { ...prev, [periodKey]: baseIds };
        });
    };

    const flattenMap = useMemo(() => {
        const map = new Map<string, StatementRow>();
        if (!activeGrid?.rows?.length) return map;
        flattenRows(activeGrid.rows).forEach((row) => map.set(row.id, row));
        return map;
    }, [activeGrid]);

    const activeColumnKeys = useMemo(() => activeGrid?.columns.map((column) => column.key) || [], [activeGrid]);
    const currentSelectedIds = selectedByStatement[statement] || [];
    const validSelectedIds = currentSelectedIds.filter((id) => {
        const row = flattenMap.get(id);
        return row ? hasRowNumbers(row, activeColumnKeys) : false;
    });

    const selectedSeries = validSelectedIds
        .map((id) => flattenMap.get(id))
        .filter((row): row is StatementRow => Boolean(row))
        .map((row) => ({
            id: row.id,
            label: row.label,
            valueType: row.valueType,
            valuesByColumnKey: row.valuesByColumnKey,
        }));

    const activeStatementLabel = STATEMENT_TABS.find((tab) => tab.key === statement)?.label || 'Statement';
    const visiblePeriodCount = (activeGrid?.columns || []).filter((column) => column.type !== 'ttm').length;
    const periodLabel = effectivePeriodMode === 'annual' ? `FY (${visiblePeriodCount || 0}Y)` : `FQ (${visiblePeriodCount || 0}Q)`;
    const defaultChartTitle = `${profile.finnhubSymbol} - ${activeStatementLabel} - Selected Metrics`;
    const activeChartTitle = chartTitleByStatement[statement] || defaultChartTitle;
    const activeSeriesColors = seriesColorsByStatement[statement] || {};

    const ratioCards = (() => {
        const income = activeSummaryGrid;
        const revenueRow = income ? findRowById(income.rows, 'revenue') : undefined;
        const grossRow = income ? findRowById(income.rows, 'gross-profit') : undefined;
        const opRow = income ? findRowById(income.rows, 'operating-income') : undefined;
        const netRow = income ? findRowById(income.rows, 'net-income') : undefined;
        const lastColumn = income?.columns[income.columns.length - 1]?.key;

        const revenue = lastColumn && revenueRow ? revenueRow.valuesByColumnKey[lastColumn] : undefined;
        const gross = lastColumn && grossRow ? grossRow.valuesByColumnKey[lastColumn] : undefined;
        const opIncome = lastColumn && opRow ? opRow.valuesByColumnKey[lastColumn] : undefined;
        const netIncome = lastColumn && netRow ? netRow.valuesByColumnKey[lastColumn] : undefined;

        const grossMargin = isFiniteNumber(revenue) && revenue !== 0 && isFiniteNumber(gross) ? (gross / revenue) * 100 : undefined;
        const opMargin = isFiniteNumber(revenue) && revenue !== 0 && isFiniteNumber(opIncome) ? (opIncome / revenue) * 100 : undefined;
        const netMargin = isFiniteNumber(revenue) && revenue !== 0 && isFiniteNumber(netIncome) ? (netIncome / revenue) * 100 : undefined;

        return [
            { label: 'Rows Selected', value: `${selectedSeries.length}` },
            { label: 'Visible Rows', value: `${activeGrid?.rows.length || 0}` },
            { label: 'Gross Margin', value: formatPercent(grossMargin) },
            { label: 'Operating Margin', value: formatPercent(opMargin) },
            { label: 'Net Margin', value: formatPercent(netMargin) },
        ];
    })();

    const filteredGrid = useMemo(() => {
        if (!activeGrid) return activeGrid;
        const rows = filterStatementRows(activeGrid.rows, metricQuery);

        return {
            ...activeGrid,
            rows,
        } satisfies StatementGrid;
    }, [activeGrid, metricQuery]);

    const handleSeriesColorChange = (seriesId: string, color: string) => {
        setSeriesColorsByStatement((prev) => ({
            ...prev,
            [statement]: {
                ...(prev[statement] || {}),
                [seriesId]: color,
            },
        }));
    };

    const toggleRowSelect = (row: StatementRow) => {
        const selectable = hasRowNumbers(row, activeColumnKeys);
        if (!selectable) return;

        const current = selectedByStatement[statement] || [];
        const exists = current.includes(row.id);

        if (!exists && current.length >= MAX_SERIES) {
            setSelectionMessage(`You can chart up to ${MAX_SERIES} metrics at once.`);
            return;
        }

        setSelectionMessage(null);
        setSelectedByStatement((prev) => {
            const prevCurrent = prev[statement] || [];
            const prevExists = prevCurrent.includes(row.id);
            const next = prevExists ? prevCurrent.filter((id) => id !== row.id) : [...prevCurrent, row.id];
            return {
                ...prev,
                [statement]: next,
            };
        });
    };

    const exportActiveGrid = () => {
        if (!activeGrid) return;
        const csv = buildCsv(activeGrid, profile.company.currency);
        downloadTextFile(`${profile.finnhubSymbol.toLowerCase()}_${statement}_${effectivePeriodMode}.csv`, csv, 'text/csv;charset=utf-8');
    };

    return (
        <section className="space-y-4 terminal-analytics-theme-bridge">
            <div className="terminal-banner">
                <div>
                    <p className="terminal-banner-kicker">Financials</p>
                    <p className="text-sm terminal-muted">
                        Detailed reported statement explorer with row-based charting and export-ready visuals.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {ratioCards.map((card) => (
                        <span key={card.label} className="terminal-series-chip">
                            {card.label}: {card.value}
                        </span>
                    ))}
                </div>
            </div>

            {selectedSeries.length > 0 ? (
                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Statement Chart</p>
                            <p className="text-xs terminal-muted">Selected rows surface here first, then export from the builder controls below.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="terminal-series-chip">{activeStatementLabel}</span>
                            <span className="terminal-series-chip">{periodLabel}</span>
                            <span className="terminal-series-chip">{selectedSeries.length} metrics</span>
                        </div>
                    </header>
                    <ChartBuilder
                        columns={activeGrid?.columns || []}
                        series={selectedSeries}
                        currency={activeGrid?.currency || profile.company.currency || 'USD'}
                        symbol={profile.finnhubSymbol}
                        statementLabel={activeStatementLabel}
                        periodLabel={periodLabel}
                        theme={theme}
                        title={activeChartTitle}
                        onTitleChange={(title) =>
                            setChartTitleByStatement((prev) => ({
                                ...prev,
                                [statement]: title,
                            }))
                        }
                        seriesColors={activeSeriesColors}
                        onSeriesColorChange={handleSeriesColorChange}
                    />
                </article>
            ) : null}

            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <div>
                        <p className="text-sm font-semibold">Financial Statement Explorer</p>
                        <p className="text-xs terminal-muted">Full reported line items, searchable and chartable.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={exportActiveGrid} className="terminal-mini-btn">
                            <Download className="h-3.5 w-3.5" />
                            Export CSV
                        </button>
                        <span className="terminal-series-chip">{periodLabel}</span>
                    </div>
                </header>

                <div className="space-y-3 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-1">
                            {STATEMENT_TABS.map((tab) => (
                                <button key={tab.key} type="button" onClick={() => setStatement(tab.key)} className={cn('terminal-mini-btn', statement === tab.key && 'terminal-mini-btn-active')}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="inline-flex gap-1 rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-1">
                            <button type="button" onClick={() => setPeriodMode('annual')} className={cn('terminal-mini-btn', effectivePeriodMode === 'annual' && 'terminal-mini-btn-active')}>
                                Annual
                            </button>
                            <button type="button" onClick={() => hasQuarterly && setPeriodMode('quarterly')} disabled={!hasQuarterly} className={cn('terminal-mini-btn', effectivePeriodMode === 'quarterly' && 'terminal-mini-btn-active', !hasQuarterly && 'cursor-not-allowed opacity-50')}>
                                Quarterly
                            </button>
                        </div>

                        <div className="min-w-[260px] flex-1">
                            <input
                                type="text"
                                value={metricQuery}
                                onChange={(event) => setMetricQuery(event.target.value)}
                                placeholder="Search reported line items"
                                className="h-10 w-full rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 text-sm text-[var(--terminal-text)] outline-none transition focus:border-[var(--terminal-border-strong)]"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setExpandedByPanel((prev) => ({
                                    ...prev,
                                    [periodKey]: activeGrid?.rows?.length ? collectExpandableIds(activeGrid.rows) : new Set<string>(),
                                }))
                            }
                            className="terminal-mini-btn"
                        >
                            Expand all
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                setExpandedByPanel((prev) => ({
                                    ...prev,
                                    [periodKey]: new Set<string>(),
                                }))
                            }
                            className="terminal-mini-btn"
                        >
                            Collapse all
                        </button>
                    </div>

                    {selectionMessage ? (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                            {selectionMessage}
                        </div>
                    ) : null}

                    <FinancialsTable
                        grid={filteredGrid}
                        fallbackCurrency={profile.company.currency}
                        selectedIds={new Set(validSelectedIds)}
                        expandedIds={expandedIds}
                        onToggleExpand={toggleExpand}
                        onToggleSelect={toggleRowSelect}
                    />
                </div>
            </article>
        </section>
    );
};

const addSankeyNode = (nodes: SankeyNodeDatum[], node: Omit<SankeyNodeDatum, 'value'> & { value?: number }) => {
    const resolvedNode: SankeyNodeDatum = {
        name: node.name,
        value: Math.max(node.value ?? node.displayValue ?? 0, 0),
        displayValue: node.displayValue,
        tone: node.tone,
        depth: node.depth,
    };
    nodes.push(resolvedNode);
    return resolvedNode;
};

const addSankeyLink = (links: SankeyLinkDatum[], source: SankeyNodeDatum | null | undefined, target: SankeyNodeDatum | null | undefined, value: number | undefined, tone: FlowTone) => {
    if (!source || !target) return;
    if (!isFiniteNumber(value) || value <= 0) return;
    links.push({ source: source.name, target: target.name, value, tone });
};

const buildIncomeSankey = (incomeGrid: StatementGrid | undefined): SankeyChartData | null => {
    const revenue = readStatementValue(incomeGrid, 'revenue', 'ttm');
    const costOfRevenueRaw = readStatementValue(incomeGrid, 'cost-of-revenue', 'ttm');
    const grossProfitRaw = readStatementValue(incomeGrid, 'gross-profit', 'ttm');
    const operatingExpensesRaw = readStatementValue(incomeGrid, 'operating-expenses', 'ttm');
    const rnd = readStatementValue(incomeGrid, 'rnd', 'ttm');
    const sga = readStatementValue(incomeGrid, 'sga', 'ttm');
    const operatingIncomeRaw = readStatementValue(incomeGrid, 'operating-income', 'ttm');
    const pretaxIncomeRaw = readStatementValue(incomeGrid, 'pretax-income', 'ttm');
    const taxProvisionRaw = readStatementValue(incomeGrid, 'tax-provision', 'ttm');
    const netIncomeRaw = readStatementValue(incomeGrid, 'net-income', 'ttm');

    if (!isFiniteNumber(revenue) || !isFiniteNumber(netIncomeRaw)) {
        return null;
    }

    const grossProfit =
        isFiniteNumber(grossProfitRaw)
            ? grossProfitRaw
            : isFiniteNumber(costOfRevenueRaw)
              ? revenue - Math.abs(costOfRevenueRaw)
              : isFiniteNumber(operatingExpensesRaw) && isFiniteNumber(operatingIncomeRaw)
                ? operatingIncomeRaw + Math.abs(operatingExpensesRaw)
                : revenue;
    const operatingIncome =
        isFiniteNumber(operatingIncomeRaw)
            ? operatingIncomeRaw
            : isFiniteNumber(operatingExpensesRaw)
              ? grossProfit - Math.abs(operatingExpensesRaw)
              : grossProfit;
    const netIncome = netIncomeRaw;
    const costOfRevenue = Math.max(isFiniteNumber(costOfRevenueRaw) ? Math.abs(costOfRevenueRaw) : revenue - grossProfit, 0);
    const totalOperatingExpenses = Math.max(isFiniteNumber(operatingExpensesRaw) ? Math.abs(operatingExpensesRaw) : grossProfit - operatingIncome, 0);
    const rndExpense = Math.max(isFiniteNumber(rnd) ? Math.abs(rnd) : 0, 0);
    const sgaExpense = Math.max(isFiniteNumber(sga) ? Math.abs(sga) : 0, 0);
    const otherOperatingExpenses = Math.max(totalOperatingExpenses - rndExpense - sgaExpense, 0);
    const pretaxIncome = isFiniteNumber(pretaxIncomeRaw) ? Math.abs(pretaxIncomeRaw) : Math.max(netIncome + Math.max(taxProvisionRaw ?? 0, 0), 0);
    const taxProvision = Math.max(isFiniteNumber(taxProvisionRaw) ? Math.abs(taxProvisionRaw) : pretaxIncome - netIncome, 0);
    const nonOperatingCharges = Math.max(operatingIncome - pretaxIncome, 0);
    const nonOperatingIncome = Math.max(pretaxIncome - operatingIncome, 0);

    const nodes: SankeyNodeDatum[] = [];
    const links: SankeyLinkDatum[] = [];

    const revenueNode = addSankeyNode(nodes, { name: 'Revenue', displayValue: revenue, tone: 'up', depth: 0 });
    const grossNode = addSankeyNode(nodes, { name: 'Gross Profit', displayValue: grossProfit, tone: 'up', depth: 1 });
    const costNode = addSankeyNode(nodes, { name: 'Cost of Revenue', displayValue: costOfRevenue, tone: 'down', depth: 1 });
    const rndNode = rndExpense > 0 ? addSankeyNode(nodes, { name: 'R&D', displayValue: rndExpense, tone: 'down', depth: 2 }) : null;
    const sgaNode = sgaExpense > 0 ? addSankeyNode(nodes, { name: 'SG&A', displayValue: sgaExpense, tone: 'down', depth: 2 }) : null;
    const otherOpexNode = otherOperatingExpenses > 0 ? addSankeyNode(nodes, { name: 'Other OpEx', displayValue: otherOperatingExpenses, tone: 'down', depth: 2 }) : null;
    const opIncomeNode = addSankeyNode(nodes, { name: 'Operating Income', displayValue: operatingIncome, tone: 'up', depth: 2 });
    const nonOperatingIncomeNode = nonOperatingIncome > 0 ? addSankeyNode(nodes, { name: 'Other Income', displayValue: nonOperatingIncome, tone: 'neutral', depth: 2 }) : null;
    const nonOperatingChargesNode = nonOperatingCharges > 0 ? addSankeyNode(nodes, { name: 'Non-Op Charges', displayValue: nonOperatingCharges, tone: 'down', depth: 3 }) : null;
    const pretaxNode = addSankeyNode(nodes, { name: 'Pretax Income', displayValue: pretaxIncome, tone: 'up', depth: 3 });
    const taxesNode = taxProvision > 0 ? addSankeyNode(nodes, { name: 'Tax Provision', displayValue: taxProvision, tone: 'down', depth: 4 }) : null;
    const netIncomeNode = addSankeyNode(nodes, { name: 'Net Income', displayValue: netIncome, tone: 'up', depth: 4 });

    addSankeyLink(links, revenueNode, grossNode, grossProfit, 'up');
    addSankeyLink(links, revenueNode, costNode, costOfRevenue, 'down');
    addSankeyLink(links, grossNode, rndNode, rndExpense, 'down');
    addSankeyLink(links, grossNode, sgaNode, sgaExpense, 'down');
    addSankeyLink(links, grossNode, otherOpexNode, otherOperatingExpenses, 'down');
    addSankeyLink(links, grossNode, opIncomeNode, operatingIncome, 'up');
    addSankeyLink(links, opIncomeNode, nonOperatingChargesNode, nonOperatingCharges, 'down');
    addSankeyLink(links, opIncomeNode, pretaxNode, Math.max(operatingIncome - nonOperatingCharges, 0), 'up');
    addSankeyLink(links, nonOperatingIncomeNode, pretaxNode, nonOperatingIncome, 'neutral');
    addSankeyLink(links, pretaxNode, taxesNode, taxProvision, 'down');
    addSankeyLink(links, pretaxNode, netIncomeNode, netIncome, 'up');

    return links.length ? { nodes, links } : null;
};

const buildCashSankey = (incomeGrid: StatementGrid | undefined, cashGrid: StatementGrid | undefined, balanceGrid: StatementGrid | undefined): SankeyChartData | null => {
    const netIncome = readStatementValue(incomeGrid, 'net-income', 'ttm');
    const operatingCashFlow = readStatementValue(cashGrid, 'operating-cash-flow', 'ttm');
    const investingCashFlow = readStatementValue(cashGrid, 'investing-cash-flow', 'ttm');
    const financingCashFlow = readStatementValue(cashGrid, 'financing-cash-flow', 'ttm');
    const capexRaw = readStatementValue(cashGrid, 'capex', 'ttm');
    const depreciationRaw = readStatementValue(cashGrid, 'depreciation', 'ttm');
    const sbcRaw = readStatementValue(cashGrid, 'sbc', 'ttm');
    const endingCash = readStatementValue(balanceGrid, 'cash');

    if (!isFiniteNumber(operatingCashFlow) || !isFiniteNumber(endingCash)) {
        return null;
    }

    const capex = isFiniteNumber(capexRaw) ? Math.abs(capexRaw) : 0;
    const netIncomeAbs = isFiniteNumber(netIncome) ? Math.abs(netIncome) : 0;
    const depreciation = isFiniteNumber(depreciationRaw) ? Math.abs(depreciationRaw) : 0;
    const sbc = isFiniteNumber(sbcRaw) ? Math.abs(sbcRaw) : 0;
    const nonCashAdjustments = isFiniteNumber(netIncome) ? Math.max(operatingCashFlow - netIncomeAbs, 0) : 0;
    const otherAdjustments = Math.max(nonCashAdjustments - depreciation - sbc, 0);
    const otherInvesting = isFiniteNumber(investingCashFlow) ? Math.max(Math.abs(investingCashFlow) - capex, 0) : 0;
    const financingAbs = isFiniteNumber(financingCashFlow) ? Math.abs(financingCashFlow) : 0;
    const financingUses = financingCashFlow != null && financingCashFlow < 0 ? financingAbs : 0;
    const financingInflows = financingCashFlow != null && financingCashFlow > 0 ? financingAbs : 0;
    const freeCashFlow = Math.max(operatingCashFlow - capex, 0);
    const endingCashFromFlows = Math.max(freeCashFlow - otherInvesting - financingUses, 0);

    const nodes: SankeyNodeDatum[] = [];
    const links: SankeyLinkDatum[] = [];

    const netIncomeNode = netIncomeAbs > 0 ? addSankeyNode(nodes, { name: 'Net Income', displayValue: netIncome, value: netIncomeAbs, tone: netIncome != null && netIncome < 0 ? 'down' : 'up', depth: 0 }) : null;
    const depreciationNode = depreciation > 0 ? addSankeyNode(nodes, { name: 'D&A', displayValue: depreciation, tone: 'neutral', depth: 0 }) : null;
    const sbcNode = sbc > 0 ? addSankeyNode(nodes, { name: 'Stock Comp', displayValue: sbc, tone: 'neutral', depth: 0 }) : null;
    const otherAdjustmentsNode = otherAdjustments > 0 ? addSankeyNode(nodes, { name: 'Other Adj. & WC', displayValue: otherAdjustments, tone: 'neutral', depth: 0 }) : null;
    const ocfNode = addSankeyNode(nodes, { name: 'Operating Cash Flow', displayValue: operatingCashFlow, tone: 'up', depth: 1 });
    const capexNode = capex > 0 ? addSankeyNode(nodes, { name: 'Capex', displayValue: capex, tone: 'down', depth: 2 }) : null;
    const freeCashFlowNode = freeCashFlow > 0 ? addSankeyNode(nodes, { name: 'Free Cash Flow', displayValue: freeCashFlow, tone: 'up', depth: 2 }) : null;
    const investingNode = otherInvesting > 0 ? addSankeyNode(nodes, { name: 'Other Investing', displayValue: otherInvesting, tone: 'down', depth: 3 }) : null;
    const financingNode =
        financingAbs > 0
            ? addSankeyNode(nodes, {
                  name: financingInflows > 0 ? 'Financing Inflows' : 'Financing Outflows',
                  displayValue: financingAbs,
                  tone: financingInflows > 0 ? 'neutral' : 'down',
                  depth: financingInflows > 0 ? 2 : 3,
              })
            : null;
    const endingCashNode = addSankeyNode(nodes, { name: 'Ending Cash', displayValue: endingCash, tone: 'up', depth: 3 });

    if (netIncomeAbs > 0) {
        addSankeyLink(links, netIncomeNode, ocfNode, Math.min(netIncomeAbs, operatingCashFlow), netIncome != null && netIncome < 0 ? 'down' : 'up');
    }
    addSankeyLink(links, depreciationNode, ocfNode, depreciation, 'neutral');
    addSankeyLink(links, sbcNode, ocfNode, sbc, 'neutral');
    addSankeyLink(links, otherAdjustmentsNode, ocfNode, otherAdjustments, 'neutral');
    addSankeyLink(links, ocfNode, capexNode, capex, 'down');
    addSankeyLink(links, ocfNode, freeCashFlowNode, freeCashFlow, 'up');
    addSankeyLink(links, freeCashFlowNode, investingNode, otherInvesting, 'down');
    addSankeyLink(links, freeCashFlowNode, financingNode, financingUses, 'down');
    addSankeyLink(links, freeCashFlowNode, endingCashNode, Math.max(Math.min(endingCash, endingCashFromFlows), 0), 'up');
    addSankeyLink(links, financingNode, endingCashNode, financingInflows, 'neutral');

    return links.length ? { nodes, links } : null;
};

const sankeyNodeColor = (tone: FlowTone, theme: AppTheme) => {
    if (theme === 'light') {
        if (tone === 'up') return '#2a9d8f';
        if (tone === 'down') return '#e76f51';
        return '#8da9c4';
    }
    if (tone === 'up') return '#19c37d';
    if (tone === 'down') return '#ef5a5a';
    return '#7aa2f7';
};

const sankeyLinkColor = (tone: FlowTone, theme: AppTheme) => {
    if (theme === 'light') {
        if (tone === 'up') return 'rgba(42, 157, 143, 0.34)';
        if (tone === 'down') return 'rgba(231, 111, 81, 0.30)';
        return 'rgba(141, 169, 196, 0.34)';
    }
    if (tone === 'up') return 'rgba(25, 195, 125, 0.46)';
    if (tone === 'down') return 'rgba(239, 90, 90, 0.34)';
    return 'rgba(122, 162, 247, 0.34)';
};

const buildSankeyOption = (data: SankeyChartData, currency: string, theme: AppTheme): EChartsOption => {
    const axisText = theme === 'light' ? '#102238' : '#f5f7fb';
    const mutedText = theme === 'light' ? '#48617d' : '#b8c7df';
    const border = theme === 'light' ? 'rgba(15, 23, 42, 0.10)' : 'rgba(148, 163, 184, 0.12)';
    const panel = theme === 'light' ? '#f8fafc' : '#111a2a';
    const maxDepth = data.nodes.reduce((depth, node) => Math.max(depth, node.depth), 0);
    const levels = Array.from({ length: maxDepth + 1 }, (_, depth) => ({
        depth,
        itemStyle: { borderWidth: 0 },
        label: depth === maxDepth ? { position: 'left', color: axisText, align: 'right', distance: 10 } : { position: 'right', color: axisText, distance: 10 },
    }));

    return {
        backgroundColor: 'transparent',
        animationDuration: 700,
        animationEasing: 'cubicOut',
        tooltip: {
            trigger: 'item',
            backgroundColor: panel,
            borderColor: border,
            borderWidth: 1,
            textStyle: { color: axisText },
            formatter: (params: { dataType?: string; data?: { name?: string; value?: number; displayValue?: number; source?: string; target?: string }; name?: string; value?: number }) => {
                if (params.dataType === 'edge') {
                    return `${params.data?.source ?? ''} -> ${params.data?.target ?? ''}<br/>${formatStatementNumber(params.value, currency)}`;
                }
                return `${params.data?.name ?? params.name ?? ''}<br/>${formatStatementNumber(params.data?.displayValue ?? params.value, currency)}`;
            },
        },
        series: [
            {
                type: 'sankey',
                left: 34,
                right: 112,
                top: 18,
                bottom: 18,
                nodeAlign: 'justify',
                draggable: false,
                layoutIterations: 32,
                nodeGap: 18,
                nodeWidth: 14,
                emphasis: { focus: 'adjacency' },
                lineStyle: {
                    curveness: 0.42,
                    opacity: 0.86,
                },
                label: {
                    color: axisText,
                    fontSize: 12,
                    lineHeight: 16,
                    fontWeight: 700,
                    formatter: (params: { data: SankeyNodeDatum }) => `${params.data.name}\n${formatStatementNumber(params.data.displayValue ?? params.data.value, currency)}`,
                },
                levels,
                data: data.nodes.map((node) => ({
                    ...node,
                    itemStyle: {
                        color: sankeyNodeColor(node.tone, theme),
                        borderRadius: 2,
                    },
                    label: {
                        color: node.depth >= 3 ? axisText : axisText,
                    },
                })),
                links: data.links.map((link) => ({
                    ...link,
                    lineStyle: {
                        color: sankeyLinkColor(link.tone, theme),
                        opacity: 1,
                    },
                })),
            },
        ],
        graphic: [
            {
                type: 'text',
                left: 18,
                bottom: 8,
                silent: true,
                style: {
                    text: 'Hover flows to inspect values',
                    fill: mutedText,
                    fontSize: 11,
                    fontWeight: 500,
                },
            },
        ],
    };
};

const SankeyCard = ({
    title,
    subtitle,
    data,
    currency,
    theme,
    symbol,
}: {
    title: string;
    subtitle: string;
    data: SankeyChartData | null;
    currency: string;
    theme: AppTheme;
    symbol: string;
}) => {
    const exportRef = useRef<HTMLDivElement | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        if (!exportRef.current || isExporting) return;

        try {
            setIsExporting(true);
            const { toPng } = await import('html-to-image');
            const dataUrl = await toPng(exportRef.current, {
                pixelRatio: 2,
                cacheBust: true,
                backgroundColor: theme === 'light' ? '#f8fafc' : '#111a2a',
            });

            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = `${symbol.toLowerCase()}-${title.toLowerCase().replace(/\s+/g, '-')}.png`;
            link.click();
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <article className="terminal-widget">
            <header className="terminal-widget-head">
                <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="text-xs terminal-muted">{subtitle}</p>
                </div>
                {data ? (
                    <button type="button" onClick={handleExport} disabled={isExporting} className="terminal-mini-btn">
                        <Download className="h-3.5 w-3.5" />
                        {isExporting ? 'Exporting...' : 'Export PNG'}
                    </button>
                ) : null}
            </header>
            {data ? (
                <div className="p-3">
                    <div ref={exportRef} className="h-[520px] overflow-hidden rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                        <EChart option={buildSankeyOption(data, currency, theme)} style={{ height: '100%', width: '100%' }} />
                    </div>
                </div>
            ) : (
                <div className="flex min-h-[520px] items-center justify-center p-4 text-sm terminal-muted">
                    Not enough statement detail is available to build this flow.
                </div>
            )}
        </article>
    );
};

const TrackerTab = ({ profile, theme }: { profile: StockProfileV2Model; theme: AppTheme }) => {
    const incomeGrid = profile.financials.statements?.income;
    const cashGrid = profile.financials.statements?.cashFlow;
    const balanceGrid = profile.financials.statements?.balanceSheet;
    const currency = profile.company.currency || 'USD';
    const incomeSankey = useMemo(() => buildIncomeSankey(incomeGrid), [incomeGrid]);
    const cashSankey = useMemo(() => buildCashSankey(incomeGrid, cashGrid, balanceGrid), [incomeGrid, cashGrid, balanceGrid]);

    return (
        <section className="space-y-4">
            <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-3">
                <p className="text-sm font-semibold">Financial Flow Tracker</p>
                <p className="mt-1 text-sm terminal-muted">Statement-based flow maps showing how reported revenue turns into earnings, then into cash.</p>
            </div>

            <div className="space-y-4">
                <SankeyCard title="Income Statement Flow" subtitle="How revenue flows through cost structure into net income" data={incomeSankey} currency={currency} theme={theme} symbol={profile.finnhubSymbol} />
                <SankeyCard title="Net Income to Cash Flow" subtitle="How earnings bridge into operating cash, investment outflows, and ending cash" data={cashSankey} currency={currency} theme={theme} symbol={profile.finnhubSymbol} />
            </div>
        </section>
    );
};

const NewsTab = ({ profile, newsItems }: { profile: StockProfileV2Model; newsItems: MarketNewsArticle[] }) => {
    const featured = newsItems[0];
    const remaining = newsItems.slice(1);

    if (!featured) {
        return (
            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <p className="text-sm font-semibold">Company News</p>
                </header>
                <div className="p-5 text-sm terminal-muted">Live company headlines are unavailable right now.</div>
            </article>
        );
    }

    return (
        <section className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Featured Headline</p>
                            <p className="text-xs terminal-muted">{profile.company.name || profile.finnhubSymbol}</p>
                        </div>
                        <span className="terminal-series-chip">{relativeTime(featured.datetime)}</span>
                    </header>
                    <div className="space-y-4 p-4">
                        <a href={featured.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4 transition hover:border-[var(--terminal-border-strong)]">
                            <p className="text-xl font-semibold">{featured.headline}</p>
                            <p className="mt-3 text-sm terminal-muted">
                                {featured.source || 'Market'} | {relativeTime(featured.datetime)}
                            </p>
                            {featured.summary ? <p className="mt-4 text-sm leading-7 terminal-muted">{featured.summary}</p> : null}
                        </a>
                    </div>
                </article>

                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Recent Headlines</p>
                            <p className="text-xs terminal-muted">Latest company-specific feed</p>
                        </div>
                    </header>
                    <div className="divide-y divide-[var(--terminal-border)]">
                        {remaining.map((item) => (
                            <a
                                key={`${item.url}-${item.id}`}
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="block px-4 py-3 transition hover:bg-[var(--terminal-panel-soft)]"
                            >
                                <p className="text-sm font-semibold">{item.headline}</p>
                                <p className="mt-1 text-xs terminal-muted">
                                    {item.source || 'Market'} | {relativeTime(item.datetime)}
                                </p>
                            </a>
                        ))}
                    </div>
                </article>
            </div>
        </section>
    );
};

const InvestorRelationsTab = ({ profile }: { profile: StockProfileV2Model }) => {
    const latestAnnual = profile.filings.find((filing) => filing.formType === '10-K');
    const latestQuarterly = profile.filings.find((filing) => filing.formType === '10-Q');

    return (
        <section className="space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Latest Reporting Pack</p>
                            <p className="text-xs terminal-muted">Current implementation uses the SEC filing feed already available in-app.</p>
                        </div>
                    </header>
                    <div className="space-y-3 p-4">
                        {[latestAnnual, latestQuarterly].filter(Boolean).map((filing) => (
                            <div key={`${filing?.formType}-${filing?.filedAt}`} className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                                <p className="text-xs uppercase tracking-[0.12em] terminal-muted">{filing?.formType}</p>
                                <p className="mt-2 text-sm font-semibold">{filing?.companyName || profile.company.name || profile.finnhubSymbol}</p>
                                <p className="mt-1 text-sm terminal-muted">Filed {formatDate(filing?.filedAt)} | Period end {formatDate(filing?.periodEnd)}</p>
                                {filing?.link ? (
                                    <a href={filing.link} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:text-[var(--terminal-accent)]">
                                        Open filing
                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                    </a>
                                ) : null}
                            </div>
                        ))}

                        <div className="rounded-xl border border-dashed border-[var(--terminal-border-strong)] bg-[var(--terminal-panel-soft)] p-4">
                            <p className="text-sm font-semibold">Upcoming additions</p>
                            <p className="mt-2 text-sm terminal-muted">
                                Earnings slide decks, call audio, transcripts, and press releases are not yet connected to this workspace.
                            </p>
                        </div>
                    </div>
                </article>

                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div>
                            <p className="text-sm font-semibold">Recent Filings</p>
                            <p className="text-xs terminal-muted">Most recent 10-K and 10-Q documents pulled from SEC submissions</p>
                        </div>
                        <span className="terminal-series-chip">{profile.filings.length} documents</span>
                    </header>
                    <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                            <thead>
                                <tr className="border-b border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Form</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Filed</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Period End</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Accession</th>
                                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] terminal-muted">Open</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profile.filings.map((filing) => (
                                    <tr key={`${filing.formType}-${filing.accessionNumber}`} className="border-b border-[var(--terminal-border)] transition hover:bg-[var(--terminal-panel-soft)]">
                                        <td className="px-4 py-3 text-sm font-semibold">{filing.formType || '--'}</td>
                                        <td className="px-4 py-3 text-sm terminal-muted">{formatDate(filing.filedAt)}</td>
                                        <td className="px-4 py-3 text-sm terminal-muted">{formatDate(filing.periodEnd)}</td>
                                        <td className="px-4 py-3 text-sm terminal-muted">{filing.accessionNumber || '--'}</td>
                                        <td className="px-4 py-3 text-right text-sm">
                                            {filing.link ? (
                                                <a href={filing.link} target="_blank" rel="noreferrer" className="terminal-mini-btn">
                                                    Open
                                                </a>
                                            ) : (
                                                <span className="terminal-muted">--</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </article>
            </div>
        </section>
    );
};

const TerminalAdvanceAnalyticsClient = ({ profile, newsItems }: ClientProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [theme, setTheme] = useState<'dark' | 'light'>(readThemeFromShell());

    const activeTab = parseTab(searchParams.get('tab'));
    const companyName = profile.company.name || profile.finnhubSymbol;
    const priceLabel = formatCurrency(profile.price?.current, profile.company.currency || 'USD');
    const priceChangeLabel = formatSignedPercent(profile.price?.changePercent, 2);

    useEffect(() => {
        const resolved = parseTab(searchParams.get('tab'));
        if (searchParams.get('tab') === resolved) return;

        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', resolved);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [pathname, router, searchParams]);

    useEffect(() => {
        const shell = document.querySelector<HTMLElement>('.terminal-shell');
        if (!shell) return;

        const applyTheme = () => setTheme(readThemeFromShell());
        applyTheme();

        const observer = new MutationObserver(applyTheme);
        observer.observe(shell, { attributes: true, attributeFilter: ['data-terminal-theme'] });
        return () => observer.disconnect();
    }, []);

    const updateQuery = (next: Partial<{ tab: AnalyticsTabKey }>) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next.tab) params.set('tab', next.tab);
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        });
    };

    return (
        <section className="terminal-analytics-page terminal-analytics-theme-bridge space-y-4">
            <div className="terminal-banner">
                <div className="space-y-2">
                    <p className="terminal-banner-kicker">Advance Analytics</p>
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-[var(--terminal-border-strong)] bg-[var(--terminal-panel-soft)]">
                            {profile.company.companyLogoUrl ? (
                                <Image src={profile.company.companyLogoUrl} alt={companyName} width={48} height={48} className="h-full w-full object-contain" />
                            ) : (
                                <Building2 className="h-5 w-5" />
                            )}
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight">{companyName}</h1>
                                <span className="terminal-series-chip">{profile.finnhubSymbol}</span>
                            </div>
                            <p className="text-sm terminal-muted">
                                {profile.company.exchange || 'Exchange unavailable'} | {profile.company.industry || 'Industry unavailable'} | {profile.company.country || 'Country unavailable'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                    <span className="rounded-xl border border-[var(--terminal-border-strong)] bg-[var(--terminal-panel-soft)] px-4 py-2 text-xl font-extrabold tracking-tight">
                        {priceLabel}
                    </span>
                    <span
                        className={cn(
                            'rounded-xl border border-[var(--terminal-border-strong)] bg-[var(--terminal-panel-soft)] px-4 py-2 text-xl font-extrabold tracking-tight',
                            (profile.price?.changePercent || 0) >= 0 ? 'terminal-up' : 'terminal-down'
                        )}
                    >
                        {priceChangeLabel}
                    </span>
                    {profile.company.marketCap ? (
                        <span className="rounded-xl border border-[var(--terminal-border-strong)] bg-[var(--terminal-panel-soft)] px-4 py-2 text-lg font-bold">
                            Mkt Cap {formatCurrencyShort(profile.company.marketCap, profile.company.currency || 'USD')}
                        </span>
                    ) : null}
                    {profile.company.website ? (
                        <a href={profile.company.website} target="_blank" rel="noreferrer" className="terminal-mini-btn">
                            Website
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                    ) : null}
                </div>
            </div>

            <div className="terminal-analytics-nav-wrap">
                <nav className="terminal-analytics-nav" aria-label="Advance analytics tabs">
                    {ANALYTICS_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const active = activeTab === tab.key;
                        return (
                            <button key={tab.key} type="button" onClick={() => updateQuery({ tab: tab.key })} className={cn('terminal-analytics-nav-item', active && 'terminal-analytics-nav-item-active')}>
                                <Icon className="h-4 w-4" />
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            {activeTab === 'overview' ? <OverviewTab profile={profile} theme={theme} /> : null}
            {activeTab === 'financials' ? <FinancialsTab profile={profile} theme={theme} /> : null}
            {activeTab === 'technical' ? <TerminalAssetMetricsPanel symbol={profile.finnhubSymbol} theme={theme} /> : null}
            {activeTab === 'tracker' ? <TrackerTab profile={profile} theme={theme} /> : null}
            {activeTab === 'news' ? <NewsTab profile={profile} newsItems={newsItems} /> : null}
            {activeTab === 'investor-relations' ? <InvestorRelationsTab profile={profile} /> : null}

            {profile.providerErrors && profile.providerErrors.length > 0 ? (
                <article className="terminal-widget">
                    <header className="terminal-widget-head">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4" />
                            <p className="text-sm font-semibold">Provider Status</p>
                        </div>
                        <span className="terminal-series-chip">{profile.providerErrors.length} notices</span>
                    </header>
                    <div className="space-y-2 p-4 text-sm terminal-muted">
                        {profile.providerErrors.map((error) => (
                            <div key={error} className="rounded-lg border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 py-2">
                                {error}
                            </div>
                        ))}
                    </div>
                </article>
            ) : null}
        </section>
    );
};

export default TerminalAdvanceAnalyticsClient;
