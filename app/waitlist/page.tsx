import Navbar from "@/app/(marketing)/components/Navbar";
import Footer from "@/app/(marketing)/components/Footer";
import WaitlistForm from "@/app/waitlist/WaitlistForm";

/** Public waitlist landing page. */
const WaitlistPage = () => {
    return (
        <main className="relative overflow-hidden bg-gray-900 text-white">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 chart-bg" />
                <div className="absolute inset-0 grain" />
            </div>
            <Navbar />
            <section className="container py-16 md:py-24">
                <div className="mx-auto max-w-3xl space-y-8">
                    <div className="space-y-3 text-center">
                        <p className="text-xs uppercase tracking-[0.3em] text-teal-300">Waitlist</p>
                        <h1 className="text-3xl font-semibold text-white md:text-4xl">Request full access</h1>
                        <p className="text-base text-gray-300 md:text-lg">
                            We’re onboarding early users manually. Join the waitlist and we’ll reach out.
                        </p>
                    </div>
                    <div className="glass-card rounded-3xl p-8 md:p-12">
                        <WaitlistForm />
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
};

export default WaitlistPage;
