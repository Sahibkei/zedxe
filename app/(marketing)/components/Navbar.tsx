import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const Navbar = () => {
    return (
        <header className="sticky top-6 z-50">
            <div className="container">
                <div className="flex items-center justify-between gap-6 rounded-full px-6 py-3 glass-nav">
                    <Link href="/" className="text-sm font-semibold tracking-[0.3em] text-white">
                        ZEDXE
                    </Link>
                    <nav className="hidden items-center gap-6 text-sm text-gray-300 md:flex">
                        <Link href="#product" className="transition hover:text-white">
                            Product
                        </Link>
                        <Link href="#security" className="transition hover:text-white">
                            Security
                        </Link>
                    </nav>
                    <div className="flex items-center gap-3">
                        <Link
                            href="/sign-in"
                            className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:text-white"
                        >
                            Login
                        </Link>
                        <Link
                            href="#waitlist"
                            className="btn-glow inline-flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-gray-900"
                        >
                            Join Waitlist
                            <ArrowUpRight className="h-4 w-4" />
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
