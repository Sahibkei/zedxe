import WaitlistForm from "@/app/(marketing)/components/WaitlistForm";

const WaitlistCTA = () => {
    return (
        <section id="waitlist" className="container py-24">
            <div className="glass-card rounded-3xl p-8 md:p-12">
                <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-4">
                        <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Waitlist</p>
                        <h2 className="text-3xl font-semibold text-white md:text-4xl">
                            Be first in line for the ZedXe launch.
                        </h2>
                        <p className="text-gray-300">
                            Join early access to receive product updates, beta invitations, and launch perks.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                        <WaitlistForm />
                        <p className="mt-4 text-xs text-gray-400">
                            By joining, you agree to receive product emails. We never share your data.
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default WaitlistCTA;
