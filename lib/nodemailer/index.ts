import nodemailer from 'nodemailer';
import {WELCOME_EMAIL_TEMPLATE, NEWS_SUMMARY_EMAIL_TEMPLATE, STOCK_ALERT_LOWER_EMAIL_TEMPLATE, STOCK_ALERT_UPPER_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";
import { formatPrice } from "@/lib/utils";

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

export const sendPriceAlertEmail = async ({
    email,
    name,
    symbol,
    company,
    currentPrice,
    targetPrice,
    condition,
    alertName,
}: {
    email: string;
    name?: string;
    symbol: string;
    company?: string;
    currentPrice: number;
    targetPrice: number;
    condition: AlertCondition;
    alertName?: string;
}) => {
    const template = condition === 'less_than' || condition === 'crosses_below'
        ? STOCK_ALERT_LOWER_EMAIL_TEMPLATE
        : STOCK_ALERT_UPPER_EMAIL_TEMPLATE;

    const timestamp = new Date().toUTCString();
    const friendlyName = name?.trim() || 'there';
    const htmlTemplate = template
        .replace(/{{symbol}}/g, symbol)
        .replace(/{{company}}/g, company || symbol)
        .replace(/{{currentPrice}}/g, formatPrice(currentPrice))
        .replace(/{{targetPrice}}/g, formatPrice(targetPrice))
        .replace(/{{timestamp}}/g, timestamp);

    const mailOptions = {
        from: `"Signalist Alerts" <sahibkalersingh@gmail.com>`,
        to: email,
        subject: `${alertName || 'Price alert'} • ${symbol}`,
        text: `${friendlyName}, your ${symbol} alert triggered at ${formatPrice(currentPrice)} (target ${formatPrice(targetPrice)}).`,
        html: htmlTemplate,
    };

    await transporter.sendMail(mailOptions);
};