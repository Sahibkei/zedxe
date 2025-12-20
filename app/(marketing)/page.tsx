import Navbar from "@/app/(marketing)/components/Navbar";
import Hero from "@/app/(marketing)/components/Hero";
import Workflow from "@/app/(marketing)/components/Workflow";
import Security from "@/app/(marketing)/components/Security";
import WaitlistCTA from "@/app/(marketing)/components/WaitlistCTA";
import Footer from "@/app/(marketing)/components/Footer";

export default function MarketingPage() {
    return (
        <main className="relative overflow-hidden bg-gray-900 text-white">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute inset-0 chart-bg" />
                <div className="absolute inset-0 grain" />
            </div>
            <Navbar />
            <Hero />
            <Workflow />
            <Security />
            <WaitlistCTA />
            <Footer />
        </main>
    );
}
