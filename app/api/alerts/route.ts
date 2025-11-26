import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { getAlertsByUser, upsertAlert } from '@/lib/actions/alert.actions';

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const alerts = await getAlertsByUser(session.user.id);
    return NextResponse.json({ data: alerts.map((a) => ({ ...a, id: String(a._id) })) });
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, symbol, name, condition, thresholdValue, frequency, isActive = true } = body ?? {};

        if (!symbol || !condition || typeof thresholdValue !== 'number') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const alert = await upsertAlert({
            alertId: id,
            userId: session.user.id,
            symbol,
            name,
            condition,
            thresholdValue,
            frequency: frequency ?? 'once_per_day',
            isActive,
        });

        const alerts = await getAlertsByUser(session.user.id);
        return NextResponse.json({ data: alert, alerts: alerts.map((a) => ({ ...a, id: String(a._id) })) });
    } catch (err) {
        console.error('POST /api/alerts error', err);
        return NextResponse.json({ error: 'Failed to save alert' }, { status: 500 });
    }
}
