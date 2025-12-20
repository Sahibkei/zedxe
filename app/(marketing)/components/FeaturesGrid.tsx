import { Bell, Layers, LineChart, Zap } from "lucide-react";

const features = [
    {
        title: "Signal intelligence",
        description: "Track macro, sector, and single-name momentum with AI-ranked insights.",
        icon: LineChart,
    },
    {
        title: "Smart alerts",
        description: "Trigger multi-condition alerts across price, flow, and on-chain data.",
        icon: Bell,
    },
    {
        title: "Workflow automation",
        description: "Route insights to your team, Slack, or execution stack instantly.",
        icon: Zap,
    },
    {
        title: "Unified dashboards",
        description: "Blend watchlists, portfolios, and research in one customizable view.",
        icon: Layers,
    },
];

const FeaturesGrid = () => {
    return (
        <section id="features" className="container py-20">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Features</p>
                    <h2 className="text-3xl font-semibold text-white md:text-4xl">Everything you need to move faster.</h2>
                </div>
                <p className="max-w-md text-gray-300">
                    ZedXe layers real-time data, AI summarization, and alert routing into a modern command center.
                </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
                {features.map((feature) => (
                    <div key={feature.title} className="glass-card rounded-3xl p-6">
                        <feature.icon className="h-6 w-6 text-teal-300" />
                        <h3 className="mt-4 text-xl font-semibold text-white">{feature.title}</h3>
                        <p className="mt-2 text-sm text-gray-300">{feature.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default FeaturesGrid;
