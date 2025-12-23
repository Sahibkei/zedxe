import nodemailer from 'nodemailer';
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    WEEKLY_PORTFOLIO_EMAIL_TEMPLATE,
    PASSWORD_RESET_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";
import { formatPrice } from '@/lib/utils';

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedFrom: string | null = null;
let isVerified = false;

const getGmailConfig = () => {
    const user = process.env.NODEMAILER_EMAIL?.trim();
    const pass = process.env.NODEMAILER_PASSWORD?.trim();

    if (!user || !pass) {
        throw new Error("Missing NODEMAILER_EMAIL/NODEMAILER_PASSWORD");
    }

    const from = process.env.NODEMAILER_FROM ?? `ZedXe <${user}>`;
    return { user, pass, from };
};

const getTransporter = async () => {
    if (cachedTransporter) return cachedTransporter;
    const config = getGmailConfig();
    cachedFrom = config.from;
    cachedTransporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: config.user,
            pass: config.pass,
        },
    });
    return cachedTransporter;
};

const ensureVerified = async () => {
    const transporter = await getTransporter();
    if (isVerified) return transporter;
    try {
        await transporter.verify();
        isVerified = true;
        return transporter;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`SMTP verify failed: ${message}`);
    }
};

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    const transporter = await ensureVerified();
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: cachedFrom ?? `ZedXe <${process.env.NODEMAILER_EMAIL ?? ""}>`,
        to: email,
        subject: `Welcome to Signalist - your stock market toolkit is ready!`,
        text: 'Thanks for joining Signalist',
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent, watchlistContent = '' }: { email: string; date: string; newsContent: string; watchlistContent?: string }
): Promise<void> => {
    const transporter = await ensureVerified();
    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent)
        .replace('{{watchlistContent}}', watchlistContent || '');

    const mailOptions = {
        from: cachedFrom ?? `ZedXe <${process.env.NODEMAILER_EMAIL ?? ""}>`,
        to: email,
        subject: `📈 Market News Summary Today - ${date}`,
        text: `Today's market news summary from Signalist`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendPriceAlertEmail = async (
    params: {
        email: string;
        alertName: string;
        symbol: string;
        company: string;
        currentPrice: number;
        thresholdValue: number;
        condition: AlertCondition;
    }
) => {
    const transporter = await ensureVerified();
    const direction = params.condition === 'less_than' || params.condition === 'crosses_below' ? 'below' : 'above';
    const template = direction === 'above' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;

    const htmlTemplate = template
        .replace(/{{symbol}}/g, params.symbol)
        .replace(/{{company}}/g, params.company)
        .replace(/{{currentPrice}}/g, formatPrice(params.currentPrice))
        .replace(/{{targetPrice}}/g, formatPrice(params.thresholdValue))
        .replace(/{{timestamp}}/g, new Date().toLocaleString());

    const mailOptions = {
        from: cachedFrom ?? `ZedXe <${process.env.NODEMAILER_EMAIL ?? ""}>`,
        to: params.email,
        subject: `${params.symbol} alert: ${params.alertName}`,
        text: `${params.symbol} hit your ${params.alertName} target of ${params.thresholdValue}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendWeeklyReportEmail = async (params: { email: string; name: string; portfolioName: string; reportHtml: string }) => {
    const transporter = await ensureVerified();
    const htmlTemplate = WEEKLY_PORTFOLIO_EMAIL_TEMPLATE
        .replace('{{name}}', params.name)
        .replace('{{portfolioName}}', params.portfolioName)
        .replace('{{reportContent}}', params.reportHtml || '');

    const mailOptions = {
        from: cachedFrom ?? `ZedXe <${process.env.NODEMAILER_EMAIL ?? ""}>`,
        to: params.email,
        subject: `📊 Weekly AI Report — ${params.portfolioName}`,
        text: `Weekly portfolio update for ${params.portfolioName}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (params: { to: string; resetUrl: string; requestId: string }) => {
    console.info("password_reset_email_send_attempt", { requestId: params.requestId });
    const transporter = await ensureVerified();
    const htmlTemplate = PASSWORD_RESET_EMAIL_TEMPLATE.replace(/{{resetUrl}}/g, params.resetUrl);

    const mailOptions = {
        from: cachedFrom ?? `ZedXe <${process.env.NODEMAILER_EMAIL ?? ""}>`,
        to: params.to,
        subject: "Reset your Signalist password",
        text: `Reset your Signalist password: ${params.resetUrl}`,
        html: htmlTemplate,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.info("password_reset_email_sent", { requestId: params.requestId });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("password_reset_email_failed", { requestId: params.requestId, error: message });
        throw error;
    }
};
