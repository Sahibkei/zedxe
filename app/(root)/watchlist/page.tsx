import WatchlistClient from "./WatchlistClient";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getWatchlistWithData } from "@/lib/actions/watchlist.actions";
import { getAlertsByUser } from "@/lib/actions/alert.actions";

const WatchlistPage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    const [watchlist, alerts] = await Promise.all([
        getWatchlistWithData(session.user.id),
        getAlertsByUser(session.user.id),
    ]);

    const formattedAlerts: AlertDisplay[] = alerts.map((alert) => ({
        id: String(alert._id),
        userId: alert.userId,
        symbol: alert.symbol,
        name: alert.name,
        condition: alert.condition,
        thresholdValue: alert.thresholdValue,
        frequency: alert.frequency,
        isActive: alert.isActive,
        lastTriggeredAt: alert.lastTriggeredAt || null,
    }));

    return <WatchlistClient initialWatchlist={watchlist} initialAlerts={formattedAlerts} />;
};

export default WatchlistPage;
