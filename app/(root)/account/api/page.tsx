import Link from "next/link";
import { ArrowRight, CircleAlert, KeyRound, ShieldCheck, Workflow } from "lucide-react";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import ApiCredentialPanel from "@/components/account/ApiCredentialPanel";
import { getZapiAccessSnapshot, getZapiPlanDefaults } from "@/lib/zapi/account";

function formatPlanLabel(value: string): string {
    if (value === "free") return "Free";
    if (value === "plus") return "Plus";
    if (value === "pro") return "Pro";
    if (value === "public") return "Free";
    if (value === "scale") return "Pro";
    return value;
}

function formatResetAt(value?: string): string {
    if (!value) return "Unavailable";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

const AccountApiPage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user;

    if (!user) {
        return null;
    }

    const snapshot = await getZapiAccessSnapshot({
        id: user.id,
        email: user.email,
        name: user.name,
    });

    const status = snapshot.status;
    const fallbackPlanDefaults = getZapiPlanDefaults(snapshot.requestPlan);
    const plan = formatPlanLabel(status?.plan ?? snapshot.requestPlan);
    const requestsPerHour = status?.limits.requestsPerHour ?? fallbackPlanDefaults.requestsPerHour;
    const remainingThisHour = status?.limits.remainingThisHour;
    const allowedRegimes = status?.allowedRegimes ?? fallbackPlanDefaults.allowedRegimes;
    const features = status?.features ?? fallbackPlanDefaults.features;
    const curlExample = `curl "https://api.zedxe.com/v1/statements/AAPL?regime=sec_edgar&statement=income_statement&frequency=annual&format=normalized&periods=5" \\
  -H "Authorization: Bearer ${snapshot.token ?? "YOUR_ZEDXE_TOKEN"}"`;

    return (
        <div className="bento-page space-y-5">
            <section className="bento-card px-6 py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-[#58a6ff]">Account / API</p>
                        <h1 className="mt-2 text-3xl font-semibold text-slate-100 md:text-4xl">Personal API access</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                            This page is where a signed-in ZedXe user gets their personal Zapi token, sees plan-aware quota, and understands which regimes are currently unlocked.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/api/docs"
                            className="inline-flex items-center gap-2 rounded-full border border-[#273042] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#3a5576] hover:text-white"
                        >
                            Docs
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/api/pricing"
                            className="inline-flex items-center gap-2 rounded-full border border-[#273042] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#3a5576] hover:text-white"
                        >
                            Pricing
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/account/api/billing"
                            className="inline-flex items-center gap-2 rounded-full border border-[#273042] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#3a5576] hover:text-white"
                        >
                            Billing
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="https://api.zedxe.com/docs"
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-[#010409] transition hover:bg-[#7bb7ff]"
                        >
                            Live Swagger
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </section>

            <div className="bento-grid items-start">
                <section className="space-y-5 xl:col-span-8">
                    <article className="bento-card p-6 md:p-7">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-2xl border border-[#273042] bg-[#0b1019]/80 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Current plan</p>
                                <p className="mt-3 text-3xl font-semibold text-slate-100">{plan}</p>
                                <p className="mt-2 text-sm text-slate-400">
                                    {status ? "Resolved from live Zapi auth status." : "Resolved from the main-site API plan config."}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-[#273042] bg-[#0b1019]/80 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Requests / hour</p>
                                <p className="mt-3 text-3xl font-semibold text-slate-100">{requestsPerHour}</p>
                                <p className="mt-2 text-sm text-slate-400">Plan quota currently associated with this account context.</p>
                            </div>
                            <div className="rounded-2xl border border-[#273042] bg-[#0b1019]/80 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Remaining now</p>
                                <p className="mt-3 text-3xl font-semibold text-slate-100">
                                    {typeof remainingThisHour === "number" ? remainingThisHour : "--"}
                                </p>
                                <p className="mt-2 text-sm text-slate-400">Live remaining quota for the current hour window.</p>
                            </div>
                            <div className="rounded-2xl border border-[#273042] bg-[#0b1019]/80 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Reset time</p>
                                <p className="mt-3 text-lg font-semibold text-slate-100">{formatResetAt(status?.limits.resetAt)}</p>
                                <p className="mt-2 text-sm text-slate-400">Reported directly by Zapi when JWT auth is active.</p>
                            </div>
                        </div>
                    </article>

                    {snapshot.token ? (
                        <article className="bento-card p-6 md:p-7">
                            <div className="mb-5 flex items-center gap-3">
                                <KeyRound className="h-5 w-5 text-[#58a6ff]" />
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-100">Use your personal token</h2>
                                    <p className="mt-1 text-sm text-slate-400">
                                        This token is issued by the main site and authenticated by Zapi as a user-scoped bearer token.
                                    </p>
                                </div>
                            </div>
                            <ApiCredentialPanel token={snapshot.token} curlExample={curlExample} />
                        </article>
                    ) : (
                        <article className="bento-card p-6 md:p-7">
                            <div className="flex items-start gap-3">
                                <CircleAlert className="mt-0.5 h-5 w-5 text-amber-300" />
                                <div>
                                    <h2 className="text-xl font-semibold text-slate-100">Token issuance is not configured yet</h2>
                                    <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                                        The dashboard is in place, but this deployment cannot mint your personal Zapi JWT until the missing server config is added to the main site.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {snapshot.missingConfig.map((item) => (
                                            <span key={item} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                                                {item}
                                            </span>
                                        ))}
                                    </div>
                                    <pre className="mt-5 overflow-x-auto rounded-2xl border border-[#273042] bg-[#050c15] p-4 text-xs leading-7 text-slate-200">
                                        <code>{`ZAPI_BASE_URL=https://api.zedxe.com
ZAPI_JWT_SECRET=<same shared secret used by Zapi>
ZAPI_JWT_ISSUER=zedxe
ZAPI_JWT_AUDIENCE=zapi-api
ZAPI_DEFAULT_SIGNED_PLAN=free
ZAPI_PLUS_EMAILS=analyst@company.com
ZAPI_PRO_EMAILS=owner@company.com`}</code>
                                    </pre>
                                </div>
                            </div>
                        </article>
                    )}

                    <article className="bento-card p-6 md:p-7">
                        <div className="mb-5 flex items-center gap-3">
                            <Workflow className="h-5 w-5 text-[#58a6ff]" />
                            <div>
                                <h2 className="text-xl font-semibold text-slate-100">Allowed regimes</h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    This is the region access currently tied to your account-level plan.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {allowedRegimes.map((regime) => (
                                <span key={regime} className="rounded-full border border-[#2a3952] bg-[#1f2f4d] px-4 py-2 text-sm font-semibold text-slate-100">
                                    {regime}
                                </span>
                            ))}
                        </div>
                    </article>
                </section>

                <aside className="space-y-5 xl:col-span-4">
                    <article className="bento-card p-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-[#58a6ff]" />
                            <div>
                                <h2 className="text-lg font-semibold text-slate-100">Auth status</h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    {status ? "Live response from /v1/auth/status." : "Waiting for JWT config or a successful live status check."}
                                </p>
                            </div>
                        </div>
                        <dl className="mt-5 space-y-4">
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4">
                                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">User</dt>
                                <dd className="mt-2 text-sm font-medium text-slate-100">{user.email}</dd>
                            </div>
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4">
                                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Auth mode</dt>
                                <dd className="mt-2 text-sm font-medium text-slate-100">{status?.authMode ?? "pending"}</dd>
                            </div>
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4">
                                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Subject</dt>
                                <dd className="mt-2 break-all text-sm font-medium text-slate-100">{status?.subject ?? user.id}</dd>
                            </div>
                        </dl>
                    </article>

                    <article className="bento-card p-6">
                        <h2 className="text-lg font-semibold text-slate-100">Feature flags</h2>
                        <div className="mt-5 space-y-3">
                            {features.map((feature) => (
                                <div key={feature} className="rounded-xl border border-[#273042] bg-[#0b1019]/80 px-4 py-3 text-sm text-slate-300">
                                    {feature}
                                </div>
                            ))}
                        </div>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <Link
                                href="/account/api/billing"
                                className="inline-flex items-center gap-2 rounded-full bg-[#58a6ff] px-4 py-2 text-sm font-semibold text-[#010409] transition hover:bg-[#7bb7ff]"
                            >
                                Manage billing
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                href="/api/pricing"
                                className="inline-flex items-center gap-2 rounded-full border border-[#273042] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#3a5576] hover:text-white"
                            >
                                Compare plans
                            </Link>
                        </div>
                    </article>

                    {snapshot.error ? (
                        <article className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5 text-sm text-red-100">
                            <p className="font-semibold">Live Zapi status call failed</p>
                            <p className="mt-2 leading-7 text-red-100/90">{snapshot.error}</p>
                        </article>
                    ) : null}
                </aside>
            </div>
        </div>
    );
};

export default AccountApiPage;
