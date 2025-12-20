const tiers = [
    {
        name: "Private Beta",
        price: "Free",
        description: "Early access to real-time intelligence and watchlists.",
        features: ["Live market signals", "Custom alerts", "Core dashboards"],
    },
    {
        name: "Pro Desk",
        price: "$49/mo",
        description: "Built for active traders and small teams.",
        features: ["Advanced workflows", "AI market briefs", "Priority support"],
    },
    {
        name: "Enterprise",
        price: "Custom",
        description: "Custom SLAs, data integrations, and onboarding.",
        features: ["Dedicated solutions", "On-prem options", "Security reviews"],
    },
];

const Pricing = () => {
    return (
        <section id="pricing" className="container py-20">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Pricing</p>
                    <h2 className="text-3xl font-semibold text-white md:text-4xl">Flexible access for every desk.</h2>
                </div>
                <p className="max-w-md text-gray-300">
                    Start free in the private beta, then scale into automation and custom data pipelines.
                </p>
            </div>
            <div className="mt-10 grid gap-6 lg:grid-cols-3">
                {tiers.map((tier) => (
                    <div key={tier.name} className="glass-card flex h-full flex-col rounded-3xl p-6">
                        <h3 className="text-xl font-semibold text-white">{tier.name}</h3>
                        <p className="mt-2 text-3xl font-semibold text-white">{tier.price}</p>
                        <p className="mt-2 text-sm text-gray-300">{tier.description}</p>
                        <ul className="mt-6 space-y-2 text-sm text-gray-300">
                            {tier.features.map((feature) => (
                                <li key={feature} className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Pricing;
