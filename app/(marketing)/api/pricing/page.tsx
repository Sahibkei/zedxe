import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import ApiMarketingShell from "@/app/(marketing)/api/components/ApiMarketingShell";
import { apiPlans, apiPricingNotes, apiPricingRows } from "@/app/(marketing)/api/content";
import { auth } from "@/lib/better-auth/auth";

export const metadata: Metadata = {
    title: "Zapi API Pricing | ZedXe",
    description: "Compare Zapi API access tiers, request limits, regional coverage, and historical depth expectations.",
};

const tabs = [
    { label: "Overview", href: "/api" },
    { label: "Docs", href: "/api/docs" },
    { label: "Pricing", href: "#plans" },
    { label: "Live Swagger", href: "https://api.zedxe.com/docs", external: true },
];

const toneClassByPlan: Record<string, string> = {
    Free: "border-[#36507a] bg-[#0b1524]/90",
    Plus: "border-teal-300/20 bg-[linear-gradient(180deg,rgba(88,166,255,0.08),rgba(8,18,29,0.92))]",
    Pro: "border-teal-300/25 bg-[linear-gradient(180deg,rgba(15,237,190,0.08),rgba(6,16,24,0.9))]",
};

export default async function ApiPricingPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const primaryCta = session?.user
        ? { label: "Open API Billing", href: "/account/api/billing" }
        : { label: "Sign in to subscribe", href: "/sign-in?redirect=/account/api/billing" };
    const secondaryCta = session?.user
        ? { label: "Open API Dashboard", href: "/account/api" }
        : { label: "Read API Docs", href: "/api/docs" };

    return (
        <ApiMarketingShell
            eyebrow="Zapi / Pricing"
            title="Choose the access tier that matches your integration depth and region needs."
            description="Zapi pricing is structured around three plans: Free, Plus, and Pro. Paid tiers are billed monthly in EUR, while rate limits remain an intentional protection layer so one user cannot spam the API and degrade the rest of the app."
            primaryCta={primaryCta}
            secondaryCta={secondaryCta}
            tabs={tabs}
        >
            <section id="plans" className="grid gap-4 xl:grid-cols-3">
                {apiPlans.map((plan) => (
                    <article
                        key={plan.name}
                        className={`rounded-[1.75rem] border p-6 backdrop-blur-md ${toneClassByPlan[plan.name] ?? "border-white/10 bg-black/20"}`}
                    >
                        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{plan.access}</p>
                        <h2 className="mt-3 text-3xl font-semibold text-white">{plan.name}</h2>
                        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-teal-200">{plan.price}</p>
                        <p className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">{plan.requestsPerHour}</p>
                        <p className="mt-1 text-sm text-slate-400">requests per hour</p>

                        <div className="mt-6 space-y-3 text-sm text-slate-300">
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Regions</p>
                                <p className="mt-2 font-medium text-slate-100">{plan.regions}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">History depth</p>
                                <p className="mt-2 font-medium text-slate-100">{plan.historyDepth}</p>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Source coverage</p>
                                <p className="mt-2 font-medium text-slate-100">{plan.sourceCoverage}</p>
                            </div>
                        </div>

                        <p className="mt-5 text-sm leading-7 text-slate-300">{plan.note}</p>
                        <p className="mt-3 text-sm text-slate-400">{plan.idealFor}</p>
                    </article>
                ))}
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Plan comparison</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">What changes as you move up</h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-7 text-slate-300">
                        This public page explains the contract. Actual paid checkout and account-level upgrade flow now live inside the signed-in billing surface.
                    </p>
                </div>

                <div className="mt-8 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#08121d]/90">
                    <table className="min-w-full border-collapse text-left text-sm text-slate-300">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
                                <th className="px-5 py-4 font-medium">Capability</th>
                                <th className="px-5 py-4 font-medium">Free</th>
                                <th className="px-5 py-4 font-medium">Plus</th>
                                <th className="px-5 py-4 font-medium">Pro</th>
                            </tr>
                        </thead>
                        <tbody>
                            {apiPricingRows.map((row) => (
                                <tr key={row.label} className="border-b border-white/10 last:border-b-0">
                                    <td className="px-5 py-4 font-medium text-white">{row.label}</td>
                                    <td className="px-5 py-4">{row.values.Free}</td>
                                    <td className="px-5 py-4">{row.values.Plus}</td>
                                    <td className="px-5 py-4">{row.values.Pro}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                <article className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Coverage caveats</p>
                    <div className="mt-6 space-y-4">
                        {apiPricingNotes.map((note) => (
                            <div key={note} className="flex items-start gap-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-teal-200" />
                                <p className="text-sm leading-7 text-slate-300">{note}</p>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="rounded-[2rem] border border-white/10 bg-[#08121d]/90 p-7 shadow-[0_24px_70px_-42px_rgba(15,237,190,0.35)] md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Conversion path</p>
                    <div className="mt-5 space-y-4">
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                            <p className="text-sm font-semibold text-white">1. Discover</p>
                            <p className="mt-2 text-sm leading-7 text-slate-300">
                                Users land on <code>/api</code> and understand statement formats, coverage, and plan boundaries.
                            </p>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                            <p className="text-sm font-semibold text-white">2. Sign in</p>
                            <p className="mt-2 text-sm leading-7 text-slate-300">
                                Signed users move into <code>/account/api</code>, where they can see plan-aware quota and get a personal token.
                            </p>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                            <p className="text-sm font-semibold text-white">3. Upgrade</p>
                            <p className="mt-2 text-sm leading-7 text-slate-300">
                                Signed users move into <code>/account/api/billing</code>, where Plus and Pro can open Stripe checkout links when they are configured for the environment.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <Link
                            href={session?.user ? "/account/api/billing" : "/sign-in?redirect=/account/api/billing"}
                            className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300"
                        >
                            {session?.user ? "Open billing" : "Sign in to subscribe"}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href={session?.user ? "/account/api" : "/api/docs"}
                            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:text-white"
                        >
                            {session?.user ? "View API dashboard" : "Read API docs"}
                        </Link>
                    </div>
                </article>
            </section>
        </ApiMarketingShell>
    );
}
