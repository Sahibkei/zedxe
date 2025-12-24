'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { Alert, type AlertItem } from '@/database/models/alert.model';
import { connectToDatabase } from '@/database/mongoose';
import { auth } from '@/lib/better-auth/auth';

export const normalizeAlert = (alert: AlertItem): AlertDisplay => ({
    id: String(alert._id),
    userId: alert.userId,
    symbol: alert.symbol,
    company: alert.company,
    alertName: alert.alertName,
    condition: alert.condition,
    thresholdValue: alert.thresholdValue,
    frequency: alert.frequency,
    isActive: alert.isActive,
    createdAt: alert.createdAt,
    lastTriggeredAt: alert.lastTriggeredAt ?? null,
    lastPrice: alert.lastPrice ?? null,
});

export async function getAlertsByUser(userId: string): Promise<AlertItem[]> {
    if (!userId) return [];
    await connectToDatabase();
    return Alert.find({ userId }).sort({ createdAt: -1 }).lean();
}

export async function getAlertsForCurrentUser(): Promise<AlertDisplay[]> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return redirect('/sign-in');

    const alerts = await getAlertsByUser(session.user.id);
    return alerts.map(normalizeAlert);
}

export async function upsertAlert(params: {
    alertId?: string;
    userId: string;
    symbol: string;
    company: string;
    alertName: string;
    condition: AlertCondition;
    thresholdValue: number;
    frequency: AlertFrequency;
    isActive?: boolean;
}) {
    const { alertId, userId, symbol, company, alertName, condition, thresholdValue, frequency, isActive = true } = params;
    if (!userId || !symbol || !company || !alertName || !condition || thresholdValue === undefined || thresholdValue === null) {
        throw new Error('Missing required alert fields');
    }

    await connectToDatabase();
    const cleanSymbol = symbol.toUpperCase();

    if (alertId) {
        return Alert.findOneAndUpdate(
            { _id: alertId, userId },
            { alertName, condition, thresholdValue, frequency, isActive, company, symbol: cleanSymbol },
            { new: true }
        ).lean();
    }

    return Alert.create({
        userId,
        symbol: cleanSymbol,
        company,
        alertName,
        condition,
        thresholdValue,
        frequency,
        isActive,
    });
}

export async function saveAlertForCurrentUser(input: Omit<Parameters<typeof upsertAlert>[0], 'userId'>) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return redirect('/sign-in');

    const alert = await upsertAlert({ ...input, userId: session.user.id });
    revalidatePath('/watchlist');
    return alert ? normalizeAlert(alert as AlertItem) : null;
}

export async function toggleAlertActive(userId: string, alertId: string, isActive: boolean) {
    if (!userId || !alertId) throw new Error('Missing required fields');
    await connectToDatabase();
    return Alert.findOneAndUpdate({ _id: alertId, userId }, { isActive }, { new: true }).lean();
}

export async function toggleAlertForCurrentUser(alertId: string, isActive: boolean) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return redirect('/sign-in');

    const alert = await toggleAlertActive(session.user.id, alertId, isActive);
    revalidatePath('/watchlist');
    return alert ? normalizeAlert(alert as AlertItem) : null;
}

export async function deleteAlert(userId: string, alertId: string) {
    if (!userId || !alertId) throw new Error('Missing required fields');
    await connectToDatabase();
    await Alert.deleteOne({ _id: alertId, userId });
}

export async function deleteAlertForCurrentUser(alertId: string) {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return redirect('/sign-in');

    await deleteAlert(session.user.id, alertId);
    revalidatePath('/watchlist');
}

export async function markAlertTriggered(alertId: string, deactivate: boolean, lastPrice?: number | null) {
    await connectToDatabase();
    const update: Partial<AlertItem> = { lastTriggeredAt: new Date() };
    if (deactivate) update.isActive = false;
    if (lastPrice !== undefined) update.lastPrice = lastPrice;
    await Alert.findByIdAndUpdate(alertId, update);
}

export async function updateAlertLastPrice(alertId: string, lastPrice?: number | null) {
    await connectToDatabase();
    await Alert.findByIdAndUpdate(alertId, { lastPrice });
}

export async function getActiveAlerts(): Promise<AlertItem[]> {
    await connectToDatabase();
    return Alert.find({ isActive: true }).lean();
}
