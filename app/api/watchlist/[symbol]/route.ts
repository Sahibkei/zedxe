import { NextRequest, NextResponse } from 'next/server';
import { removeFromWatchlist } from '@/lib/actions/watchlist.actions';
import { auth } from '@/lib/better-auth/auth';

export async function DELETE(request: NextRequest, { params }: { params: { symbol: string } }) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const symbol = params.symbol;
    if (!symbol) return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });

    try {
        await removeFromWatchlist(session.user.id, symbol);
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('DELETE /api/watchlist/[symbol] error', err);
        return NextResponse.json({ error: 'Failed to remove symbol' }, { status: 500 });
    }
}
