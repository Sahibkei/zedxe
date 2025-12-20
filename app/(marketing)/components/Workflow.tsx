import { Activity, CheckCircle2, Cpu } from "lucide-react";

const steps = [
    {
        title: "Connect",
        description: "Plug in watchlists, portfolios, and exchange feeds in minutes.",
        icon: Cpu,
    },
    {
        title: "Analyze",
        description: "AI curates market context, highlighting what matters most.",
        icon: Activity,
    },
    {
        title: "Act",
        description: "Automate alerts, share briefings, and execute with conviction.",
        icon: CheckCircle2,
    },
];

const Workflow = () => {
    return (
        <section className="container py-20">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-12">
                <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Workflow</p>
                        <h2 className="text-3xl font-semibold text-white md:text-4xl">A modern trading workflow in three moves.</h2>
                        <p className="text-gray-300">
                            Turn fragmented data into a streamlined process from signal discovery to execution.
                        </p>
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                        {steps.map((step) => (
                            <div key={step.title} className="glass-card rounded-2xl p-6">
                                <step.icon className="h-6 w-6 text-teal-300" />
                                <h3 className="mt-4 text-lg font-semibold text-white">{step.title}</h3>
                                <p className="mt-2 text-sm text-gray-300">{step.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Workflow;
