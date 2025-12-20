"use client";

import { FormEvent, useState } from "react";

const WaitlistForm = () => {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setStatus("loading");
        setMessage("");

        try {
            const response = await fetch("/api/waitlist", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            const data = await response.json();
            if (!response.ok) {
                setStatus("error");
                setMessage(data?.error ?? "Something went wrong.");
                return;
            }
            setStatus("success");
            setMessage(data?.message ?? "You're on the list.");
            setEmail("");
        } catch (error) {
            console.error("Waitlist error", error);
            setStatus("error");
            setMessage("Unable to join right now.");
        }
    };

    return (
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
            <label className="text-sm text-gray-300" htmlFor="waitlist-email">
                Get early access updates
            </label>
            <div className="flex flex-col gap-3 md:flex-row">
                <input
                    id="waitlist-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="w-full rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-400 focus:border-teal-300 focus:outline-none"
                />
                <button
                    type="submit"
                    className="btn-glow rounded-full bg-teal-400 px-6 py-3 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={status === "loading"}
                >
                    {status === "loading" ? "Joining..." : "Join waitlist"}
                </button>
            </div>
            {message ? (
                <p className={`text-sm ${status === "error" ? "text-red-300" : "text-teal-200"}`}>{message}</p>
            ) : null}
        </form>
    );
};

export default WaitlistForm;
