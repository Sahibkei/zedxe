import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/lib/better-auth/auth';
import { deleteAlertForCurrentUser, getAlertsForCurrentUser, saveAlertForCurrentUser, toggleAlertForCurrentUser } from '@/lib/actions/alert.actions';

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const alerts = await getAlertsForCurrentUser();
    return NextResponse.json({ data: alerts });
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { id, alertName, company, symbol, condition, thresholdValue, frequency, isActive = true } = body ?? {};

        if (!symbol || !company || !alertName || !condition || typeof thresholdValue !== 'number') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const alert = await saveAlertForCurrentUser({
            alertId: id,
            company,
            symbol,
            alertName,
            condition,
            thresholdValue,
            frequency: frequency ?? 'once_per_day',
            isActive,
        });

        const alerts = await getAlertsForCurrentUser();
        return NextResponse.json({ data: alert, alerts });
    } catch (err) {
        console.error('POST /api/alerts error', err);
        return NextResponse.json({ error: 'Failed to save alert' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { id, isActive } = body ?? {};

    if (!id || typeof isActive !== 'boolean') {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const alert = await toggleAlertForCurrentUser(id, isActive);
    const alerts = await getAlertsForCurrentUser();
    return NextResponse.json({ data: alert, alerts });
}

export async function DELETE(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    await deleteAlertForCurrentUser(id);
    const alerts = await getAlertsForCurrentUser();
    return NextResponse.json({ data: { id }, alerts });
}
