'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Watchlist, type WatchlistItem } from '@/database/models/watchlist.model';
import { Alert } from '@/database/models/alert.model';
import { getSnapshotsForSymbols } from '@/lib/actions/finnhub.actions';

export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
    if (!email) return [];

    try {
        const mongoose = await connectToDatabase();
        const db = mongoose.connection.db;
        if (!db) throw new Error('MongoDB connection not found');

        // Better Auth stores users in the "user" collection
        const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });

        if (!user) return [];

        const userId = (user.id as string) || String(user._id || '');
        if (!userId) return [];

        const items = await Watchlist.find({ userId }, { symbol: 1 }).lean();
        return items.map((i) => String(i.symbol));
    } catch (err) {
        console.error('getWatchlistSymbolsByEmail error:', err);
        return [];
    }
}

export async function getWatchlistItemsByEmail(email: string): Promise<WatchlistItem[]> {
    if (!email) return [];

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB connection not found');

    const user = await db.collection('user').findOne<{ _id?: unknown; id?: string; email?: string }>({ email });
    if (!user) return [];
    const userId = (user.id as string) || String(user._id || '');
    if (!userId) return [];

    return await Watchlist.find({ userId }).lean();
}

export async function getWatchlistItemsByUserId(userId: string): Promise<WatchlistItem[]> {
    if (!userId) return [];
    await connectToDatabase();
    return await Watchlist.find({ userId }).lean();
}

export async function addToWatchlist(params: { userId: string; symbol: string; company?: string }) {
    const { userId, symbol, company } = params;
    if (!userId || !symbol) throw new Error('Missing user or symbol');

    await connectToDatabase();

    const cleanSymbol = symbol.toUpperCase();
    const fallbackCompany = company?.trim() || cleanSymbol;

    const item = await Watchlist.findOneAndUpdate(
        { userId, symbol: cleanSymbol },
        { $setOnInsert: { company: fallbackCompany, addedAt: new Date(), createdAt: new Date() } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return item.toObject();
}

export async function removeFromWatchlist(userId: string, symbol: string) {
    if (!userId || !symbol) throw new Error('Missing user or symbol');
    await connectToDatabase();
    await Watchlist.deleteOne({ userId, symbol: symbol.toUpperCase() });
    await Alert.deleteMany({ userId, symbol: symbol.toUpperCase() });
}

export async function getWatchlistWithData(userId: string): Promise<WatchlistStockWithData[]> {
    if (!userId) return [];
    await connectToDatabase();

    const items = await Watchlist.find({ userId }).lean();
    const snapshots = await getSnapshotsForSymbols(items.map((i) => i.symbol));
    const alerts = await Alert.find({ userId }).lean();

    return items.map((item) => {
        const snapshot = snapshots[item.symbol] || { symbol: item.symbol };
        const symbolAlerts = alerts.filter((a) => a.symbol === item.symbol);

        return {
            id: String(item._id),
            userId,
            symbol: item.symbol,
            company: item.company,
            addedAt: item.addedAt,
            createdAt: item.createdAt || item.addedAt,
            currentPrice: snapshot.currentPrice,
            changePercent: snapshot.changePercent,
            marketCap: snapshot.marketCap,
            hasAlert: symbolAlerts.length > 0,
        } satisfies WatchlistStockWithData;
    });
}

export async function isSymbolInWatchlist(userId: string, symbol: string) {
    if (!userId || !symbol) return false;
    await connectToDatabase();
    const count = await Watchlist.countDocuments({ userId, symbol: symbol.toUpperCase() });
    return count > 0;
}