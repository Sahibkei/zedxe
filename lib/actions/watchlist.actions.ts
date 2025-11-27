'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { Watchlist, type WatchlistItem } from '@/database/models/watchlist.model';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';
import { getStocksDetails } from '@/lib/actions/finnhub.actions';

export async function addToWatchlist(symbol: string, company: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return redirect('/sign-in');
        }

        await connectToDatabase();

        const cleanSymbol = symbol.trim().toUpperCase();
        const cleanCompany = company.trim();

        const existing = await Watchlist.findOne({ userId: session.user.id, symbol: cleanSymbol }).lean();
        if (existing) {
            return { success: true, message: `${cleanSymbol} is already in your watchlist.` } as const;
        }

        await Watchlist.create({
            userId: session.user.id,
            symbol: cleanSymbol,
            company: cleanCompany,
            addedAt: new Date(),
        });

        revalidatePath('/watchlist');
        return { success: true, message: `${cleanSymbol} added to watchlist.` } as const;
    } catch (error) {
        console.error('addToWatchlist error:', error);
        return { success: false, error: 'Failed to add symbol to watchlist.' } as const;
    }
}

export async function removeFromWatchlist(symbol: string) {
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        if (!session?.user) {
            return redirect('/sign-in');
        }

        await connectToDatabase();
        const cleanSymbol = symbol.trim().toUpperCase();

        await Watchlist.deleteOne({ userId: session.user.id, symbol: cleanSymbol });
        revalidatePath('/watchlist');
        return { success: true, message: `${cleanSymbol} removed from watchlist.` } as const;
    } catch (error) {
        console.error('removeFromWatchlist error:', error);
        return { success: false, error: 'Failed to remove symbol from watchlist.' } as const;
    }
}

export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
    if (!email) return [];

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
        if (!user) return [];

        const userId = (user.id as string) || String(user._id || '');
        if (!userId) return [];

        const items = await Watchlist.find({ userId }, { symbol: 1 }).lean();
        return items.map((item) => String(item.symbol).toUpperCase());
    } catch (error) {
        console.error('getWatchlistSymbolsByEmail error:', error);
        return [];
    }
}

export async function getUserWatchlist(): Promise<WatchlistItem[]> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return redirect('/sign-in');
    }

    await connectToDatabase();
    return Watchlist.find({ userId: session.user.id }).sort({ addedAt: -1 }).lean();
}

export async function getWatchlistWithData(): Promise<WatchlistEntryWithData[]> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return redirect('/sign-in');
    }

    await connectToDatabase();
    const items = await Watchlist.find({ userId: session.user.id }).sort({ addedAt: -1 }).lean();
    if (!items || items.length === 0) return [];

    const stocksWithData = await Promise.all(
        items.map(async (item) => {
            const details = await getStocksDetails(item.symbol);
            return {
                company: details.company || item.company,
                symbol: details.symbol,
                currentPrice: details.currentPrice,
                priceFormatted: details.priceFormatted,
                changeFormatted: details.changeFormatted,
                changePercent: details.changePercent,
                marketCap: details.marketCap,
                peRatio: details.peRatio,
            } satisfies WatchlistEntryWithData;
        })
    );

    return JSON.parse(JSON.stringify(stocksWithData));
}

// Legacy helpers retained for existing integrations
export async function getWatchlistItemsByUserId(userId: string): Promise<WatchlistItem[]> {
    if (!userId) return [];
    await connectToDatabase();
    return Watchlist.find({ userId }).sort({ addedAt: -1 }).lean();
}

export async function isSymbolInWatchlist(userId: string, symbol: string) {
    if (!userId || !symbol) return false;
    await connectToDatabase();
    const count = await Watchlist.countDocuments({ userId, symbol: symbol.toUpperCase() });
    return count > 0;
}
