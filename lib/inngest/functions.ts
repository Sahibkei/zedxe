import {inngest} from "@/lib/inngest/client";
import {NEWS_SUMMARY_EMAIL_PROMPT, PERSONALIZED_WELCOME_EMAIL_PROMPT, WATCHLIST_SUMMARY_EMAIL_PROMPT, WEEKLY_PORTFOLIO_REPORT_PROMPT} from "@/lib/inngest/prompts";
import {sendNewsSummaryEmail, sendWelcomeEmail, sendPriceAlertEmail, sendWeeklyReportEmail} from "@/lib/nodemailer";
import {getAllUsersForNewsEmail, getUserById} from "@/lib/actions/user.actions";
import { getWatchlistSymbolsByEmail, getWatchlistItemsByUserId } from "@/lib/actions/watchlist.actions";
import { getNews, getSnapshotsForSymbols, getStocksDetails } from "@/lib/actions/finnhub.actions";
import { getFormattedTodayDate } from "@/lib/utils";
import { getActiveAlerts, getAlertsByUser, markAlertTriggered, updateAlertLastPrice } from "@/lib/actions/alert.actions";
import { connectToDatabase } from '@/database/mongoose';
import { Portfolio } from '@/database/models/portfolio.model';
import { getPortfolioPerformanceSeries, getPortfolioSummary } from '@/lib/portfolio/portfolio-service';

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
                conditionMet = price >= alert.thresholdValue;
                break;
            case 'crosses_below':
                conditionMet = price <= alert.thresholdValue;
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
                const lastTriggered = alert.lastTriggeredAt ? new Date(alert.lastTriggeredAt) : null;
                const alreadyTriggered = alert.frequency === 'once'
                    ? !!lastTriggered
                    : alert.frequency === 'once_per_hour'
                        ? !!(lastTriggered && Date.now() - lastTriggered.getTime() < 60 * 60 * 1000)
                        : isSameDay(lastTriggered || undefined, today);

                if (alert.isActive && triggered && !alreadyTriggered) {
                    const alertId = alert._id || alert.id;
                    triggeredAlerts.push({ symbol: alert.symbol, thresholdValue: alert.thresholdValue, condition: alert.condition });
                    if (alertId) {
                        await markAlertTriggered(String(alertId), alert.frequency === 'once', price);
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
                            name: alert.alertName,
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
    [{ event: 'app/check.price.alerts' }, { cron: '0 * * * *' }],
    async ({ step }) => {
        const alerts = await step.run('fetch-active-alerts', getActiveAlerts);
        if (!alerts || alerts.length === 0) return { success: true, message: 'No active alerts' };

        const priceCache: Record<string, Awaited<ReturnType<typeof getStocksDetails>>> = {};
        const userCache: Record<string, UserForNewsEmail | null> = {};
        const now = new Date();

        const hasCooldown = (frequency: AlertFrequency, lastTriggeredAt?: Date | string | null) => {
            if (!lastTriggeredAt) return false;
            const last = new Date(lastTriggeredAt);
            if (frequency === 'once') return true;
            if (frequency === 'once_per_hour') return Date.now() - last.getTime() < 60 * 60 * 1000;
            return last.getUTCFullYear() === now.getUTCFullYear() && last.getUTCMonth() === now.getUTCMonth() && last.getUTCDate() === now.getUTCDate();
        };

        for (const alert of alerts) {
            await step.run(`process-alert-${alert._id}`, async () => {
                if (!priceCache[alert.symbol]) {
                    priceCache[alert.symbol] = await getStocksDetails(alert.symbol);
                }
                const details = priceCache[alert.symbol];
                const currentPrice = details.currentPrice;
                if (currentPrice === undefined || currentPrice === null) return;

                const lastPrice = alert.lastPrice ?? null;
                const crossedAbove = lastPrice !== null ? lastPrice < alert.thresholdValue && currentPrice >= alert.thresholdValue : false;
                const crossedBelow = lastPrice !== null ? lastPrice > alert.thresholdValue && currentPrice <= alert.thresholdValue : false;

                let conditionMet = false;
                switch (alert.condition) {
                case 'greater_than':
                    conditionMet = currentPrice > alert.thresholdValue;
                    break;
                case 'less_than':
                    conditionMet = currentPrice < alert.thresholdValue;
                    break;
                case 'crosses_above':
                    conditionMet = crossedAbove;
                    break;
                case 'crosses_below':
                    conditionMet = crossedBelow;
                    break;
                default:
                    conditionMet = false;
                }

                const onCooldown = hasCooldown(alert.frequency as AlertFrequency, alert.lastTriggeredAt);
                await updateAlertLastPrice(String(alert._id), currentPrice);

                if (!alert.isActive || !conditionMet || onCooldown) return;

                if (!userCache[alert.userId]) {
                    userCache[alert.userId] = await getUserById(alert.userId);
                }
                const user = userCache[alert.userId];
                if (!user?.email) return;

                await sendPriceAlertEmail({
                    email: user.email,
                    alertName: alert.alertName,
                    symbol: alert.symbol,
                    company: alert.company,
                    currentPrice,
                    thresholdValue: alert.thresholdValue,
                    condition: alert.condition,
                });

                await markAlertTriggered(String(alert._id), alert.frequency === 'once', currentPrice);
            });
        }

        return { success: true, message: `Processed ${alerts.length} alerts` };
    }
);

export const sendWeeklyPortfolioReport = inngest.createFunction(
    { id: 'weekly-portfolio-report' },
    { cron: '0 14 * * MON' },
    async ({ step }) => {
        const portfolios = await step.run('fetch-weekly-portfolios', async () => {
            await connectToDatabase();
            return Portfolio.find({ weeklyReportEnabled: true }).lean();
        });

        if (!portfolios || portfolios.length === 0) {
            return { success: true, processed: 0 };
        }

        const weeklyPortfolios = portfolios as { _id: unknown; userId: string }[];

        const results = await step.forEach(
            'process-weekly-portfolios',
            weeklyPortfolios,
            async (portfolio, { step }) => {
                const portfolioId = String((portfolio as { _id: unknown })._id);
                const userId = (portfolio as { userId: string }).userId;

                const user = await step.run('load-user', async () => getUserById(userId));
                if (!user?.email) return { portfolioId, status: 'skipped', reason: 'missing-user' } as const;

                const summary = await step.run('load-portfolio-summary', async () => {
                    try {
                        return await getPortfolioSummary(user.id, portfolioId);
                    } catch (error) {
                        console.error('weekly report summary error', portfolioId, error);
                        return null;
                    }
                });
                if (!summary) return { portfolioId, status: 'skipped', reason: 'summary-error' } as const;

                const performance = await step.run('load-portfolio-performance', async () => {
                    try {
                        return await getPortfolioPerformanceSeries(user.id, portfolioId, '3M', { allowFallbackFlatSeries: true });
                    } catch (error) {
                        console.error('weekly report performance error', portfolioId, error);
                        return [] as Awaited<ReturnType<typeof getPortfolioPerformanceSeries>>;
                    }
                });

                const topPositions = [...(summary.positions || [])]
                    .sort((a, b) => b.currentValue - a.currentValue)
                    .slice(0, 5)
                    .map((p) => ({
                        symbol: p.symbol,
                        weightPct: p.weightPct,
                        pnlPct: p.pnlPct,
                        currentValue: p.currentValue,
                    }));

                const perfChange =
                    performance.length >= 2 && performance[0].value !== 0
                        ? performance[performance.length - 1].value / performance[0].value - 1
                        : null;

                let biggestDailyMove: number | null = null;
                for (let i = 1; i < performance.length; i++) {
                    const prev = performance[i - 1].value;
                    const curr = performance[i].value;
                    if (prev === 0) continue;
                    const move = curr / prev - 1;
                    if (biggestDailyMove === null || Math.abs(move) > Math.abs(biggestDailyMove)) {
                        biggestDailyMove = move;
                    }
                }

                const reportData = {
                    baseCurrency: summary.portfolio.baseCurrency,
                    totals: summary.totals,
                    ratios: summary.ratios,
                    performance: {
                        startDate: performance[0]?.date,
                        endDate: performance.at(-1)?.date,
                        changePct: perfChange,
                        biggestDailyMove,
                    },
                    topPositions,
                };

                const prompt = WEEKLY_PORTFOLIO_REPORT_PROMPT
                    .replace('{{portfolioName}}', summary.portfolio.name)
                    .replace('{{portfolioData}}', JSON.stringify(reportData, null, 2));

                const response = await step.ai.infer(`weekly-report-${portfolioId}`, {
                    model: step.ai.models.gemini({ model: 'gemini-2.5-flash-lite' }),
                    body: { contents: [{ role: 'user', parts: [{ text: prompt }] }] },
                });

                const part = response.candidates?.[0]?.content?.parts?.[0];
                const reportContent =
                    (part && 'text' in part ? (part as { text?: string }).text : null) ||
                    '<p class="mobile-text dark-text-secondary" style="margin:0; font-size:15px; line-height:1.6; color:#CCDADC;">We could not generate a detailed summary this week, but your portfolio is being tracked.</p>';

                await step.run('send-weekly-report-email', async () => {
                    await sendWeeklyReportEmail({
                        email: user.email,
                        name: user.name,
                        portfolioName: summary.portfolio.name,
                        reportHtml: reportContent,
                    });
                });

                return { portfolioId, status: 'sent' } as const;
            },
        );

        const sent = results.filter((r) => r.status === 'sent').length;
        const skipped = results.length - sent;

        return { success: true, processed: results.length, sent, skipped };
    }
);
