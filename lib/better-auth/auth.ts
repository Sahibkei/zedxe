import { betterAuth } from "better-auth";
import { mongodbAdapter} from "better-auth/adapters/mongodb";
import { connectToDatabase} from "@/database/mongoose";
import { nextCookies} from "better-auth/next-js";
import type { Db } from "mongodb";
import { sendPasswordResetEmail } from "@/lib/nodemailer";

let authInstance: ReturnType<typeof betterAuth> | null = null;

export const getAuth = async () => {
    if(authInstance) return authInstance;

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;

    if(!db) throw new Error('MongoDB connection not found');

    const baseURL =
        process.env.BETTER_AUTH_URL ??
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    authInstance = betterAuth({
        database: mongodbAdapter(db as unknown as Db),
        secret: process.env.BETTER_AUTH_SECRET,
        baseURL,
        emailAndPassword: {
            enabled: true,
            disableSignUp: false,
            requireEmailVerification: false,
            minPasswordLength: 8,
            maxPasswordLength: 128,
            autoSignIn: true,
            resetPasswordTokenExpiresIn: 60 * 60,
            sendResetPassword: async ({ user, url, token }, ctx) => {
                if (!user?.email) return;
                const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
                const resetUrl = appUrl ? `${appUrl}/reset-password?token=${token}` : url;
                const requestId = ctx?.headers?.get?.("x-request-id") ?? "unknown";
                if (!appUrl) {
                    console.warn("Password reset using fallback URL", { requestId });
                }
                await sendPasswordResetEmail({ to: user.email, resetUrl, requestId });
            },
        },
        plugins: [nextCookies()],
    });

    return authInstance;
}

export const auth = await getAuth();
