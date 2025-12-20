import { NextResponse } from "next/server";
import { getMongoClient } from "@/lib/mongodb";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export async function POST(request: Request) {
    let body: { email?: string } = {};

    try {
        body = await request.json();
    } catch (error) {
        console.error("Waitlist payload error", error);
        return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    if (!email || !EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: "Please provide a valid email." }, { status: 400 });
    }

    const client = await getMongoClient();

    if (!client) {
        console.log(`Waitlist signup (stub): ${email}`);
        return NextResponse.json({ message: "Thanks! You're on the waitlist." }, { status: 200 });
    }

    const collection = client.db().collection("waitlist");

    try {
        await collection.createIndex({ email: 1 }, { unique: true });
    } catch (error) {
        console.warn("Waitlist index creation failed", error);
    }

    try {
        await collection.insertOne({ email, createdAt: new Date() });
        return NextResponse.json({ message: "Thanks! You're on the waitlist." }, { status: 200 });
    } catch (error) {
        const code = (error as { code?: number }).code;
        if (code === 11000) {
            return NextResponse.json({ message: "You're already on the waitlist." }, { status: 200 });
        }
        console.error("Waitlist insert failed", error);
        return NextResponse.json({ error: "Unable to join waitlist." }, { status: 500 });
    }
}
