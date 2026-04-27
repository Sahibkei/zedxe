import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import ApiMarketingShell from "@/app/(marketing)/api/components/ApiMarketingShell";
import {
    apiCoverage,
    apiEndpoints,
    curlExample,
    matrixExample,
    normalizedExample,
    responseHeaders,
    serverExample,
    statementQueryParameters,
} from "@/app/(marketing)/api/content";
import { auth } from "@/lib/better-auth/auth";

export const metadata: Metadata = {
    title: "Zapi API Docs | ZedXe",
    description: "Authentication, endpoints, formats, examples, and coverage notes for the Zapi API on api.zedxe.com.",
};

const tabs = [
    { label: "Overview", href: "#overview" },
    { label: "Auth", href: "#auth" },
    { label: "Endpoints", href: "#endpoints" },
    { label: "Formats", href: "#formats" },
    { label: "Coverage", href: "#coverage" },
    { label: "Pricing", href: "/api/pricing" },
    { label: "Live Swagger", href: "https://api.zedxe.com/docs", external: true },
];

export default async function ApiDocsPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const secondaryCta = session?.user
        ? { label: "Open API Billing", href: "/account/api/billing" }
        : { label: "Back to API Overview", href: "/api" };

    return (
        <ApiMarketingShell
            eyebrow="Zapi / Docs"
            title="Reference docs for integrating the live Zapi API into the main ZedXe product."
            description="Use this page for the product-facing explanation of auth, endpoints, output formats, quota headers, and region caveats. The live Swagger UI remains available on api.zedxe.com/docs for raw endpoint inspection."
            primaryCta={{ label: "Open Live Swagger", href: "https://api.zedxe.com/docs", external: true }}
            secondaryCta={secondaryCta}
            tabs={tabs}
        >
            <section id="overview" className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <article className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Base URL</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">https://api.zedxe.com</h2>
                    <p className="mt-5 text-sm leading-7 text-gray-300">
                        Default product flow: the main site owns signup, billing, and plan assignment. Signed users receive site-issued JWTs, while internal server traffic continues using the service key path.
                    </p>
                    <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                        <p className="text-sm font-semibold text-white">Current canonical endpoints</p>
                        <div className="mt-4 space-y-3">
                            {apiEndpoints.map((endpoint) => (
                                <div key={endpoint.path} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                    <p className="text-xs uppercase tracking-[0.22em] text-teal-200">{endpoint.method}</p>
                                    <code className="mt-2 block text-sm text-white">{endpoint.path}</code>
                                    <p className="mt-3 text-sm leading-7 text-gray-300">{endpoint.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </article>

                <article className="rounded-[2rem] border border-white/10 bg-[#08121d]/90 p-7 shadow-[0_24px_70px_-42px_rgba(15,237,190,0.4)] md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Quick start</p>
                    <pre className="mt-5 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#050c15] p-5 text-sm leading-7 text-gray-200">
                        <code>{curlExample}</code>
                    </pre>
                    <pre className="mt-5 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#050c15] p-5 text-sm leading-7 text-gray-200">
                        <code>{serverExample}</code>
                    </pre>
                    <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                        <p className="text-sm font-semibold text-white">Rate-limit headers exposed on responses</p>
                        <div className="mt-4 space-y-3">
                            {responseHeaders.map((header) => (
                                <div key={header.name} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                    <code className="text-sm text-white">{header.name}</code>
                                    <p className="mt-2 text-sm leading-7 text-gray-300">{header.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </article>
            </section>

            <section id="auth" className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Authentication</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    <article className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
                        <p className="text-sm font-semibold text-white">Free plan access</p>
                        <p className="mt-3 text-sm leading-7 text-gray-300">
                            The intended starter tier is the Free plan: US data only, last 5 years of history, and a strict rate limit to prevent abuse.
                        </p>
                    </article>
                    <article className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
                        <p className="text-sm font-semibold text-white">Bearer JWT for signed plans</p>
                        <p className="mt-3 text-sm leading-7 text-gray-300">
                            The site backend will mint HS256 JWTs with at least <code>sub</code>, <code>plan</code>, <code>iss</code>, <code>aud</code>, and <code>exp</code>. The signed-in billing flow can then map users into Free, Plus, and Pro without changing Zapi enforcement.
                        </p>
                    </article>
                    <article className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
                        <p className="text-sm font-semibold text-white">Service key for server traffic</p>
                        <p className="mt-3 text-sm leading-7 text-gray-300">
                            Internal site services keep using <code>x-zapi-api-key</code>. In the main app this maps to <code>ZAPI_INTERNAL_API_KEY</code>.
                        </p>
                    </article>
                </div>
                <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-[#08121d]/90 p-5">
                    <p className="text-sm font-semibold text-white">Current site environment target</p>
                    <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#050c15] p-5 text-sm leading-7 text-gray-200">
                        <code>{`ZAPI_BASE_URL=https://api.zedxe.com
ZAPI_INTERNAL_API_KEY=<same service key as Zapi>
ZAPI_JWT_ISSUER=zedxe
ZAPI_JWT_AUDIENCE=zapi-api
ZAPI_DEFAULT_SIGNED_PLAN=free
ZAPI_PLUS_EMAILS=analyst@company.com
ZAPI_PRO_EMAILS=owner@company.com`}</code>
                    </pre>
                </div>
            </section>

            <section id="endpoints" className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <article className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Statement query model</p>
                    <div className="mt-6 space-y-4">
                        {statementQueryParameters.map((parameter) => (
                            <div key={parameter.name} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                                <div className="flex flex-wrap items-center gap-3">
                                    <code className="text-sm text-white">{parameter.name}</code>
                                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-gray-400">
                                        {parameter.value}
                                    </span>
                                </div>
                                <p className="mt-3 text-sm leading-7 text-gray-300">{parameter.note}</p>
                            </div>
                        ))}
                    </div>
                </article>

                <article className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Endpoint notes</p>
                    <div className="mt-6 space-y-4">
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                            <code className="text-sm text-white">GET /v1/statements/:identifier</code>
                            <p className="mt-3 text-sm leading-7 text-gray-300">
                                Use this for annual and quarterly statements. Normalized format is the right source for charts, analytics, and reusable site-side rendering logic.
                            </p>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                            <code className="text-sm text-white">GET /v1/regimes</code>
                            <p className="mt-3 text-sm leading-7 text-gray-300">
                                Surface adapter status in the product UI so users can see what is live, parser-limited, or pending before they hit unsupported requests.
                            </p>
                        </div>
                        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                            <code className="text-sm text-white">GET /v1/auth/status</code>
                            <p className="mt-3 text-sm leading-7 text-gray-300">
                                Best for the future signed-in API dashboard because it returns plan, remaining quota, feature flags, and allowed regimes in one response.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
                        <p className="text-sm font-semibold text-white">History behavior</p>
                        <p className="mt-3 text-sm leading-7 text-gray-300">
                            Requested periods can exceed returned periods. Check <code>meta.requestedPeriods</code>, <code>meta.returnedPeriods</code>, <code>meta.historyCoverage</code>, and <code>meta.historyNote</code> before assuming full depth outside mature SEC coverage.
                        </p>
                    </div>
                </article>
            </section>

            <section id="formats" className="grid gap-6 xl:grid-cols-2">
                <article className="rounded-[2rem] border border-white/10 bg-[#08121d]/90 p-7 md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Normalized format</p>
                    <p className="mt-4 text-sm leading-7 text-gray-300">
                        Contract shape: <code>meta</code>, <code>columns</code>, <code>rows</code>, and <code>periods</code>, with optional <code>debug.facts</code> when <code>debug=true</code>.
                    </p>
                    <pre className="mt-5 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#050c15] p-5 text-sm leading-7 text-gray-200">
                        <code>{normalizedExample}</code>
                    </pre>
                </article>
                <article className="rounded-[2rem] border border-white/10 bg-[#08121d]/90 p-7 md:p-9">
                    <p className="text-xs uppercase tracking-[0.24em] text-blue-200">Matrix format</p>
                    <p className="mt-4 text-sm leading-7 text-gray-300">
                        Contract shape: workbook-style rows with <code>display_values</code>, display scale metadata, and a footer for table exports.
                    </p>
                    <pre className="mt-5 overflow-x-auto rounded-[1.5rem] border border-white/10 bg-[#050c15] p-5 text-sm leading-7 text-gray-200">
                        <code>{matrixExample}</code>
                    </pre>
                </article>
            </section>

            <section id="coverage" className="rounded-[2rem] border border-white/10 bg-white/5 p-7 backdrop-blur-xl md:p-9">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-teal-300">Coverage notes</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white">Document the caveats where users will see them</h2>
                    </div>
                    <Link
                        href={session?.user ? "/account/api/billing" : "/sign-in?redirect=/account/api/billing"}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:text-white"
                    >
                        {session?.user ? "Open billing" : "Sign in to subscribe"}
                    </Link>
                </div>
                <div className="mt-8 grid gap-4 lg:grid-cols-2">
                    {apiCoverage.map((item) => (
                        <article key={item.regime} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-6">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-300">
                                    {item.region}
                                </span>
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-200">
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
        </ApiMarketingShell>
    );
}
