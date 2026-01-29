import Link from "next/link";

import { Button } from "@/components/ui/button";

const MODELS = [
    {
        title: "Probability (Now)",
        description: "Real-time probability by horizon close (END event).",
        badge: "MVP",
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        ctaLabel: "Open model",
        ctaDisabled: false,
        ctaHint: "Open Probability (Now)",
        ctaHref: "/models/probability",
    },
    {
        title: "Volatility",
        description: "BTC implied volatility surface with live Deribit data.",
        badge: "MVP",
        badgeClass: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        ctaLabel: "Open model",
        ctaDisabled: false,
        ctaHint: "Open Volatility",
        ctaHref: "/models/volatility",
    },
    {
        title: "Monte Carlo",
        description: "Scenario simulation surfaces (coming soon).",
        badge: "Coming soon",
        badgeClass: "border-gray-700 bg-gray-800/60 text-gray-300",
        ctaLabel: "Coming soon",
        ctaDisabled: true,
        ctaHint: "Available in a future update",
    },
];

const ModelsPage = () => (
    <section className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <header className="space-y-3">
            <h1 className="text-3xl font-semibold text-white">Models</h1>
            <p className="text-gray-400">
                Explore quantitative models and tools available in ZedXe.
            </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {MODELS.map((model) => (
                <div
                    key={model.title}
                    className="flex h-full flex-col justify-between rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20"
                >
                    <div className="space-y-4">
                        <div className="flex items-center justify-between gap-4">
                            <h2 className="text-lg font-semibold text-white">
                                {model.title}
                            </h2>
                            <span
                                className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${model.badgeClass}`}
                            >
                                {model.badge}
                            </span>
                        </div>
                        <p className="text-sm text-gray-400">
                            {model.description}
                        </p>
                    </div>
                    <div className="pt-6">
                        {model.ctaHref ? (
                            <Button
                                asChild
                                className="w-full bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                                title={model.ctaHint}
                            >
                                <Link href={model.ctaHref}>
                                    {model.ctaLabel}
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                className="w-full bg-gray-800 text-gray-500"
                                disabled={model.ctaDisabled}
                                title={model.ctaHint}
                            >
                                {model.ctaLabel}
                            </Button>
                        )}
                    </div>
                </div>
            ))}
        </div>
    </section>
);

export default ModelsPage;
