import { Document, Model, Schema, model, models } from 'mongoose';

export interface AlertDocument extends Document {
    userId: string;
    symbol: string;
    name?: string;
    condition: 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'crosses_above' | 'crosses_below';
    thresholdValue: number;
    frequency: 'once' | 'once_per_day';
    isActive: boolean;
    lastTriggeredAt?: Date | null;
    createdAt: Date;
}

const AlertSchema = new Schema<AlertDocument>(
    {
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        name: { type: String, trim: true },
        condition: {
            type: String,
            required: true,
            enum: ['greater_than', 'less_than', 'greater_or_equal', 'less_or_equal', 'crosses_above', 'crosses_below'],
        },
        thresholdValue: { type: Number, required: true },
        frequency: { type: String, default: 'once_per_day', enum: ['once', 'once_per_day'] },
        isActive: { type: Boolean, default: true },
        lastTriggeredAt: { type: Date, default: null },
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: false }
);

AlertSchema.index({ userId: 1, symbol: 1, condition: 1, thresholdValue: 1 }, { unique: false });

export const Alert: Model<AlertDocument> = (models?.Alert as Model<AlertDocument>) || model<AlertDocument>('Alert', AlertSchema);
