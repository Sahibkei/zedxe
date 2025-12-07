import { CryptoPortfolioSnapshot, type CryptoPortfolioSnapshotDocument } from '@/database/models/crypto-portfolio-snapshot.model';
import { connectToDatabase } from '@/database/mongoose';
import { SUPPORTED_CHAINS, type SupportedChainId } from './constants';

const MORALIS_BASE_URL = 'https://deep-index.moralis.io/api/v2.2';

export type CryptoHolding = {
    chainId: SupportedChainId;
    tokenAddress: string;
    name: string;
    symbol: string;
    logo?: string;
    decimals?: number | null;
    balance?: string;
    balanceFormatted?: string;
    usdPrice?: number;
    usdValue?: number;
    allocationPct: number;
    nativeToken?: boolean;
};

export type CryptoPortfolioSnapshotLean = {
    id: string;
    walletAddress: string;
    name: string;
    baseCurrency: string;
    totalValueUsd: number;
    holdings: CryptoHolding[];
    updatedAt: string;
};

type MoralisTokenBalance = {
    token_address: string;
    name?: string;
    symbol?: string;
    logo?: string;
    decimals?: string | number;
    balance?: string;
    balance_formatted?: string;
    usd_price?: number;
    usd_value?: number;
    portfolio_percentage?: number;
    native_token?: boolean;
};

type MoralisTokenResponse = {
    result?: MoralisTokenBalance[];
};

const mapSnapshot = (doc: CryptoPortfolioSnapshotDocument): CryptoPortfolioSnapshotLean => ({
    id: String(doc._id),
    walletAddress: doc.walletAddress,
    name: doc.name ?? '',
    baseCurrency: doc.baseCurrency,
    totalValueUsd: doc.totalValueUsd ?? 0,
    holdings:
        doc.holdings?.map((holding) => ({
            chainId: holding.chainId as SupportedChainId,
            tokenAddress: holding.tokenAddress,
            name: holding.name,
            symbol: holding.symbol,
            logo: holding.logo,
            decimals: holding.decimals,
            balance: holding.balance,
            balanceFormatted: holding.balanceFormatted,
            usdPrice: holding.usdPrice,
            usdValue: holding.usdValue,
            allocationPct: holding.allocationPct,
            nativeToken: holding.nativeToken,
        })) ?? [],
    updatedAt: doc.updatedAt?.toISOString() ?? new Date().toISOString(),
});

const fetchTokensForChain = async (walletAddress: string, chain: SupportedChainId, apiKey: string) => {
    const url = `${MORALIS_BASE_URL}/wallets/${encodeURIComponent(walletAddress)}/tokens?chain=${chain}&exclude_spam=true&exclude_unverified_contracts=true`;
    const res = await fetch(url, {
        headers: {
            accept: 'application/json',
            'X-API-Key': apiKey,
        },
        cache: 'no-store',
    });

    if (!res.ok) {
        throw new Error(`Moralis request failed for ${chain}: ${res.status}`);
    }

    const data = (await res.json()) as MoralisTokenResponse;
    return Array.isArray(data.result) ? data.result : [];
};

const normalizeWallet = (value: string) => value.trim().toLowerCase();

const moralisTokenToHolding = (token: MoralisTokenBalance, chainId: SupportedChainId): CryptoHolding | null => {
    const usdValue = Number(token.usd_value) || 0;
    const usdPrice = Number(token.usd_price) || undefined;
    const decimals = typeof token.decimals === 'string' ? Number(token.decimals) : token.decimals ?? null;

    if (!token.token_address || !token.symbol || !token.name) return null;

    return {
        chainId,
        tokenAddress: token.token_address,
        name: token.name,
        symbol: token.symbol,
        logo: token.logo,
        decimals,
        balance: token.balance,
        balanceFormatted: token.balance_formatted,
        usdPrice,
        usdValue,
        allocationPct: 0,
        nativeToken: token.native_token,
    };
};

export async function refreshCryptoPortfolioSnapshot(
    userId: string,
    walletAddress: string,
    name?: string
): Promise<CryptoPortfolioSnapshotLean> {
    const apiKey = process.env.MORALIS_API_KEY;
    if (!apiKey) {
        throw new Error('Moralis API key is not configured.');
    }

    if (!userId) {
        throw new Error('User not found.');
    }

    const normalizedWallet = normalizeWallet(walletAddress);
    if (!normalizedWallet) {
        throw new Error('Wallet address is required.');
    }

    const results = await Promise.allSettled(
        SUPPORTED_CHAINS.map(async (chain) => ({ chainId: chain.id, tokens: await fetchTokensForChain(normalizedWallet, chain.id, apiKey) }))
    );

    const holdings: CryptoHolding[] = [];

    for (const result of results) {
        if (result.status === 'fulfilled') {
            const { chainId, tokens } = result.value;
            tokens.forEach((token) => {
                const mapped = moralisTokenToHolding(token, chainId);
                if (mapped) holdings.push(mapped);
            });
        } else {
            console.error('Failed to fetch chain balances:', result.reason);
        }
    }

    if (holdings.length === 0) {
        throw new Error('Unable to load holdings for this wallet.');
    }

    const totalValueUsd = holdings.reduce((sum, holding) => sum + (holding.usdValue || 0), 0);
    const withAllocation = holdings.map((holding) => ({
        ...holding,
        allocationPct: totalValueUsd > 0 ? ((holding.usdValue || 0) / totalValueUsd) * 100 : 0,
    }));

    await connectToDatabase();

    const update: Partial<CryptoPortfolioSnapshotDocument> = {
        walletAddress: normalizedWallet,
        baseCurrency: 'USD',
        totalValueUsd,
        holdings: withAllocation,
    };

    if (name !== undefined) {
        update.name = name;
    }

    const doc = await CryptoPortfolioSnapshot.findOneAndUpdate(
        { userId, walletAddress: normalizedWallet },
        { $set: update },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return mapSnapshot(doc);
}

export async function getLatestCryptoPortfolioSnapshot(userId: string): Promise<CryptoPortfolioSnapshotLean | null> {
    if (!userId) return null;

    await connectToDatabase();
    const doc = await CryptoPortfolioSnapshot.findOne({ userId }).sort({ updatedAt: -1 }).lean<CryptoPortfolioSnapshotDocument>();
    if (!doc) return null;

    return mapSnapshot(doc);
}

export async function listUserCryptoSnapshots(userId: string): Promise<CryptoPortfolioSnapshotLean[]> {
    if (!userId) return [];

    await connectToDatabase();
    const docs = await CryptoPortfolioSnapshot.find({ userId })
        .sort({ updatedAt: -1 })
        .lean<CryptoPortfolioSnapshotDocument>();

    return docs.map(mapSnapshot);
}

export async function getCryptoSnapshotById(
    userId: string,
    snapshotId: string
): Promise<CryptoPortfolioSnapshotLean | null> {
    if (!userId || !snapshotId) return null;

    await connectToDatabase();
    const doc = await CryptoPortfolioSnapshot.findOne({ userId, _id: snapshotId }).lean<CryptoPortfolioSnapshotDocument>();
    if (!doc) return null;

    return mapSnapshot(doc);
}

export async function deleteCryptoSnapshot(userId: string, snapshotId: string): Promise<void> {
    if (!userId || !snapshotId) return;

    await connectToDatabase();
    await CryptoPortfolioSnapshot.deleteOne({ userId, _id: snapshotId });
}

export async function updateCryptoSnapshotMeta(
    userId: string,
    snapshotId: string,
    updates: { name?: string; walletAddress?: string }
): Promise<CryptoPortfolioSnapshotLean> {
    if (!userId || !snapshotId) {
        throw new Error('Missing snapshot identifier.');
    }

    const normalizedWallet = updates.walletAddress ? normalizeWallet(updates.walletAddress) : undefined;

    await connectToDatabase();

    const doc = await CryptoPortfolioSnapshot.findOneAndUpdate(
        { userId, _id: snapshotId },
        {
            $set: {
                ...(updates.name !== undefined ? { name: updates.name } : {}),
                ...(normalizedWallet ? { walletAddress: normalizedWallet } : {}),
            },
        },
        { new: true }
    ).lean<CryptoPortfolioSnapshotDocument>();

    if (!doc) {
        throw new Error('Snapshot not found.');
    }

    return mapSnapshot(doc);
}
