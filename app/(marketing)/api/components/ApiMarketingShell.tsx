import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Navbar from "@/app/(marketing)/components/Navbar";
import Footer from "@/app/(marketing)/components/Footer";

type ApiPageLink = {
    label: string;
    href: string;
    external?: boolean;
};

type ApiMarketingShellProps = {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: ApiPageLink;
    secondaryCta?: ApiPageLink;
    tabs: ApiPageLink[];
    children: ReactNode;
};

const linkProps = (external?: boolean) => (external ? { target: "_blank", rel: "noreferrer" } : {});

const ApiMarketingShell = async ({
    eyebrow,
    title,
    description,
    primaryCta,
    secondaryCta,
    tabs,
    children,
}: ApiMarketingShellProps) => {
    return (
        <main className="relative overflow-hidden bg-gray-900 text-white">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 chart-bg" />
                <div className="absolute inset-0 grain" />
                <div className="absolute inset-x-0 top-0 h-[24rem] bg-[radial-gradient(circle_at_top,rgba(15,237,190,0.16),transparent_52%)]" />
            </div>
            <Navbar />
            <section className="container pb-8 pt-10 md:pb-12 md:pt-14">
                <div className="glass-card rounded-[2rem] border border-white/10 p-8 md:p-12">
                    <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.28em] text-teal-300">
                        <span>{eyebrow}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] tracking-[0.24em] text-gray-300">
                            api.zedxe.com
                        </span>
                    </div>
                    <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                        <div className="space-y-5">
                            <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white md:text-6xl">
                                {title}
                            </h1>
                            <p className="max-w-3xl text-base leading-8 text-gray-300 md:text-lg">
                                {description}
                            </p>
                            <div className="flex flex-wrap gap-3">
                                <Link
                                    href={primaryCta.href}
                                    {...linkProps(primaryCta.external)}
                                    className="btn-glow inline-flex items-center gap-2 rounded-full bg-teal-400 px-5 py-3 text-sm font-semibold text-gray-900"
                                >
                                    {primaryCta.label}
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                                {secondaryCta ? (
                                    <Link
                                        href={secondaryCta.href}
                                        {...linkProps(secondaryCta.external)}
                                        className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/85 transition hover:border-white/30 hover:text-white"
                                    >
                                        {secondaryCta.label}
                                    </Link>
                                ) : null}
                            </div>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5 backdrop-blur-md">
                            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">What ships now</p>
                            <div className="mt-4 space-y-4 text-sm text-gray-300">
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="font-semibold text-white">Separate product surface</p>
                                    <p className="mt-2 leading-7 text-gray-300">
                                        <code>api.zedxe.com</code> stays backend-only. <code>zedxe.com/api</code> becomes the
                                        marketing, docs, and signup layer.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="font-semibold text-white">Plan-aware auth</p>
                                    <p className="mt-2 leading-7 text-gray-300">
                                        Site users graduate from anonymous access to signed JWT access without changing the
                                        statement contract.
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                    <p className="font-semibold text-white">Canonical financial data</p>
                                    <p className="mt-2 leading-7 text-gray-300">
                                        The main site can keep replacing older finance dependencies and standardize on Zapi as
                                        the source of record.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section className="container pb-6">
                <nav className="flex flex-wrap gap-3 rounded-full border border-white/10 bg-white/5 p-2 backdrop-blur-xl">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.href}
                            href={tab.href}
                            {...linkProps(tab.external)}
                            className="inline-flex min-h-11 items-center rounded-full border border-transparent px-4 text-sm font-medium text-gray-300 transition hover:border-white/10 hover:bg-white/5 hover:text-white"
                        >
                            {tab.label}
                        </Link>
                    ))}
                </nav>
            </section>
            <section className="container space-y-6 pb-20">{children}</section>
            <Footer />
        </main>
    );
};

export default ApiMarketingShell;
