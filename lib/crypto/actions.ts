'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/better-auth/auth';
import {
    deleteCryptoSnapshot,
    getCryptoSnapshotById,
    getLatestCryptoPortfolioSnapshot,
    listUserCryptoSnapshots,
    refreshCryptoPortfolioSnapshot,
    updateCryptoSnapshotMeta,
    type CryptoPortfolioSnapshotLean,
} from './portfolio-service';

const requireSession = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
        return redirect('/sign-in');
    }
    return session;
};

export async function refreshCryptoPortfolioAction(payload: {
    walletAddress: string;
    name?: string;
}): Promise<
    | { success: true; snapshot: CryptoPortfolioSnapshotLean }
    | { success: false; error: string }
> {
    try {
        const session = await requireSession();
        const snapshot = await refreshCryptoPortfolioSnapshot(session.user.id, payload.walletAddress, payload.name);
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

export async function listCryptoSnapshotsAction(): Promise<CryptoPortfolioSnapshotLean[]> {
    const session = await requireSession();
    return listUserCryptoSnapshots(session.user.id);
}

export async function deleteCryptoSnapshotAction(snapshotId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const session = await requireSession();
        await deleteCryptoSnapshot(session.user.id, snapshotId);
        return { success: true };
    } catch (error) {
        console.error('deleteCryptoSnapshotAction error:', error);
        const message = error instanceof Error ? error.message : 'Unable to delete wallet.';
        return { success: false, error: message };
    }
}

export async function updateCryptoSnapshotMetaAction(
    snapshotId: string,
    updates: { name?: string; walletAddress?: string }
): Promise<{ success: boolean; snapshot?: CryptoPortfolioSnapshotLean; error?: string }> {
    try {
        const session = await requireSession();
        const snapshot = await updateCryptoSnapshotMeta(session.user.id, snapshotId, updates);
        return { success: true, snapshot };
    } catch (error) {
        console.error('updateCryptoSnapshotMetaAction error:', error);
        const message = error instanceof Error ? error.message : 'Unable to update wallet.';
        return { success: false, error: message };
    }
}

export async function getCryptoSnapshotByIdAction(
    snapshotId: string
): Promise<{ success: boolean; snapshot?: CryptoPortfolioSnapshotLean; error?: string }> {
    try {
        const session = await requireSession();
        const snapshot = await getCryptoSnapshotById(session.user.id, snapshotId);
        if (!snapshot) {
            return { success: false, error: 'Wallet not found.' };
        }
        return { success: true, snapshot };
    } catch (error) {
        console.error('getCryptoSnapshotByIdAction error:', error);
        const message = error instanceof Error ? error.message : 'Unable to load wallet.';
        return { success: false, error: message };
    }
}
