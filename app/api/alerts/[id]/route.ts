import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/better-auth/auth';
import { deleteAlert, toggleAlertActive, upsertAlert } from '@/lib/actions/alert.actions';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { symbol, name, condition, thresholdValue, frequency, isActive = true } = body ?? {};
        if (!symbol || !condition || typeof thresholdValue !== 'number') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const alert = await upsertAlert({
            alertId: params.id,
            userId: session.user.id,
            symbol,
            name,
            condition,
            thresholdValue,
            frequency: frequency ?? 'once_per_day',
            isActive,
        });

        return NextResponse.json({ data: alert });
    } catch (err) {
        console.error('PUT /api/alerts/[id] error', err);
        return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { isActive } = body ?? {};
        if (typeof isActive !== 'boolean') return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

        const updated = await toggleAlertActive(session.user.id, params.id, isActive);
        return NextResponse.json({ data: updated });
    } catch (err) {
        console.error('PATCH /api/alerts/[id] error', err);
        return NextResponse.json({ error: 'Failed to toggle alert' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        await deleteAlert(session.user.id, params.id);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/alerts/[id] error', err);
        return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
    }
}
