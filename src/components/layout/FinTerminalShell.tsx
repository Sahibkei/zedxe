import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import SearchCommand from "@/components/SearchCommand";
import UserDropdown from "@/components/UserDropdown";

const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/watchlist", label: "Watchlist" },
    { href: "/portfolio", label: "Portfolio" },
];

export default function FinTerminalShell({
    user,
    initialStocks,
    children,
}: {
    user: User;
    initialStocks: StockWithWatchlistStatus[];
    children: ReactNode;
}) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-200">
            <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur">
                <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-4 py-4 md:px-6">
                    <div className="flex items-center gap-6">
                        <Link href="/dashboard" className="flex items-center gap-3">
                            <Image
                                src="/assets/icons/zedlogo.svg"
                                alt="ZedXe logo"
                                width={120}
                                height={28}
                                className="h-7 w-auto"
                            />
                        </Link>
                        <nav className="hidden items-center gap-5 text-sm font-medium md:flex">
                            {navLinks.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="text-slate-400 transition-colors hover:text-slate-100"
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden md:flex">
                            <SearchCommand renderAs="button" label="Search" initialStocks={initialStocks} />
                        </div>
                        <UserDropdown user={user} initialStocks={initialStocks} />
                    </div>
                </div>
            </header>

            <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">{children}</main>
        </div>
    );
}
