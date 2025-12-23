import nodemailer from 'nodemailer';
import { createHash } from 'crypto';
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    WEEKLY_PORTFOLIO_EMAIL_TEMPLATE,
    PASSWORD_RESET_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";
import { formatPrice } from '@/lib/utils';

export class EmailConfigError extends Error {
    code = "email_not_configured";
    status = 500;

    constructor(message: string) {
        super(message);
        this.name = "EmailConfigError";
    }
}

type SmtpConfig = {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
};

let cachedTransporter: nodemailer.Transporter | null = null;
let cachedConfigError: EmailConfigError | null = null;

const getSmtpConfig = (): SmtpConfig => {
    const host = process.env.SMTP_HOST;
    const portValue = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM;

    if (!host || !portValue || !user || !pass || !from) {
        throw new EmailConfigError("SMTP configuration is missing");
    }

    const port = Number(portValue);
    if (!Number.isFinite(port)) {
        throw new EmailConfigError("SMTP port is invalid");
    }

    return { host, port, user, pass, from };
};

const getTransporter = () => {
    if (cachedTransporter) return cachedTransporter;
    if (cachedConfigError) throw cachedConfigError;

    try {
        const config = getSmtpConfig();
        cachedTransporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: config.pass,
            },
        });
        return cachedTransporter;
    } catch (error) {
        if (error instanceof EmailConfigError) {
            cachedConfigError = error;
        }
        throw error;
    }
};

const resolveRecipient = (email: string) => {
    return process.env.EMAIL_OVERRIDE_TO ?? email;
};

const getEmailHash = (email: string) => {
    return createHash("sha256").update(email.toLowerCase()).digest("hex");
};

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    const transporter = getTransporter();
    const smtpConfig = getSmtpConfig();
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: smtpConfig.from,
        to: resolveRecipient(email),
        subject: `Welcome to Signalist - your stock market toolkit is ready!`,
        text: 'Thanks for joining Signalist',
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}

export const sendNewsSummaryEmail = async (
    { email, date, newsContent, watchlistContent = '' }: { email: string; date: string; newsContent: string; watchlistContent?: string }
): Promise<void> => {
    const transporter = getTransporter();
    const smtpConfig = getSmtpConfig();
    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent)
        .replace('{{watchlistContent}}', watchlistContent || '');

    const mailOptions = {
        from: smtpConfig.from,
        to: resolveRecipient(email),
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
    const transporter = getTransporter();
    const smtpConfig = getSmtpConfig();
    const direction = params.condition === 'less_than' || params.condition === 'crosses_below' ? 'below' : 'above';
    const template = direction === 'above' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;

    const htmlTemplate = template
        .replace(/{{symbol}}/g, params.symbol)
        .replace(/{{company}}/g, params.company)
        .replace(/{{currentPrice}}/g, formatPrice(params.currentPrice))
        .replace(/{{targetPrice}}/g, formatPrice(params.thresholdValue))
        .replace(/{{timestamp}}/g, new Date().toLocaleString());

    const mailOptions = {
        from: smtpConfig.from,
        to: resolveRecipient(params.email),
        subject: `${params.symbol} alert: ${params.alertName}`,
        text: `${params.symbol} hit your ${params.alertName} target of ${params.thresholdValue}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendWeeklyReportEmail = async (params: { email: string; name: string; portfolioName: string; reportHtml: string }) => {
    const transporter = getTransporter();
    const smtpConfig = getSmtpConfig();
    const htmlTemplate = WEEKLY_PORTFOLIO_EMAIL_TEMPLATE
        .replace('{{name}}', params.name)
        .replace('{{portfolioName}}', params.portfolioName)
        .replace('{{reportContent}}', params.reportHtml || '');

    const mailOptions = {
        from: smtpConfig.from,
        to: resolveRecipient(params.email),
        subject: `📊 Weekly AI Report — ${params.portfolioName}`,
        text: `Weekly portfolio update for ${params.portfolioName}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (params: { email: string; url: string; requestId?: string }) => {
    const transporter = getTransporter();
    const smtpConfig = getSmtpConfig();
    const htmlTemplate = PASSWORD_RESET_EMAIL_TEMPLATE.replace(/{{resetUrl}}/g, params.url);
    const emailHash = getEmailHash(params.email);

    const mailOptions = {
        from: smtpConfig.from,
        to: resolveRecipient(params.email),
        subject: "Reset your Signalist password",
        text: `Reset your Signalist password: ${params.url}`,
        html: htmlTemplate,
    };

    const result = await transporter.sendMail(mailOptions);

    console.info("password-reset-email-sent", {
        requestId: params.requestId ?? "unknown",
        emailHash,
        messageId: result.messageId ?? "unknown",
        providerResponse: result.response ?? "unknown",
        overrideEnabled: Boolean(process.env.EMAIL_OVERRIDE_TO),
    });
};
