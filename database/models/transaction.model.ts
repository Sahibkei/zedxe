import { Schema, model, models, type Document, type Model, Types } from 'mongoose';

export type TransactionType = 'BUY' | 'SELL';

export interface TransactionDocument extends Document {
    userId: string;
    portfolioId: Types.ObjectId;
    symbol: string;
    type: TransactionType;
    quantity: number;
    price: number;
    currency: string;
    fxRateToBase?: number;
    tradeDate: Date;
    createdAt: Date;
    updatedAt: Date;
}

const TransactionSchema = new Schema<TransactionDocument>(
    {
        userId: { type: String, required: true, index: true },
        portfolioId: { type: Schema.Types.ObjectId, ref: 'Portfolio', required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        type: { type: String, required: true, enum: ['BUY', 'SELL'] },
        quantity: { type: Number, required: true },
        price: { type: Number, required: true },
        currency: { type: String, required: true, uppercase: true, trim: true },
        fxRateToBase: { type: Number, default: null },
        tradeDate: { type: Date, required: true },
    },
    { timestamps: true }
);

TransactionSchema.index({ userId: 1, portfolioId: 1, symbol: 1, tradeDate: -1 });

export const Transaction: Model<TransactionDocument> =
    (models?.Transaction as Model<TransactionDocument>) || model<TransactionDocument>('Transaction', TransactionSchema);
