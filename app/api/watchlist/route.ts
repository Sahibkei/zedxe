import { NextRequest, NextResponse } from 'next/server';
import { addToWatchlist, getWatchlistWithData } from '@/lib/actions/watchlist.actions';
import { auth } from '@/lib/better-auth/auth';

export async function GET(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const watchlist = await getWatchlistWithData(session.user.id);
    return NextResponse.json({ data: watchlist });
}

export async function POST(request: NextRequest) {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { symbol, company } = body ?? {};
        if (!symbol) return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });

        const item = await addToWatchlist({ userId: session.user.id, symbol, company });
        const watchlist = await getWatchlistWithData(session.user.id);
        return NextResponse.json({ data: item, watchlist });
    } catch (err) {
        console.error('POST /api/watchlist error', err);
        return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
    }
}
