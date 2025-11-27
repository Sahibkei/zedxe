import { Schema, model, models } from 'mongoose';

export interface AlertItem {
    _id?: string;
    userId: string;
    symbol: string;
    alertName: string;
    condition: 'greater_than' | 'less_than' | 'crosses_above' | 'crosses_below';
    thresholdValue: number;
    frequency: 'once' | 'once_per_day' | 'once_per_hour';
    isActive: boolean;
    createdAt: Date;
    lastTriggeredAt?: Date | null;
}

const AlertSchema = new Schema<AlertItem>({
    userId: { type: String, required: true },
    symbol: { type: String, required: true },
    alertName: { type: String, required: true },
    condition: { type: String, required: true },
    thresholdValue: { type: Number, required: true },
    frequency: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    lastTriggeredAt: { type: Date, default: null },
});

export const Alert = models.Alert || model<AlertItem>('Alert', AlertSchema);
