import PortfolioPageClient from '@/components/portfolio/PortfolioPageClient';
import { listCryptoSnapshotsAction } from '@/lib/crypto/actions';
import type { CryptoPortfolioSnapshotLean } from '@/lib/crypto/portfolio-service';
import { getPortfolioPerformanceAction, getPortfolioSummaryAction, getUserPortfoliosAction } from '@/lib/portfolio/actions';
import type { PortfolioPerformancePoint, PortfolioPerformanceRange } from '@/lib/portfolio/portfolio-service';

const DEFAULT_PERFORMANCE_RANGE: PortfolioPerformanceRange = '1M';

const PortfolioPage = async () => {
    const portfolios = await getUserPortfoliosAction();
    const first = portfolios[0];
    const summary = first ? await getPortfolioSummaryAction(first.id) : null;
    let initialPerformancePoints: PortfolioPerformancePoint[] = [];
    let initialCryptoSnapshots: CryptoPortfolioSnapshotLean[] = [];
    try {
        initialCryptoSnapshots = await listCryptoSnapshotsAction();
    } catch (error) {
        console.error('Failed to load crypto snapshots:', error);
    }

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
            initialCryptoSnapshots={initialCryptoSnapshots}
        />
    );
};

export default PortfolioPage;
