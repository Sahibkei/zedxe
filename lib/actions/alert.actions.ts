'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Alert, type AlertDocument } from '@/database/models/alert.model';

export async function getAlertsByUser(userId: string): Promise<AlertDocument[]> {
    if (!userId) return [];
    await connectToDatabase();
    return await Alert.find({ userId }).lean();
}

export async function getAlertById(userId: string, alertId: string): Promise<AlertDocument | null> {
    if (!userId || !alertId) return null;
    await connectToDatabase();
    return await Alert.findOne({ _id: alertId, userId }).lean();
}

export async function upsertAlert(params: {
    alertId?: string;
    userId: string;
    symbol: string;
    name?: string;
    condition: AlertDocument['condition'];
    thresholdValue: number;
    frequency: AlertDocument['frequency'];
    isActive?: boolean;
}) {
    const { alertId, userId, symbol, name, condition, thresholdValue, frequency, isActive = true } = params;
    if (!userId || !symbol || !condition || thresholdValue === undefined || thresholdValue === null) {
        throw new Error('Missing required alert fields');
    }

    await connectToDatabase();
    const cleanSymbol = symbol.toUpperCase();

    if (alertId) {
        return await Alert.findOneAndUpdate(
            { _id: alertId, userId },
            { name, condition, thresholdValue, frequency, isActive },
            { new: true }
        ).lean();
    }

    return await Alert.findOneAndUpdate(
        { userId, symbol: cleanSymbol, condition, thresholdValue },
        {
            name,
            frequency,
            isActive,
            lastTriggeredAt: null,
            symbol: cleanSymbol,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
}

export async function toggleAlertActive(userId: string, alertId: string, isActive: boolean) {
    if (!userId || !alertId) throw new Error('Missing required fields');
    await connectToDatabase();
    return await Alert.findOneAndUpdate({ _id: alertId, userId }, { isActive }, { new: true }).lean();
}

export async function deleteAlert(userId: string, alertId: string) {
    if (!userId || !alertId) throw new Error('Missing required fields');
    await connectToDatabase();
    await Alert.deleteOne({ _id: alertId, userId });
}

export async function markAlertTriggered(alertId: string, deactivate: boolean) {
    await connectToDatabase();
    const update: Partial<AlertDocument> = { lastTriggeredAt: new Date() };
    if (deactivate) {
        update.isActive = false;
    }
    await Alert.findByIdAndUpdate(alertId, update);
}
