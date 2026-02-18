import type { ReactNode } from 'react';
import type { ThemeTokens } from './themes';

export type TerminalTab = 'OVERVIEW' | 'FINANCIALS' | 'RATIOS' | 'CHARTS' | 'NEWS';

export type HeaderData = {
  ticker: string;
  name: string;
  exchange?: string;
  sector?: string;
  price?: number;
  change?: number;
  changePercent?: number;
};

export type MetricItem = { label: string; value: string };
export type PricePoint = { label: string; close: number };
export type FinancialRow = { period: string; revenue?: number; netIncome?: number; operatingIncome?: number; operatingCashFlow?: number; eps?: number };
export type RatioRow = { label: string; value: string; category?: string };
export type NewsItem = { id: string; headline: string; summary?: string; source?: string; datetime?: number; url?: string };

export type TerminalData = {
  header: HeaderData;
  marquee: MetricItem[];
  overviewMetrics: MetricItem[];
  priceSeries: PricePoint[];
  financials: FinancialRow[];
  ratios: RatioRow[];
  news: NewsItem[];
};

export type LayoutProps = {
  t: ThemeTokens;
  tab: TerminalTab;
  setTab: (next: TerminalTab) => void;
  header: HeaderData;
  marquee: MetricItem[];
  children: ReactNode;
};
