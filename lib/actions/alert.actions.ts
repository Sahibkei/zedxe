'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Alert, type AlertItem } from '@/database/models/alert.model';

export type AlertDocument = AlertItem & { _id: string };

type AlertConditionValue = AlertItem['condition'];
type AlertFrequencyValue = AlertItem['frequency'];

export async function getAlertsByUser(userId: string): Promise<AlertDocument[]> {
    if (!userId) return [] as AlertDocument[];
    await connectToDatabase();
    const docs = await Alert.find({ userId }).sort({ createdAt: -1 }).lean<AlertDocument[]>();
    return docs;
}

export async function getAlertById(userId: string, alertId: string): Promise<AlertDocument | null> {
    if (!userId || !alertId) return null;
    await connectToDatabase();
    return await Alert.findOne({ _id: alertId, userId }).lean<AlertDocument | null>();
}

export async function upsertAlert(params: {
    alertId?: string;
    userId: string;
    symbol: string;
    alertName: string;
    condition: AlertConditionValue;
    thresholdValue: number;
    frequency: AlertFrequencyValue;
    isActive?: boolean;
}): Promise<AlertDocument | null> {
    const { alertId, userId, symbol, alertName, condition, thresholdValue, frequency, isActive = true } = params;
    if (!userId || !symbol || !alertName || !condition || thresholdValue === undefined || thresholdValue === null) {
        throw new Error('Missing required alert fields');
    }

    await connectToDatabase();
    const cleanSymbol = symbol.trim().toUpperCase();

    if (alertId) {
        return await Alert.findOneAndUpdate(
            { _id: alertId, userId },
            { alertName, condition, thresholdValue, frequency, isActive, symbol: cleanSymbol },
            { new: true }
        ).lean<AlertDocument | null>();
    }

    const created = await Alert.create({
        userId,
        symbol: cleanSymbol,
        alertName: alertName.trim(),
        condition,
        thresholdValue,
        frequency,
        isActive,
        createdAt: new Date(),
    });

    return created.toObject() as AlertDocument;
}

export async function toggleAlertActive(userId: string, alertId: string, isActive: boolean) {
    if (!userId || !alertId) throw new Error('Missing required fields');
    await connectToDatabase();
    return await Alert.findOneAndUpdate({ _id: alertId, userId }, { isActive }, { new: true }).lean<AlertDocument | null>();
}

export async function deleteAlert(userId: string, alertId: string) {
    if (!userId || !alertId) throw new Error('Missing required fields');
    await connectToDatabase();
    await Alert.deleteOne({ _id: alertId, userId });
}

export async function markAlertTriggered(alertId: string, deactivate: boolean) {
    await connectToDatabase();
    const update: Partial<AlertItem> = { lastTriggeredAt: new Date() };
    if (deactivate) {
        update.isActive = false;
    }
    await Alert.findByIdAndUpdate(alertId, update);
}

export async function getActiveAlerts(): Promise<AlertDocument[]> {
    await connectToDatabase();
    return Alert.find({ isActive: true }).lean<AlertDocument[]>();
}
