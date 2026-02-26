import Link from 'next/link';
import { headers } from 'next/headers';

import StockTerminalView from '@/components/stock-terminal/StockTerminalView';
import type { TerminalData } from '@/components/stock-terminal/types';
import { auth } from '@/lib/better-auth/auth';
import { getNews, getSymbolSnapshot } from '@/lib/actions/finnhub.actions';
import { getAlertsByUser } from '@/lib/actions/alert.actions';
import { isSymbolInWatchlist } from '@/lib/actions/watchlist.actions';
import { getDailyHistory } from '@/lib/market/providers';
import { getStockProfileV2 } from '@/lib/stocks/getStockProfileV2';

import StockProfileContent from '@/components/stock-profile/StockProfileContent';
import StockProfileHeader from '@/components/stock-profile/StockProfileHeader';

type StockPageProps = {
  params: Promise<{ symbol: string }>;
  searchParams?: Promise<{ ui?: string }>;
};

const compact = (value?: number) =>
  typeof value === 'number'
    ? new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
    : '—';

const asPercent = (value?: number) => (typeof value === 'number' ? `${value.toFixed(2)}%` : '—');

const toTerminalData = (input: {
  symbol: string;
  snapshot: Awaited<ReturnType<typeof getSymbolSnapshot>>;
  stockProfile: Awaited<ReturnType<typeof getStockProfileV2>>;
  history: Awaited<ReturnType<typeof getDailyHistory>>;
  newsItems: MarketNewsArticle[];
}): TerminalData => {
  const { stockProfile, symbol, snapshot, history, newsItems } = input;
  const lastPrice = stockProfile.price?.current ?? snapshot.currentPrice;
  const changePercent = stockProfile.price?.changePercent ?? snapshot.changePercent;
  const change = typeof lastPrice === 'number' && typeof changePercent === 'number' ? (lastPrice * changePercent) / (100 + changePercent) : undefined;

  const annualRows = stockProfile.financials.annual.slice(0, 5);
  const statementColumns = stockProfile.financials.statements?.income?.columns.slice(0, 5) ?? [];
  const revenueRow = stockProfile.financials.statements?.income?.rows.find((row) => row.id === 'totalRevenue');
  const netIncomeRow = stockProfile.financials.statements?.income?.rows.find((row) => row.id === 'netIncome');
  const opIncomeRow = stockProfile.financials.statements?.income?.rows.find((row) => row.id === 'operatingIncome');
  const cashFlowRow = stockProfile.financials.statements?.cashFlow?.rows.find((row) => row.id === 'netCashProvidedByUsedInOperatingActivities');

  return {
    header: {
      ticker: symbol,
      name: stockProfile.company.name || symbol,
      exchange: stockProfile.company.exchange,
      sector: stockProfile.company.industry,
      price: lastPrice,
      change,
      changePercent,
    },
    marquee: [
      { label: 'MKT CAP', value: compact(stockProfile.company.marketCap ?? snapshot.marketCap) },
      { label: 'SHARES OUT', value: compact(stockProfile.company.shareOutstanding) },
      { label: 'IPO', value: stockProfile.company.ipo || '—' },
      { label: 'EPS', value: typeof annualRows[0]?.eps === 'number' ? annualRows[0].eps.toFixed(2) : '—' },
      { label: 'ROE', value: asPercent((stockProfile.metrics as { roe?: number }).roe) },
      { label: 'FCF', value: compact((stockProfile.metrics as { freeCashFlow?: number }).freeCashFlow) },
      { label: 'REV GROWTH', value: asPercent((stockProfile.metrics as { revenueGrowth?: number }).revenueGrowth) },
    ],
    overviewMetrics: [
      { label: 'Market Cap', value: compact(stockProfile.company.marketCap ?? snapshot.marketCap) },
      { label: 'P/E', value: typeof stockProfile.metrics.pe === 'number' ? stockProfile.metrics.pe.toFixed(2) : '—' },
      { label: 'P/B', value: typeof stockProfile.metrics.pb === 'number' ? stockProfile.metrics.pb.toFixed(2) : '—' },
      { label: 'P/S', value: typeof stockProfile.metrics.ps === 'number' ? stockProfile.metrics.ps.toFixed(2) : '—' },
      { label: 'Debt / Equity', value: typeof stockProfile.metrics.debtToEquity === 'number' ? stockProfile.metrics.debtToEquity.toFixed(2) : '—' },
      { label: 'Dividend Yield', value: asPercent(stockProfile.metrics.dividendYieldPercent) },
      { label: 'Country', value: stockProfile.company.country || '—' },
      { label: 'Employees', value: compact(stockProfile.company.employees) },
    ],
    priceSeries: history.length
      ? history
          .filter((_, index) => index % 20 === 0)
          .map((point) => ({ label: point.date.slice(2), close: point.close }))
      : [],
    financials: statementColumns.map((column) => ({
      period: column.label,
      revenue: revenueRow?.valuesByColumnKey[column.key],
      netIncome: netIncomeRow?.valuesByColumnKey[column.key],
      operatingIncome: opIncomeRow?.valuesByColumnKey[column.key],
      operatingCashFlow: cashFlowRow?.valuesByColumnKey[column.key],
      eps: annualRows.find((row) => row.label === column.label)?.eps,
    })),
    ratios: [
      { label: 'Price / Earnings', value: typeof stockProfile.metrics.pe === 'number' ? stockProfile.metrics.pe.toFixed(2) : '—', category: 'VALUATION' },
      { label: 'Price / Book', value: typeof stockProfile.metrics.pb === 'number' ? stockProfile.metrics.pb.toFixed(2) : '—', category: 'VALUATION' },
      { label: 'Price / Sales', value: typeof stockProfile.metrics.ps === 'number' ? stockProfile.metrics.ps.toFixed(2) : '—', category: 'VALUATION' },
      { label: 'EV / EBITDA', value: typeof stockProfile.metrics.evToEbitda === 'number' ? stockProfile.metrics.evToEbitda.toFixed(2) : '—', category: 'VALUATION' },
      { label: 'Debt / Equity', value: typeof stockProfile.metrics.debtToEquity === 'number' ? stockProfile.metrics.debtToEquity.toFixed(2) : '—', category: 'LEVERAGE' },
      { label: 'Current Ratio', value: typeof stockProfile.metrics.currentRatio === 'number' ? stockProfile.metrics.currentRatio.toFixed(2) : '—', category: 'LIQUIDITY' },
      { label: 'Dividend Yield', value: asPercent(stockProfile.metrics.dividendYieldPercent), category: 'INCOME' },
    ],
    news: newsItems.map((item, index) => ({
      id: String(item.id ?? `${item.url ?? item.headline}-${index}`),
      headline: item.headline,
      summary: item.summary,
      source: item.source,
      datetime: item.datetime,
      url: item.url,
    })),
  };
};

export default async function StockDetailsPage({ params, searchParams }: StockPageProps) {
  const { symbol } = await params;
  const query = (await searchParams) ?? {};
  const uiMode = query.ui === 'terminal' ? 'terminal' : 'classic';

  const symbolUpper = symbol.toUpperCase();
  const session = await auth.api.getSession({ headers: await headers() });

  const historyEndDate = new Date();
  const historyStartDate = new Date(historyEndDate);
  historyStartDate.setFullYear(historyEndDate.getFullYear() - 3);

  const [profileResult, snapshotResult, watchlistResult, alertsResult, newsResult, historyResult] = await Promise.allSettled([
    getStockProfileV2(symbolUpper),
    getSymbolSnapshot(symbolUpper),
    session?.user ? isSymbolInWatchlist(session.user.id, symbolUpper) : Promise.resolve(false),
    session?.user ? getAlertsByUser(session.user.id) : Promise.resolve([]),
    getNews([symbolUpper]),
    getDailyHistory({ symbol: symbolUpper, from: historyStartDate, to: historyEndDate }),
  ]);

  if (profileResult.status !== 'fulfilled') {
    const message = profileResult.reason instanceof Error ? profileResult.reason.message : 'Stock profile data is currently unavailable.';

    return (
      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 md:px-6">
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <h1 className="text-2xl font-semibold text-red-100">Unable to load stock profile</h1>
          <p className="mt-2 text-sm text-red-200">{message}</p>
          <div className="mt-4 flex gap-2">
            <Link href={`/stocks/${symbolUpper}`} className="rounded-md border border-red-300/60 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-red-50 hover:bg-red-500/20">
              Retry
            </Link>
            <Link href="/dashboard" className="rounded-md border border-border/70 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/20">
              Back to Markets
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stockProfile = profileResult.value;
  const snapshot =
    snapshotResult.status === 'fulfilled'
      ? snapshotResult.value
      : {
          symbol: symbolUpper,
          company: stockProfile.company.name || symbolUpper,
        };

  const history = historyResult.status === 'fulfilled' ? historyResult.value : [];
  const isInWatchlist = watchlistResult.status === 'fulfilled' ? watchlistResult.value : false;
  const alerts = alertsResult.status === 'fulfilled' ? alertsResult.value : [];
  const newsItems = newsResult.status === 'fulfilled' ? newsResult.value : [];

  const symbolAlert = alerts.find((alert) => alert.symbol === symbolUpper);
  const symbolAlertDisplay = symbolAlert
    ? {
        ...symbolAlert,
        id: String((symbolAlert as { _id?: string })._id || symbolAlert._id || ''),
        createdAt: symbolAlert.createdAt,
      }
    : undefined;

  const companyName = stockProfile.company.name || snapshot.company || stockProfile.finnhubSymbol;
  const marketCap = stockProfile.company.marketCap || snapshot.marketCap;
  const terminalData = toTerminalData({ symbol: symbolUpper, snapshot, stockProfile, history, newsItems });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8 md:px-6">
      <div className="flex justify-end">
        <Link
          href={`/stocks/${symbolUpper}?ui=${uiMode === 'terminal' ? 'classic' : 'terminal'}`}
          className="rounded-md border border-border/70 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground hover:bg-muted/20"
        >
          {uiMode === 'terminal' ? 'Back to Classic' : 'Open Terminal UI'}
        </Link>
      </div>
      {uiMode === 'terminal' ? (
        <StockTerminalView ticker={symbolUpper} data={terminalData} />
      ) : (
        <>
          <StockProfileHeader
            symbol={symbolUpper}
            companyName={companyName}
            companyLogoUrl={stockProfile.company.companyLogoUrl}
            exchange={stockProfile.company.exchange}
            sector={stockProfile.company.industry}
            currency={stockProfile.company.currency}
            marketCap={marketCap}
            price={stockProfile.price?.current ?? snapshot.currentPrice}
            changePercent={stockProfile.price?.changePercent ?? snapshot.changePercent}
            isInWatchlist={isInWatchlist}
            initialAlert={symbolAlertDisplay as AlertDisplay | undefined}
          />

          <StockProfileContent profile={stockProfile} symbol={symbolUpper} marketCap={marketCap} newsItems={newsItems} providerErrors={stockProfile.providerErrors} />
        </>
      )}
    </div>
  );
}
