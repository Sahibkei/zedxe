'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/better-auth/auth';
import {
    getLatestCryptoPortfolioSnapshot,
    refreshCryptoPortfolioSnapshot,
    type CryptoPortfolioSnapshotLean,
} from './portfolio-service';

const requireSession = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return redirect('/sign-in');
    }
    return session;
};

export async function refreshCryptoPortfolioAction(walletAddress: string): Promise<
    | { success: true; snapshot: CryptoPortfolioSnapshotLean }
    | { success: false; error: string }
> {
    try {
        const session = await requireSession();
        const snapshot = await refreshCryptoPortfolioSnapshot(session.user.id, walletAddress);
        return { success: true, snapshot };
    } catch (error) {
        console.error('refreshCryptoPortfolioAction error:', error);
        const message = error instanceof Error ? error.message : 'Unable to refresh crypto portfolio.';
        return { success: false, error: message };
    }
}

export async function getLatestCryptoPortfolioAction(): Promise<CryptoPortfolioSnapshotLean | null> {
    const session = await requireSession();
    return getLatestCryptoPortfolioSnapshot(session.user.id);
}
