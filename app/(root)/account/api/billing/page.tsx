import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/better-auth/auth";
import { apiPlans } from "@/app/(marketing)/api/content";
import { getZapiAccessSnapshot } from "@/lib/zapi/account";
import { compareBillingPlan, getZapiCheckoutUrl, getZapiBillingLinks, normalizeBillingPlan } from "@/lib/zapi/billing";

function formatPlanLabel(value: string): string {
    if (value === "plus") return "Plus";
    if (value === "pro") return "Pro";
    return "Free";
}

function getPlanButtonCopy(input: {
    activePlan: "free" | "plus" | "pro";
    targetPlan: "free" | "plus" | "pro";
    checkoutUrl: string | null;
}) {
    const comparison = compareBillingPlan(input.activePlan, input.targetPlan);

    if (comparison === 0) {
        return {
            label: "Current plan",
            href: "/account/api",
            external: false,
            disabled: true,
            helper: "This is the access tier currently active on your account.",
        };
    }

    if (comparison > 0) {
        return {
            label: "Already included",
            href: "/account/api",
            external: false,
            disabled: true,
            helper: "Your current account access already sits above this tier.",
        };
    }

    if (input.targetPlan === "free") {
        return {
            label: "Included with account",
            href: "/account/api",
            external: false,
            disabled: false,
            helper: "Free access is available immediately for signed-in users.",
        };
    }

    if (input.checkoutUrl) {
        return {
            label: `Checkout ${formatPlanLabel(input.targetPlan)} in Stripe`,
            href: input.checkoutUrl,
            external: true,
            disabled: false,
            helper: "Monthly billing runs through Stripe. Open checkout in a new tab to complete the upgrade.",
        };
    }

    return {
        label: "Request manual upgrade",
        href: `/waitlist?from=account-api-billing-${input.targetPlan}`,
        external: false,
        disabled: false,
        helper: "A Stripe checkout link is not configured for this tier yet, so upgrade routing falls back to manual provisioning.",
    };
}

const toneClassByPlan: Record<string, string> = {
    free: "border-[#36507a] bg-[#0b1524]/90",
    plus: "border-teal-300/20 bg-[linear-gradient(180deg,rgba(88,166,255,0.08),rgba(8,18,29,0.92))]",
    pro: "border-teal-300/25 bg-[linear-gradient(180deg,rgba(15,237,190,0.08),rgba(6,16,24,0.9))]",
};

const AccountApiBillingPage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    const user = session?.user;

    if (!user) {
        redirect("/sign-in?redirect=/account/api/billing");
    }

    const snapshot = await getZapiAccessSnapshot({
        id: user.id,
        email: user.email,
        name: user.name,
    });
    const activePlan = normalizeBillingPlan(snapshot.status?.plan ?? snapshot.requestPlan);
    const billingLinks = getZapiBillingLinks();
    const activePlanCard = apiPlans.find((plan) => plan.id === activePlan) ?? apiPlans[0];

    return (
        <div className="bento-page space-y-5">
            <section className="bento-card px-6 py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-[#58a6ff]">Account / API / Billing</p>
                        <h1 className="mt-2 text-3xl font-semibold text-slate-100 md:text-4xl">Manage API billing and plan upgrades</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                            Choose the API tier you want on this account. Free is immediate. Plus and Pro can route into Stripe checkout when the payment links are configured for this deployment.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <Link
                            href="/account/api"
                            className="inline-flex items-center gap-2 rounded-full border border-[#273042] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#3a5576] hover:text-white"
                        >
                            API dashboard
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/api/pricing"
                            className="inline-flex items-center gap-2 rounded-full border border-[#273042] px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-[#3a5576] hover:text-white"
                        >
                            Public pricing
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </section>

            <div className="bento-grid items-start">
                <section className="space-y-5 xl:col-span-8">
                    <article className="bento-card p-6 md:p-7">
                        <div className="mb-6 flex items-center gap-3">
                            <CreditCard className="h-5 w-5 text-[#58a6ff]" />
                            <div>
                                <h2 className="text-xl font-semibold text-slate-100">Current billing context</h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    This page is keyed to your signed-in ZedXe account and the plan currently recognized by Zapi.
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="rounded-2xl border border-[#273042] bg-[#0b1019]/80 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active plan</p>
                                <p className="mt-3 text-3xl font-semibold text-slate-100">{activePlanCard.name}</p>
                                <p className="mt-2 text-sm text-slate-400">
                                    {snapshot.status ? "Resolved from live Zapi auth status." : "Resolved from the current site-side plan assignment."}
                                </p>
                            </div>
                            <div className="rounded-2xl border border-[#273042] bg-[#0b1019]/80 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Monthly billing</p>
                                <p className="mt-3 text-3xl font-semibold text-slate-100">{activePlanCard.price}</p>
                                <p className="mt-2 text-sm text-slate-400">Displayed exactly the same way as the public API pricing surface.</p>
                            </div>
                            <div className="rounded-2xl border border-[#273042] bg-[#0b1019]/80 p-5">
                                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Checkout state</p>
                                <p className="mt-3 text-3xl font-semibold text-slate-100">
                                    {billingLinks.plusCheckoutUrl || billingLinks.proCheckoutUrl ? "Ready" : "Manual"}
                                </p>
                                <p className="mt-2 text-sm text-slate-400">
                                    Paid tiers open Stripe checkout when a checkout link is configured for the selected plan.
                                </p>
                            </div>
                        </div>
                    </article>

                    <section className="grid gap-4 xl:grid-cols-3">
                        {apiPlans.map((plan) => {
                            const action = getPlanButtonCopy({
                                activePlan,
                                targetPlan: plan.id,
                                checkoutUrl: getZapiCheckoutUrl(plan.id),
                            });
                            const isCurrent = activePlan === plan.id;

                            return (
                                <article
                                    key={plan.id}
                                    className={`rounded-[1.75rem] border p-6 backdrop-blur-md ${toneClassByPlan[plan.id] ?? "border-white/10 bg-black/20"}`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{plan.access}</p>
                                            <h2 className="mt-3 text-3xl font-semibold text-white">{plan.name}</h2>
                                        </div>
                                        {isCurrent ? (
                                            <span className="rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
                                                Current
                                            </span>
                                        ) : null}
                                    </div>

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

                                    <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                                        {action.disabled ? (
                                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-3 text-sm font-semibold text-white/85">
                                                <CheckCircle2 className="h-4 w-4" />
                                                {action.label}
                                            </div>
                                        ) : action.external ? (
                                            <a
                                                href={action.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300"
                                            >
                                                {action.label}
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        ) : (
                                            <Link
                                                href={action.href}
                                                className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-teal-300"
                                            >
                                                {action.label}
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        )}
                                        <p className="mt-3 text-sm leading-7 text-slate-400">{action.helper}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                </section>

                <aside className="space-y-5 xl:col-span-4">
                    <article className="bento-card p-6">
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="h-5 w-5 text-[#58a6ff]" />
                            <div>
                                <h2 className="text-lg font-semibold text-slate-100">How billing works right now</h2>
                                <p className="mt-1 text-sm text-slate-400">This page keeps the commercial flow honest with the infrastructure already in place.</p>
                            </div>
                        </div>
                        <div className="mt-5 space-y-3">
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4 text-sm leading-7 text-slate-300">
                                Free is immediate for signed-in users and maps straight to personal JWT access on <code>api.zedxe.com</code>.
                            </div>
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4 text-sm leading-7 text-slate-300">
                                Plus and Pro can route into Stripe checkout links when those links are present in the deployment environment.
                            </div>
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4 text-sm leading-7 text-slate-300">
                                If access does not update immediately after billing, return to <code>/account/api</code> and recheck the live auth status while account provisioning catches up.
                            </div>
                        </div>
                    </article>

                    <article className="bento-card p-6">
                        <h2 className="text-lg font-semibold text-slate-100">Configured checkout links</h2>
                        <dl className="mt-5 space-y-4">
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4">
                                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Plus checkout</dt>
                                <dd className="mt-2 text-sm font-medium text-slate-100">
                                    {billingLinks.plusCheckoutUrl ? "Configured" : "Not configured"}
                                </dd>
                            </div>
                            <div className="rounded-xl border border-[#273042] bg-[#0b1019]/80 p-4">
                                <dt className="text-xs uppercase tracking-[0.18em] text-slate-500">Pro checkout</dt>
                                <dd className="mt-2 text-sm font-medium text-slate-100">
                                    {billingLinks.proCheckoutUrl ? "Configured" : "Not configured"}
                                </dd>
                            </div>
                        </dl>
                        <p className="mt-5 text-sm leading-7 text-slate-400">
                            Add <code>ZAPI_PLUS_CHECKOUT_URL</code> and <code>ZAPI_PRO_CHECKOUT_URL</code> in the main-site env to turn on direct Stripe checkout buttons here.
                        </p>
                    </article>
                </aside>
            </div>
        </div>
    );
};

export default AccountApiBillingPage;
