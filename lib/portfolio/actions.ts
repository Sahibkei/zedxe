'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { Portfolio } from '@/database/models/portfolio.model';
import { Transaction, type TransactionType } from '@/database/models/transaction.model';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import {
    getPortfolioPerformanceSeries,
    getPortfolioSummary,
    getUserPortfolios,
    setWeeklyReportPortfolio,
    clearWeeklyReportSelection,
    type PortfolioLean,
    type PortfolioPerformancePoint,
    type PortfolioPerformanceRange,
    type PortfolioSummary,
} from './portfolio-service';

const PORTFOLIO_PATH = '/portfolio';

const requireSession = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return redirect('/sign-in');
    }
    return session;
};

const normalizeCurrency = (currency?: string) => currency?.trim().toUpperCase() || '';

export async function createPortfolio({ name, baseCurrency }: { name: string; baseCurrency: string }) {
    try {
        const session = await requireSession();
        const cleanName = name?.trim();
        const currency = normalizeCurrency(baseCurrency);

        if (!cleanName || !currency) {
            return { success: false, error: 'Name and currency are required.' } as const;
        }

        await connectToDatabase();

        const created = await Portfolio.create({
            userId: session.user.id,
            name: cleanName,
            baseCurrency: currency,
        });

        revalidatePath(PORTFOLIO_PATH);
        return {
            success: true,
            portfolio: {
                id: String(created._id),
                name: created.name,
                baseCurrency: created.baseCurrency,
                weeklyReportEnabled: created.weeklyReportEnabled,
            },
        } as const;
    } catch (error) {
        console.error('createPortfolio error:', error);
        return { success: false, error: 'Failed to create portfolio.' } as const;
    }
}

export async function updatePortfolioMeta({
    id,
    name,
    baseCurrency,
}: {
    id: string;
    name?: string;
    baseCurrency?: string;
}) {
    try {
        const session = await requireSession();
        const updates: Partial<{ name: string; baseCurrency: string }> = {};

        if (name && name.trim()) updates.name = name.trim();
        if (baseCurrency && baseCurrency.trim()) updates.baseCurrency = normalizeCurrency(baseCurrency);

        if (Object.keys(updates).length === 0) {
            return { success: false, error: 'No updates provided.' } as const;
        }

        await connectToDatabase();

        const updated = await Portfolio.findOneAndUpdate({ _id: id, userId: session.user.id }, updates, { new: true }).lean();
        if (!updated) {
            return { success: false, error: 'Portfolio not found.' } as const;
        }

        revalidatePath(PORTFOLIO_PATH);
        return {
            success: true,
            portfolio: {
                id: String(updated._id),
                name: updated.name,
                baseCurrency: updated.baseCurrency,
                weeklyReportEnabled: updated.weeklyReportEnabled,
            },
        } as const;
    } catch (error) {
        console.error('updatePortfolioMeta error:', error);
        return { success: false, error: 'Failed to update portfolio.' } as const;
    }
}

export async function deletePortfolio(id: string) {
    try {
        const session = await requireSession();
        await connectToDatabase();

        await Transaction.deleteMany({ portfolioId: id, userId: session.user.id });
        await Portfolio.deleteOne({ _id: id, userId: session.user.id });

        revalidatePath(PORTFOLIO_PATH);
        return { success: true } as const;
    } catch (error) {
        console.error('deletePortfolio error:', error);
        return { success: false, error: 'Failed to delete portfolio.' } as const;
    }
}

export async function addTransaction({
    portfolioId,
    type,
    symbol,
    quantity,
    price,
    currency,
    tradeDate,
}: {
    portfolioId: string;
    type: TransactionType;
    symbol: string;
    quantity: number;
    price: number;
    currency: string;
    tradeDate: string | Date;
}) {
    try {
        const session = await requireSession();
        const cleanSymbol = symbol?.trim().toUpperCase();
        const parsedQuantity = Number(quantity);
        const parsedPrice = Number(price);

        if (!portfolioId || !cleanSymbol || parsedQuantity <= 0 || parsedPrice <= 0) {
            return {
                success: false,
                error: 'All fields are required and must be positive.',
            } as const;
        }

        await connectToDatabase();
        const portfolio = await Portfolio.findOne({ _id: portfolioId, userId: session.user.id }).lean();
        if (!portfolio) {
            return { success: false, error: 'Portfolio not found.' } as const;
        }

        const tradeDateValue = tradeDate instanceof Date ? tradeDate : new Date(tradeDate);

        await Transaction.create({
            userId: session.user.id,
            portfolioId,
            type,
            symbol: cleanSymbol,
            quantity: parsedQuantity,
            price: parsedPrice,
            currency: normalizeCurrency(currency) || portfolio.baseCurrency,
            fxRateToBase: 1,
            tradeDate: tradeDateValue,
        });

        revalidatePath(PORTFOLIO_PATH);
        return { success: true } as const;
    } catch (error) {
        console.error('addTransaction error:', error);
        return { success: false, error: 'Failed to add transaction.' } as const;
    }
}

export async function getUserPortfoliosAction(): Promise<PortfolioLean[]> {
    const session = await requireSession();
    return getUserPortfolios(session.user.id);
}

export async function getPortfolioSummaryAction(portfolioId: string): Promise<PortfolioSummary> {
    const session = await requireSession();
    return getPortfolioSummary(session.user.id, portfolioId);
}

export async function getPortfolioPerformanceAction(
    portfolioId: string,
    range: PortfolioPerformanceRange
): Promise<{ success: true; points: PortfolioPerformancePoint[] } | { success: false; error: string }> {
    const session = await requireSession();
    try {
        const points = await getPortfolioPerformanceSeries(session.user.id, portfolioId, range);
        return { success: true, points } as const;
    } catch (error) {
        console.error('getPortfolioPerformanceAction error:', error);
        return { success: false, error: 'Unable to load performance data.' } as const;
    }
}

export async function setWeeklyReportPortfolioAction(portfolioId: string) {
    const session = await requireSession();
    try {
        await setWeeklyReportPortfolio(session.user.id, portfolioId);
        revalidatePath(PORTFOLIO_PATH);
        return { success: true } as const;
    } catch (error) {
        console.error('setWeeklyReportPortfolioAction error:', error);
        return { success: false, error: 'Failed to update weekly report preference.' } as const;
    }
}

export async function clearWeeklyReportSelectionAction() {
    const session = await requireSession();
    try {
        await clearWeeklyReportSelection(session.user.id);
        revalidatePath(PORTFOLIO_PATH);
        return { success: true } as const;
    } catch (error) {
        console.error('clearWeeklyReportSelectionAction error:', error);
        return { success: false, error: 'Failed to disable weekly reports.' } as const;
    }
}
