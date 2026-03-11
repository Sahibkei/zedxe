import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { getPortfolioSummary, getUserPortfolios } from '@/lib/portfolio/portfolio-service';

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ portfolio: null, warning: 'Unauthorized' }, { status: 401 });
    }

    try {
        const portfolios = await getUserPortfolios(session.user.id);
        const activePortfolio = portfolios.find((portfolio) => portfolio.weeklyReportEnabled) ?? portfolios[0] ?? null;

        if (!activePortfolio) {
            return NextResponse.json({ portfolio: null, warning: 'No portfolio found.' });
        }

        const summary = await getPortfolioSummary(session.user.id, activePortfolio.id);

        return NextResponse.json({
            portfolio: {
                id: summary.portfolio.id,
                name: summary.portfolio.name,
                baseCurrency: summary.portfolio.baseCurrency,
            },
            totals: summary.totals,
            positions: summary.positions.slice(0, 5).map((position) => ({
                symbol: position.symbol,
                companyName: position.companyName,
                quantity: position.quantity,
                currentValue: position.currentValue,
                pnlPct: position.pnlPct,
                weightPct: position.weightPct,
            })),
        });
    } catch (error) {
        console.error('GET /api/portfolio/widget error:', error);
        return NextResponse.json({ portfolio: null, warning: 'Portfolio widget is temporarily unavailable.' }, { status: 500 });
    }
}
