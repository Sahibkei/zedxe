import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface CryptoHoldingDocument {
    chainId: string;
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
}

export interface CryptoPortfolioSnapshotDocument extends Document {
    userId: string;
    walletAddress: string;
    baseCurrency: string;
    totalValueUsd: number;
    holdings: CryptoHoldingDocument[];
    createdAt: Date;
    updatedAt: Date;
}

const HoldingSchema = new Schema<CryptoHoldingDocument>(
    {
        chainId: { type: String, required: true },
        tokenAddress: { type: String, required: true },
        name: { type: String, required: true },
        symbol: { type: String, required: true },
        logo: { type: String },
        decimals: { type: Number },
        balance: { type: String },
        balanceFormatted: { type: String },
        usdPrice: { type: Number },
        usdValue: { type: Number },
        allocationPct: { type: Number, default: 0 },
        nativeToken: { type: Boolean },
    },
    { _id: false }
);

const CryptoPortfolioSnapshotSchema = new Schema<CryptoPortfolioSnapshotDocument>(
    {
        userId: { type: String, required: true, index: true },
        walletAddress: { type: String, required: true, index: true },
        baseCurrency: { type: String, default: 'USD', uppercase: true, trim: true },
        totalValueUsd: { type: Number, default: 0 },
        holdings: { type: [HoldingSchema], default: [] },
    },
    { timestamps: true }
);

CryptoPortfolioSnapshotSchema.index({ userId: 1, walletAddress: 1 });

export const CryptoPortfolioSnapshot: Model<CryptoPortfolioSnapshotDocument> =
    (models?.CryptoPortfolioSnapshot as Model<CryptoPortfolioSnapshotDocument>) ||
    model<CryptoPortfolioSnapshotDocument>('CryptoPortfolioSnapshot', CryptoPortfolioSnapshotSchema);
