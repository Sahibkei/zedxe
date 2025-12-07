import PortfolioPageClient from '@/components/portfolio/PortfolioPageClient';
import { getLatestCryptoPortfolioAction } from '@/lib/crypto/actions';
import { getPortfolioPerformanceAction, getPortfolioSummaryAction, getUserPortfoliosAction } from '@/lib/portfolio/actions';
import type { PortfolioPerformancePoint, PortfolioPerformanceRange } from '@/lib/portfolio/portfolio-service';

const DEFAULT_PERFORMANCE_RANGE: PortfolioPerformanceRange = '1M';

const PortfolioPage = async () => {
    const portfolios = await getUserPortfoliosAction();
    const first = portfolios[0];
    const summary = first ? await getPortfolioSummaryAction(first.id) : null;
    let initialPerformancePoints: PortfolioPerformancePoint[] = [];
    const initialCryptoSnapshot = await getLatestCryptoPortfolioAction();

    if (summary) {
        const res = await getPortfolioPerformanceAction(summary.portfolio.id, DEFAULT_PERFORMANCE_RANGE);
        if (res.success) {
            initialPerformancePoints = res.points;
        }
    }

    return (
        <PortfolioPageClient
            initialPortfolios={portfolios}
            initialSummary={summary}
            initialPerformanceRange={DEFAULT_PERFORMANCE_RANGE}
            initialPerformancePoints={initialPerformancePoints}
            initialCryptoSnapshot={initialCryptoSnapshot}
        />
    );
};

export default PortfolioPage;
