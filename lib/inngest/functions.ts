import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT, WATCHLIST_SUMMARY_EMAIL_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendPriceAlertEmail, sendWelcomeEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail, getUserById} from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail, getWatchlistItemsByUserId } from "@/lib/actions/watchlist.actions";
import { getNews, getSnapshotsForSymbols, getSymbolSnapshot } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { getActiveAlerts, getAlertsByUser, markAlertTriggered } from "@/lib/actions/alert.actions";

export const sendSignUpEmail = inngest.createFunction(
    { id: 'sign-up-email' },
    { event: 'app/user.created'},
    async ({ event, step }) => {
        const userProfile = `
            - Country: ${event.data.country}
            - Investment goals: ${event.data.investmentGoals}
            - Risk tolerance: ${event.data.riskTolerance}
            - Preferred industry: ${event.data.preferredIndustry}
        `

        const prompt = PERSONALIZED_WELCOME_EMAIL_PROMPT.replace('{{userProfile}}', userProfile)

        const response = await step.ai.infer('generate-welcome-intro', {
            model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
            body: {
                contents: [
                    {
                        role: 'user',
                        parts: [
                            { text: prompt }
                        ]
                    }]
            }
        })

        await step.run('send-welcome-email', async () => {
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const introText = (part && 'text' in part ? part.text : null) ||'Thanks for joining Signalist. You now have the tools to track markets and make smarter moves.'

            const { data: { email, name } } = event;

            return await sendWelcomeEmail({ email, name, intro: introText });
        })

        return {
            success: true,
            message: 'Welcome email sent successfully'
        }
    }
)

export const sendDailyNewsSummary = inngest.createFunction(
    { id: 'daily-news-summary' },
    [ { event: 'app/send.daily.news' }, { cron: '0 12 * * *' } ],
    async ({ step }) => {
        const today = new Date();
        const users = await step.run('get-all-users', getAllUsersForNewsEmail);
        if (!users || users.length === 0) return { success: false, message: 'No users found for news email' };

        type BasicAlert = {
            condition: AlertCondition;
            thresholdValue: number;
            isActive: boolean;
            frequency: AlertFrequency;
            lastTriggeredAt?: Date | null;
            symbol: string;
            id?: string;
            _id?: unknown;
            alertName?: string;
        };

        const isSameDay = (a?: Date | string | null, b?: Date) => {
            if (!a || !b) return false;
            const d1 = new Date(a);
            return d1.getUTCFullYear() === b.getUTCFullYear() && d1.getUTCMonth() === b.getUTCMonth() && d1.getUTCDate() === b.getUTCDate();
        };

        const isSameHour = (a?: Date | string | null, b?: Date) => {
            if (!a || !b) return false;
            const d1 = new Date(a);
            return (
                d1.getUTCFullYear() === b.getUTCFullYear() &&
                d1.getUTCMonth() === b.getUTCMonth() &&
                d1.getUTCDate() === b.getUTCDate() &&
                d1.getUTCHours() === b.getUTCHours()
            );
        };

        const evaluateAlert = (alert: BasicAlert, price?: number) => {
            if (price === undefined || price === null) return { triggered: false, near: false };
            let conditionMet = false;
            switch (alert.condition) {
            case 'greater_than':
                conditionMet = price > alert.thresholdValue;
                break;
            case 'less_than':
                conditionMet = price < alert.thresholdValue;
                break;
            case 'crosses_above':
                conditionMet = price > alert.thresholdValue;
                break;
            case 'crosses_below':
                conditionMet = price < alert.thresholdValue;
                break;
            default:
                conditionMet = false;
            }

            const near = !conditionMet && Math.abs(price - alert.thresholdValue) / Math.max(alert.thresholdValue, 1) <= 0.02;
            return { triggered: conditionMet, near };
        };

        const buildWatchlistSection = async (user: UserForNewsEmail) => {
            const watchlist = await getWatchlistItemsByUserId(user.id);
            if (!watchlist || watchlist.length === 0) return '';

            const symbols = watchlist.map((item) => item.symbol);
            let snapshots: Record<string, Awaited<ReturnType<typeof getSymbolSnapshot>>> = {};
            try {
                snapshots = await getSnapshotsForSymbols(symbols);
            } catch (err) {
                console.error('watchlist summary: snapshot error', user.email, err);
                snapshots = {};
            }
            const alerts = await getAlertsByUser(user.id);

            const triggeredAlerts: { symbol: string; thresholdValue: number; condition: AlertCondition }[] = [];
            const nearAlerts: { symbol: string; thresholdValue: number; condition: AlertCondition }[] = [];

            for (const alert of alerts) {
                const price = snapshots[alert.symbol]?.currentPrice;
                const { triggered, near } = evaluateAlert(alert, price);
                const alreadyTriggered = alert.frequency === 'once'
                    ? !!alert.lastTriggeredAt
                    : alert.frequency === 'once_per_hour'
                        ? isSameHour(alert.lastTriggeredAt, today)
                        : isSameDay(alert.lastTriggeredAt, today);

                if (alert.isActive && triggered && !alreadyTriggered) {
                    const alertId = alert._id || alert.id;
                    triggeredAlerts.push({ symbol: alert.symbol, thresholdValue: alert.thresholdValue, condition: alert.condition });
                    if (alertId) {
                        await markAlertTriggered(String(alertId), alert.frequency === 'once');
                    }
                } else if (near) {
                    nearAlerts.push({ symbol: alert.symbol, thresholdValue: alert.thresholdValue, condition: alert.condition });
                }
            }

            const payload = {
                items: watchlist.map((item) => ({
                    symbol: item.symbol,
                    company: item.company,
                    price: snapshots[item.symbol]?.currentPrice,
                    changePercent: snapshots[item.symbol]?.changePercent,
                    marketCap: snapshots[item.symbol]?.marketCap,
                    alerts: alerts
                        .filter((alert) => alert.symbol === item.symbol)
                        .map((alert) => ({
                            name: (alert as { alertName?: string; name?: string }).alertName || (alert as { name?: string }).name,
                            condition: alert.condition,
                            thresholdValue: alert.thresholdValue,
                            isActive: alert.isActive,
                        })),
                })),
                triggeredAlerts,
                nearAlerts,
            };

            const prompt = WATCHLIST_SUMMARY_EMAIL_PROMPT.replace('{{watchlistData}}', JSON.stringify(payload, null, 2));
            const response = await step.ai.infer(`watchlist-summary-${user.email}`, {
                model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                body: { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
            });
            const part = response.candidates?.[0]?.content?.parts?.[0];
            const summary = (part && 'text' in part ? part.text : null) || '';

            const alertsHtml = triggeredAlerts.length
                ? `<div style="margin-top:16px;">` +
                `<h3 style="color:#FDD458; margin:0 0 8px 0; font-size:16px;">Alerts</h3>` +
                `<ul style="margin:0; padding-left:18px; color:#CCDADC; font-size:14px;">` +
                triggeredAlerts
                    .map((a) => `<li>${a.symbol} crossed ${a.condition.replace('_', ' ')} ${a.thresholdValue}</li>`)
                    .join('') +
                `</ul>` +
                `</div>`
                : '';

            return summary ? `<div style="margin-top:32px;">${summary}${alertsHtml}</div>` : '';
        };

        for (const user of users as UserForNewsEmail[]) {
            try {
                const symbols = await getWatchlistSymbolsByEmail(user.email);
                let articles = await getNews(symbols);
                articles = (articles || []).slice(0, 6);
                if (!articles || articles.length === 0) {
                    articles = await getNews();
                    articles = (articles || []).slice(0, 6);
                }

                const prompt = NEWS_SUMMARY_EMAIL_PROMPT.replace('{{newsData}}', JSON.stringify(articles, null, 2));
                const response = await step.ai.infer(`summarize-news-${user.email}`, {
                    model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                    body: { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
                });

                const part = response.candidates?.[0]?.content?.parts?.[0];
                const newsContent = (part && 'text' in part ? part.text : null) || 'No market news.';
                const watchlistContent = await buildWatchlistSection(user);

                await sendNewsSummaryEmail({
                    email: user.email,
                    date: getFormattedTodayDate(),
                    newsContent,
                    watchlistContent,
                });
            } catch (e) {
                console.error('daily-news: failed for user', user.email, e);
            }
        }

        return { success: true, message: 'Daily news summary emails sent successfully' };
    }
)
export const processPriceAlerts = inngest.createFunction(
    { id: 'process-price-alerts' },
    [{ event: 'app/alerts.check' }, { cron: '0 * * * *' }],
    async ({ step }) => {
        const alerts = await step.run('get-active-alerts', getActiveAlerts);
        if (!alerts || alerts.length === 0) return { processed: 0, sent: 0 };

        const activeAlerts = alerts.filter((alert) => alert.isActive && alert.symbol);
        const symbols = Array.from(new Set(activeAlerts.map((a) => a.symbol.toUpperCase())));
        const snapshots = await step.run('load-alert-snapshots', () => getSnapshotsForSymbols(symbols));

        const isSameDay = (last?: Date | string | null) => {
            if (!last) return false;
            const d1 = new Date(last);
            const now = new Date();
            return d1.getUTCFullYear() === now.getUTCFullYear() && d1.getUTCMonth() === now.getUTCMonth() && d1.getUTCDate() === now.getUTCDate();
        };

        const isSameHour = (last?: Date | string | null) => {
            if (!last) return false;
            const d1 = new Date(last);
            const now = new Date();
            return (
                d1.getUTCFullYear() === now.getUTCFullYear() &&
                d1.getUTCMonth() === now.getUTCMonth() &&
                d1.getUTCDate() === now.getUTCDate() &&
                d1.getUTCHours() === now.getUTCHours()
            );
        };

        const shouldThrottle = (alert: Awaited<typeof activeAlerts[number]>) => {
            if (!alert.lastTriggeredAt) return false;
            switch (alert.frequency) {
            case 'once':
                return true;
            case 'once_per_day':
                return isSameDay(alert.lastTriggeredAt);
            case 'once_per_hour':
                return isSameHour(alert.lastTriggeredAt);
            default:
                return false;
            }
        };

        const conditionMet = (alert: Awaited<typeof activeAlerts[number]>, price?: number) => {
            if (price === undefined || price === null) return false;
            switch (alert.condition) {
            case 'greater_than':
                return price > alert.thresholdValue;
            case 'less_than':
                return price < alert.thresholdValue;
            case 'crosses_above':
                return price > alert.thresholdValue;
            case 'crosses_below':
                return price < alert.thresholdValue;
            default:
                return false;
            }
        };

        let sent = 0;

        for (const alert of activeAlerts) {
            const symbol = alert.symbol.toUpperCase();
            const snapshot = snapshots?.[symbol] || (await step.run(`fallback-snapshot-${symbol}`, () => getSymbolSnapshot(symbol).catch(() => null)));
            const price = snapshot?.currentPrice;

            if (!conditionMet(alert, price) || shouldThrottle(alert)) continue;

            const user = await step.run(`user-${alert.userId}`, () => getUserById(alert.userId));
            if (!user?.email) continue;

            await step.run(`send-alert-email-${alert._id}`, () =>
                sendPriceAlertEmail({
                    email: user.email,
                    name: user.name,
                    symbol,
                    company: snapshot?.company || symbol,
                    currentPrice: price as number,
                    targetPrice: alert.thresholdValue,
                    condition: alert.condition,
                    alertName: alert.alertName,
                })
            );

            await step.run(`mark-alert-${alert._id}`, () => markAlertTriggered(String(alert._id), alert.frequency === 'once'));
            sent += 1;
        }

        return { processed: activeAlerts.length, sent };
    }
);
