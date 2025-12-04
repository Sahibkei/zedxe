import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface PortfolioDocument extends Document {
    userId: string;
    name: string;
    baseCurrency: string;
    createdAt: Date;
    updatedAt: Date;
}

const PortfolioSchema = new Schema<PortfolioDocument>(
    {
        userId: { type: String, required: true, index: true },
        name: { type: String, required: true, trim: true },
        baseCurrency: { type: String, required: true, uppercase: true, trim: true },
    },
    { timestamps: true }
);

PortfolioSchema.index({ userId: 1, name: 1 });

export const Portfolio: Model<PortfolioDocument> =
    (models?.Portfolio as Model<PortfolioDocument>) || model<PortfolioDocument>('Portfolio', PortfolioSchema);
