import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Globe2, LockKeyhole, Orbit, Server } from "lucide-react";
import { headers } from "next/headers";
import ApiMarketingShell from "@/app/(marketing)/api/components/ApiMarketingShell";
import { apiCoverage, apiEndpoints, apiHighlights, apiPlans, curlExample, normalizedExample } from "@/app/(marketing)/api/content";
import { auth } from "@/lib/better-auth/auth";

export const metadata: Metadata = {
    title: "Zapi API | ZedXe",
    description: "Discover the ZedXe API, coverage status, access tiers, and the core statement endpoints powered by Zapi.",
};

const tabs = [
    { label: "Coverage", href: "#coverage" },
    { label: "Endpoints", href: "#endpoints" },
    { label: "Access Tiers", href: "#plans" },
    { label: "Pricing", href: "/api/pricing" },
    { label: "Docs", href: "/api/docs" },
    { label: "Live Swagger", href: "https://api.zedxe.com/docs", external: true },
];

const highlightIcons = {
    server: Server,
    lock: LockKeyhole,
    globe: Globe2,
    orbit: Orbit,
} as const;

export default async function ApiLandingPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const primaryCta = session?.user
        ? { label: "Open API Billing", href: "/account/api/billing" }
        : { label: "Request API Access", href: "/waitlist?from=api" };

    return (
        <ApiMarketingShell
            eyebrow="Zapi / API"
            title="Financial statements and regime metadata, productized inside the main site."
            description="Zapi now runs live on api.zedxe.com. This public site layer is where users discover the API, understand regional coverage, compare access tiers, and move into signed-in billing and token flows inside the main product."
            primaryCta={primaryCta}
            secondaryCta={{ label: "Read API Docs", href: "/api/docs" }}
            tabs={tabs}
        >
            <section id="overview" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {apiHighlights.map(({ icon, title, body }) => {
                    const Icon = highlightIcons[icon];
                    return (
                    <article
                        key={title}
                        className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_-32px_rgba(15,237,190,0.3)] backdrop-blur-md"
                    >
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-teal-300/20 bg-teal-300/10 text-teal-200">
                            <Icon className="h-5 w-5" />
                        </div>
                        <h2 className="mt-5 text-xl font-semibold text-white">{title}</h2>
                        <p className="mt-3 text-sm leading-7 text-gray-300">{body}</p>
                    </article>
                    );
                })}
            </section>

            <section id="coverage" className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Coverage</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">Region status today</h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-7 text-gray-300">
                        Coverage depth can differ from requested periods when the upstream filing history is incomplete. The docs surface that behavior directly in metadata.
                    </p>
                </div>
                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                    {apiCoverage.map((item) => (
                        <article key={item.regime} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-gray-300">
                                    {item.region}
                                </span>
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
                                        item.status === "Live"
                                            ? "bg-teal-300/10 text-teal-200"
                                            : item.status === "Pending"
                                              ? "bg-amber-300/10 text-amber-200"
                                              : "bg-blue-300/10 text-blue-200"
                                    }`}
                                >
                                    {item.status}
                                </span>
                            </div>
                            <h3 className="mt-4 text-lg font-semibold text-white">{item.regime}</h3>
                            <p className="mt-2 text-sm font-medium text-gray-200">{item.access}</p>
                            <p className="mt-3 text-sm leading-7 text-gray-300">{item.note}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="endpoints" className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <article className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Core endpoints</p>
                    <div className="mt-6 space-y-4">
                        {apiEndpoints.map((endpoint) => (
                            <div key={endpoint.path} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className="rounded-full bg-teal-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">
                                        {endpoint.method}
                                    </span>
                                    <code className="text-sm text-white">{endpoint.path}</code>
                                </div>
                                <p className="mt-4 text-sm leading-7 text-gray-300">{endpoint.description}</p>
                                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-gray-400">{endpoint.auth}</p>
                            </div>
                        ))}
                    </div>
                    <Link
                        href="/api/pricing"
                        className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-teal-200 transition hover:text-white"
                    >
                        Compare plans and pricing
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                </article>

                <article className="rounded-[2rem] border border-white/10 bg-[#08121d]/90 p-7 shadow-[0_24px_70px_-42px_rgba(88,98,255,0.5)] md:p-9">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Example request</p>
                            <h2 className="mt-3 text-2xl font-semibold text-white">`/v1/statements/:identifier` in practice</h2>
                        </div>
                        <Link
                            href="https://api.zedxe.com/docs"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-gray-200 transition hover:border-white/20 hover:text-white"
                        >
                            Live Swagger
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                    <pre className="mt-6 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#050c15] p-5 text-sm leading-7 text-gray-200">
                        <code>{curlExample}</code>
                    </pre>
                    <div className="mt-6">
                        <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Normalized response shape</p>
                        <pre className="mt-4 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#050c15] p-5 text-sm leading-7 text-gray-200">
                            <code>{normalizedExample}</code>
                        </pre>
                    </div>
                </article>
            </section>

            <section id="plans" className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Access tiers</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">Three API plans with rate-limit protection</h2>
                    </div>
                    <p className="max-w-2xl text-sm leading-7 text-gray-300">
                        The product model is now Free, Plus, and Pro. Rate limits are deliberate guardrails so individual users cannot spam the API and cause instability for the rest of the app.
                    </p>
                </div>
                <div className="mt-8 grid gap-4 xl:grid-cols-3">
                    {apiPlans.map((plan) => (
                        <article key={plan.name} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">{plan.access}</p>
                            <h3 className="mt-3 text-2xl font-semibold text-white">{plan.name}</h3>
                            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.18em] text-teal-200">{plan.price}</p>
                            <p className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">{plan.requestsPerHour}</p>
                            <p className="mt-1 text-sm text-gray-400">requests per hour</p>
                            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
                                {plan.regions}
                            </div>
                            <p className="mt-4 text-sm leading-7 text-gray-300">{plan.note}</p>
                        </article>
                    ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                        href={session?.user ? "/account/api/billing" : "/waitlist?from=api-plans"}
                        className="btn-glow inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-gray-900"
                    >
                        {session?.user ? "Open API billing" : "Join the API waitlist"}
                        <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Link
                        href="/api/pricing"
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:text-white"
                    >
                        View pricing details
                    </Link>
                </div>
            </section>
        </ApiMarketingShell>
    );
}
