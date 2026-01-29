import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceRateLimit, getClientIp } from "@/lib/security/rateLimit";
import { getTurnstileIp, verifyTurnstileToken } from "@/lib/security/turnstile";

export const runtime = "nodejs";

const waitlistSchema = z.object({
    fullName: z.string().min(1, "Full name is required").max(200),
    email: z.string().email("Valid email is required").max(320),
    company: z.string().max(200).optional().nullable(),
    country: z.string().min(1, "Country is required").max(100),
    website: z.string().max(200).optional().nullable(),
    turnstileToken: z.string().optional().nullable(),
});

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

/** Handle waitlist submissions and notify the ZedXe team. */
export async function POST(request: Request) {
    const rateLimited = await enforceRateLimit(request, "waitlist");
    if (rateLimited) return rateLimited;

    let body: unknown;
    try {
        body = await request.json();
    } catch (error) {
        console.error("Waitlist payload error", error);
        return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
    }

    const parsed = waitlistSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ ok: false, error: "Please provide valid details." }, { status: 400 });
    }

    const { fullName, email, company, country, website, turnstileToken } = parsed.data;
    if (website && website.trim().length > 0) {
        return NextResponse.json({ ok: true });
    }

    const hasTurnstileSecret = Boolean(process.env.TURNSTILE_SECRET_KEY);
    if (hasTurnstileSecret && !turnstileToken) {
        return NextResponse.json({ ok: false, error: "Turnstile token is required." }, { status: 400 });
    }
    if (hasTurnstileSecret) {
        const verification = await verifyTurnstileToken(turnstileToken ?? null, getTurnstileIp(request));
        if (!verification.ok) {
            return NextResponse.json(
                { ok: false, error: verification.error ?? "Turnstile verification failed." },
                { status: 403 },
            );
        }
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const notifyTo = process.env.WAITLIST_NOTIFY_TO;
    const from = process.env.WAITLIST_FROM;

    if (!resendApiKey || !notifyTo || !from) {
        console.error("Waitlist email env vars missing.");
        return NextResponse.json({ ok: false, error: "Email service is not configured." }, { status: 500 });
    }

    const timestamp = new Date().toISOString();
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const safeCompany = company?.trim() ? company.trim() : "—";

    const subject = `New ZedXe Waitlist Request — ${fullName} (${country})`;
    const html = `
        <h2>New waitlist request</h2>
        <ul>
            <li><strong>Full Name:</strong> ${escapeHtml(fullName)}</li>
            <li><strong>Email:</strong> ${escapeHtml(email)}</li>
            <li><strong>Company:</strong> ${escapeHtml(safeCompany)}</li>
            <li><strong>Country:</strong> ${escapeHtml(country)}</li>
            <li><strong>Timestamp:</strong> ${escapeHtml(timestamp)}</li>
            <li><strong>IP:</strong> ${escapeHtml(ip)}</li>
            <li><strong>User-Agent:</strong> ${escapeHtml(userAgent)}</li>
        </ul>
    `;
    const text = [
        "New waitlist request",
        `Full Name: ${fullName}`,
        `Email: ${email}`,
        `Company: ${safeCompany}`,
        `Country: ${country}`,
        `Timestamp: ${timestamp}`,
        `IP: ${ip}`,
        `User-Agent: ${userAgent}`,
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${resendApiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: notifyTo,
                subject,
                html,
                text,
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Waitlist email failed", response.status, errorBody);
            return NextResponse.json({ ok: false, error: "Unable to submit waitlist request." }, { status: 500 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            console.error("Waitlist email request timed out.");
            return NextResponse.json({ ok: false, error: "Email service timed out." }, { status: 504 });
        }
        console.error("Waitlist email failed", error);
        return NextResponse.json({ ok: false, error: "Unable to submit waitlist request." }, { status: 500 });
    } finally {
        clearTimeout(timeout);
    }
}
