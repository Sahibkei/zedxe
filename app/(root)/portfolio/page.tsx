import PortfolioPageClient from '@/components/portfolio/PortfolioPageClient';
import { getPortfolioPerformanceAction, getPortfolioSummaryAction, getUserPortfoliosAction } from '@/lib/portfolio/actions';
import type { PortfolioPerformanceRange } from '@/lib/portfolio/portfolio-service';
import type { PortfolioPerformanceSeries } from '@/lib/portfolio/performance';

const DEFAULT_PERFORMANCE_RANGE: PortfolioPerformanceRange = '1M';

const PortfolioPage = async () => {
    const portfolios = await getUserPortfoliosAction();
    const first = portfolios[0];
    const summary = first ? await getPortfolioSummaryAction(first.id) : null;
    let initialPerformanceSeries: PortfolioPerformanceSeries | null = null;

    if (summary) {
        const res = await getPortfolioPerformanceAction(summary.portfolio.id, DEFAULT_PERFORMANCE_RANGE);
        if (res.success) {
            initialPerformanceSeries = res.series;
        }
    }

    return (
        <PortfolioPageClient
            initialPortfolios={portfolios}
            initialSummary={summary}
            initialPerformanceRange={DEFAULT_PERFORMANCE_RANGE}
            initialPerformanceSeries={initialPerformanceSeries}
        />
    );
};

export default PortfolioPage;
