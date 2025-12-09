import { Schema, model, models, type Document, type Model } from 'mongoose';

export type OrderflowTradeSide = 'buy' | 'sell';

export interface OrderflowTradeDocument extends Document {
    symbol: string;
    timestamp: Date;
    price: number;
    quantity: number;
    side: OrderflowTradeSide;
    sourceId?: string;
}

const OrderflowTradeSchema = new Schema<OrderflowTradeDocument>({
    symbol: { type: String, required: true, lowercase: true, trim: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    side: { type: String, required: true, enum: ['buy', 'sell'] },
    sourceId: { type: String },
});

OrderflowTradeSchema.index({ symbol: 1, timestamp: 1 });
OrderflowTradeSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export const OrderflowTrade: Model<OrderflowTradeDocument> =
    (models?.OrderflowTrade as Model<OrderflowTradeDocument>) ||
    model<OrderflowTradeDocument>('OrderflowTrade', OrderflowTradeSchema);
