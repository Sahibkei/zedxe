"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";

type TopNavProps = {
    user: User;
    initialStocks: StockWithWatchlistStatus[];
};

const TopNav = ({ user, initialStocks }: TopNavProps) => {
    const [menuOpen, setMenuOpen] = useState(false);

    return (
        <header className="fixed top-0 z-50 w-full border-b border-[#1c2432] bg-[#0a0e14]/95 backdrop-blur">
            <div className="container flex h-16 items-center justify-between gap-4">
                <Link href="/app" className="flex items-center gap-2">
                    <Image
                        src="/assets/icons/zedlogo.svg"
                        alt="ZedXe logo"
                        width={140}
                        height={32}
                        className="h-8 w-auto"
                    />
                    <span className="sr-only">ZedXe</span>
                </Link>

                <nav className="hidden items-center lg:flex">
                    <NavItems initialStocks={initialStocks} />
                </nav>

                <div className="flex items-center gap-2">
                    <div className="hidden sm:block">
                        <UserDropdown user={user} initialStocks={initialStocks} />
                    </div>
                    <button
                        type="button"
                        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
                        aria-expanded={menuOpen}
                        onClick={() => setMenuOpen((open) => !open)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#1c2432] text-slate-200 transition hover:text-[#58a6ff] lg:hidden"
                    >
                        {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            <div className={`${menuOpen ? "block" : "hidden"} border-t border-[#1c2432] bg-[#0a0e14] lg:hidden`}>
                <div className="container space-y-4 py-4">
                    <NavItems initialStocks={initialStocks} />
                    <div className="sm:hidden">
                        <UserDropdown user={user} initialStocks={initialStocks} />
                    </div>
                </div>
            </div>
        </header>
    );
};

export default TopNav;
