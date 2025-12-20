import Link from "next/link";
import { ArrowUpRight, BarChart3, Radar, Sparkles } from "lucide-react";

const Hero = () => {
    return (
        <section id="product" className="container pb-20 pt-16 md:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                    <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.3em] text-teal-300">
                        <Sparkles className="h-4 w-4" />
                        Market Intelligence, Supercharged
                    </p>
                    <h1 className="text-4xl font-semibold leading-tight text-white md:text-6xl">
                        Trade with clarity on a unified, real-time cockpit.
                    </h1>
                    <p className="text-lg text-gray-300 md:text-xl">
                        ZedXe streams market signals, AI insights, and custom alerts into a single view so you can move
                        faster with confidence.
                    </p>
                    <div className="flex flex-wrap items-center gap-4">
                        <Link
                            href="#waitlist"
                            className="btn-glow inline-flex items-center gap-2 rounded-full bg-teal-400 px-6 py-3 text-sm font-semibold text-gray-900"
                        >
                            Join the waitlist
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                        <Link
                            href="/sign-in"
                            className="inline-flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white/80 transition hover:text-white"
                        >
                            View dashboard
                        </Link>
                    </div>
                    <div className="flex flex-wrap gap-6 text-sm text-gray-300">
                        <div className="flex items-center gap-2">
                            <Radar className="h-4 w-4 text-teal-300" />
                            Signal scans every minute
                        </div>
                        <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-blue-300" />
                            Unified portfolio intelligence
                        </div>
                    </div>
                </div>
                <div className="glass-card rounded-3xl p-6 md:p-8">
                    <div className="flex items-center justify-between text-sm text-gray-300">
                        <span>Live Market Pulse</span>
                        <span className="rounded-full bg-teal-400/20 px-3 py-1 text-xs text-teal-200">+12% today</span>
                    </div>
                    <div className="mt-6 space-y-4">
                        {[
                            { label: "Macro sentiment", value: "Bullish", color: "text-teal-300" },
                            { label: "Volatility radar", value: "Stable", color: "text-blue-300" },
                            { label: "Smart alerts", value: "5 active", color: "text-purple-300" },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                                <span className="text-sm text-gray-300">{item.label}</span>
                                <span className={`text-sm font-semibold ${item.color}`}>{item.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-4 text-sm text-gray-200">
                        "ZedXe turns chaotic data into a clean, actionable story."
                        <p className="mt-3 text-xs text-gray-400">— Private beta trader</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
