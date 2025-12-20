import { Fingerprint, Lock, ShieldCheck } from "lucide-react";

const securityItems = [
    {
        title: "Encrypted everywhere",
        description: "All customer data is encrypted in transit and at rest.",
        icon: Lock,
    },
    {
        title: "Granular access",
        description: "Role-based permissions keep teams aligned and secure.",
        icon: Fingerprint,
    },
    {
        title: "Audited systems",
        description: "Continuous monitoring and audit trails for every action.",
        icon: ShieldCheck,
    },
];

const Security = () => {
    return (
        <section id="security" className="container py-20">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8 md:p-12">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div className="space-y-3">
                        <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Security</p>
                        <h2 className="text-3xl font-semibold text-white md:text-4xl">
                            Built for regulated, mission-critical trading desks.
                        </h2>
                    </div>
                    <p className="max-w-md text-gray-300">
                        ZedXe is engineered with enterprise-grade controls so your data is always protected.
                    </p>
                </div>
                <div className="mt-10 grid gap-6 md:grid-cols-3">
                    {securityItems.map((item) => (
                        <div key={item.title} className="glass-card rounded-2xl p-6">
                            <item.icon className="h-6 w-6 text-teal-300" />
                            <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
                            <p className="mt-2 text-sm text-gray-300">{item.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Security;
