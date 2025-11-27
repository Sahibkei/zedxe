import { Schema, model, models } from 'mongoose';

export interface AlertItem {
    _id: string;
    userId: string;
    symbol: string;
    company: string;
    alertName: string;
    condition: 'greater_than' | 'less_than' | 'crosses_above' | 'crosses_below';
    thresholdValue: number;
    frequency: 'once' | 'once_per_day' | 'once_per_hour';
    isActive: boolean;
    createdAt: Date;
    lastTriggeredAt?: Date | null;
    lastPrice?: number | null;
}

const AlertSchema = new Schema<AlertItem>(
    {
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        company: { type: String, required: true, trim: true },
        alertName: { type: String, required: true, trim: true },
        condition: {
            type: String,
            required: true,
            enum: ['greater_than', 'less_than', 'crosses_above', 'crosses_below'],
        },
        thresholdValue: { type: Number, required: true },
        frequency: {
            type: String,
            required: true,
            enum: ['once', 'once_per_day', 'once_per_hour'],
            default: 'once',
        },
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        lastTriggeredAt: { type: Date, default: null },
        lastPrice: { type: Number, default: null },
    },
    { timestamps: false }
);

AlertSchema.index({ userId: 1, symbol: 1, alertName: 1 });

export const Alert = (models?.Alert as typeof models.Alert) || model<AlertItem>('Alert', AlertSchema);
