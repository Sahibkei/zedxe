import nodemailer from 'nodemailer';
import {WELCOME_EMAIL_TEMPLATE} from "@/lib/nodemailer/templates";

export const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.NODEMAILER_EMAIl!,
        pass: process.env.NODEMAIL_PASSWORD!,
    }
})

export const sendWelcomeEmail = async ({ email, name, intro}: WelcomeEmailData) => {
    const htmlTemplate = WELCOME_EMAIL_TEMPLATE
        .replace('{{name}}', name)
        .replace('{{intro}}', intro);

    const mailOptions = {
        from: `"ZEDxe" <sahibkalersingh@gmail.com`,
        to: email,
        subject: `Welcome to ZEDxe - your stock market toolkit is ready`,
        text: 'Thanks for joining ZEDxe',
        html: htmlTemplate,
    }

    await transporter.sendMail(mailOptions);
}