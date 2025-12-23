import nodemailer from 'nodemailer';
import {
    WELCOME_EMAIL_TEMPLATE,
    NEWS_SUMMARY_EMAIL_TEMPLATE,
    STOCK_ALERT_LOWER_EMAIL_TEMPLATE,
    STOCK_ALERT_UPPER_EMAIL_TEMPLATE,
    WEEKLY_PORTFOLIO_EMAIL_TEMPLATE,
} from "@/lib/nodemailer/templates";
import { formatPrice } from '@/lib/utils';

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIL!,
        pass: process.env.NODEMAILER_PASSWORD!,
    }
})

export const sendWelcomeEmail = async ({ email, name, intro }: WelcomeEmailData) => {
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: `"Signalist" <sahibkalersingh@gmail.com>`,
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
    const htmlTemplate = NEWS_SUMMARY_EMAIL_TEMPLATE
        .replace('{{date}}', date)
        .replace('{{newsContent}}', newsContent)
        .replace('{{watchlistContent}}', watchlistContent || '');

    const mailOptions = {
        from: `"Signalist News" <sahibkalersingh@gmail.com>`,
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
    const direction = params.condition === 'less_than' || params.condition === 'crosses_below' ? 'below' : 'above';
    const template = direction === 'above' ? STOCK_ALERT_UPPER_EMAIL_TEMPLATE : STOCK_ALERT_LOWER_EMAIL_TEMPLATE;

    const htmlTemplate = template
        .replace(/{{symbol}}/g, params.symbol)
        .replace(/{{company}}/g, params.company)
        .replace(/{{currentPrice}}/g, formatPrice(params.currentPrice))
        .replace(/{{targetPrice}}/g, formatPrice(params.thresholdValue))
        .replace(/{{timestamp}}/g, new Date().toLocaleString());

    const mailOptions = {
        from: `"Signalist Alerts" <${process.env.NODEMAILER_EMAIL!}>`,
        to: params.email,
        subject: `${params.symbol} alert: ${params.alertName}`,
        text: `${params.symbol} hit your ${params.alertName} target of ${params.thresholdValue}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendWeeklyReportEmail = async (params: { email: string; name: string; portfolioName: string; reportHtml: string }) => {
    const htmlTemplate = WEEKLY_PORTFOLIO_EMAIL_TEMPLATE
        .replace('{{name}}', params.name)
        .replace('{{portfolioName}}', params.portfolioName)
        .replace('{{reportContent}}', params.reportHtml || '');

    const mailOptions = {
        from: `"Signalist Weekly" <${process.env.NODEMAILER_EMAIL!}>`,
        to: params.email,
        subject: `📊 Weekly AI Report — ${params.portfolioName}`,
        text: `Weekly portfolio update for ${params.portfolioName}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (params: { email: string; url: string }) => {
    const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <h2 style="margin: 0 0 12px;">Reset your Signalist password</h2>
            <p style="margin: 0 0 16px;">We received a request to reset your password. Click the button below to continue.</p>
            <p style="margin: 0 0 24px;">
                <a href="${params.url}" style="background-color: #2563eb; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 6px; display: inline-block;">
                    Reset password
                </a>
            </p>
            <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                If you did not request a password reset, you can ignore this email.
            </p>
            <p style="margin: 0; font-size: 12px; color: #9ca3af; word-break: break-all;">${params.url}</p>
        </div>
    `;

    const mailOptions = {
        from: `"Signalist" <${process.env.NODEMAILER_EMAIL!}>`,
        to: params.email,
        subject: "Reset your Signalist password",
        text: `Reset your Signalist password: ${params.url}`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};
