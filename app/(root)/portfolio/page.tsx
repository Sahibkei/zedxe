import PortfolioPageClient from '@/components/portfolio/PortfolioPageClient';
import { getPortfolioSummaryAction, getUserPortfoliosAction } from '@/lib/portfolio/actions';

const PortfolioPage = async () => {
    const portfolios = await getUserPortfoliosAction();
    const first = portfolios[0];
    const summary = first ? await getPortfolioSummaryAction(first.id) : null;

    return <PortfolioPageClient initialPortfolios={portfolios} initialSummary={summary} />;
};

export default PortfolioPage;
