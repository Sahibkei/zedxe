"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/actions/auth.actions";

type NavbarClientProps = {
    isSignedIn: boolean;
};

const NavbarClient = ({ isSignedIn }: NavbarClientProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const [signOutError, setSignOutError] = useState<string | null>(null);
    const router = useRouter();
    const pathname = usePathname();

    const navLinks = pathname?.startsWith("/api/docs")
        ? [
              { href: "/api", label: "API" },
              { href: "#endpoints", label: "Endpoints" },
              { href: "#auth", label: "Auth" },
          ]
        : pathname?.startsWith("/api/pricing")
          ? [
                { href: "/api", label: "API" },
                { href: "#plans", label: "Plans" },
                { href: "/api/docs", label: "Docs" },
            ]
        : pathname?.startsWith("/api")
          ? [
                { href: "#overview", label: "Overview" },
                { href: "#coverage", label: "Coverage" },
                { href: "/api/pricing", label: "Pricing" },
                { href: "/api/docs", label: "Docs" },
            ]
          : pathname === "/waitlist"
            ? [
                  { href: "/", label: "Home" },
                  { href: "/api", label: "API" },
                  { href: "/api/docs", label: "Docs" },
              ]
            : [
                  { href: "#product", label: "Product" },
                  { href: "#features", label: "Features" },
                  { href: "/api", label: "API" },
              ];

    const waitlistHref = pathname?.startsWith("/api") ? `/waitlist?from=${encodeURIComponent(pathname)}` : "/waitlist";
    const waitlistLabel = pathname?.startsWith("/api") ? "Request API Access" : "Join Waitlist";

    const handleLogout = async () => {
        if (isSigningOut) {
            return;
        }
        setIsSigningOut(true);
        setSignOutError(null);
        try {
            await signOut();
            router.push("/");
            router.refresh();
        } catch (error) {
            console.error("Sign out failed:", error);
            setSignOutError("Logout failed. Please try again.");
        } finally {
            setIsSigningOut(false);
        }
    };

    return (
        <header className="sticky top-6 z-50">
            <div className="container">
                <div className="flex items-center justify-between gap-6 rounded-full px-6 py-3 glass-nav">
                    <Link href="/" className="flex items-center">
                        <Image
                            src="/assets/icons/zedlogo.svg"
                            alt="ZedXe"
                            width={36}
                            height={36}
                            priority
                            className="h-8 w-8 drop-shadow-[0_0_10px_rgba(34,211,238,0.25)] md:h-9 md:w-9"
                        />
                    </Link>
                    <nav className="hidden items-center gap-6 text-sm text-gray-300 md:flex">
                        {navLinks.map((item) => (
                            <Link key={item.label} href={item.href} className="transition hover:text-white">
                                {item.label}
                            </Link>
                        ))}
                    </nav>
                    <div className="flex items-center gap-3">
                        {isSignedIn ? (
                            <>
                                <Link
                                    href="/dashboard"
                                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:text-white"
                                >
                                    Dashboard
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="btn-glow inline-flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-gray-900 disabled:cursor-not-allowed disabled:opacity-70"
                                    disabled={isSigningOut}
                                >
                                    {isSigningOut ? "Logging out..." : "Logout"}
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href={`/sign-in?redirect=${encodeURIComponent("/dashboard")}`}
                                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:text-white"
                                >
                                    Login
                                </Link>
                                <Link
                                    href={waitlistHref}
                                    className="btn-glow inline-flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-gray-900"
                                >
                                    {waitlistLabel}
                                    <ArrowUpRight className="h-4 w-4" />
                                </Link>
                            </>
                        )}
                        <button
                            type="button"
                            className="inline-flex items-center justify-center rounded-full border border-white/20 p-2 text-white/80 transition hover:text-white md:hidden"
                            aria-label="Toggle navigation menu"
                            aria-expanded={isOpen}
                            onClick={() => setIsOpen((prev) => !prev)}
                        >
                            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>
                {isOpen ? (
                    <div className="mt-3 rounded-2xl px-4 py-3 glass-nav md:hidden">
                        <div className="flex flex-col gap-3 text-sm text-gray-200">
                            {navLinks.map((item) => (
                                <Link key={item.label} href={item.href} onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                    {item.label}
                                </Link>
                            ))}
                            {isSignedIn ? (
                                <>
                                    <Link href="/dashboard" onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                        Dashboard
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleLogout();
                                            setIsOpen(false);
                                        }}
                                        className="text-left transition hover:text-white"
                                        disabled={isSigningOut}
                                    >
                                        {isSigningOut ? "Logging out..." : "Logout"}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href={`/sign-in?redirect=${encodeURIComponent("/dashboard")}`}
                                        onClick={() => setIsOpen(false)}
                                        className="transition hover:text-white"
                                    >
                                        Login
                                    </Link>
                                    <Link href={waitlistHref} onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                        {waitlistLabel}
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                ) : null}
                {signOutError ? (
                    <p className="mt-3 text-xs text-red-300 md:text-sm">{signOutError}</p>
                ) : null}
            </div>
        </header>
    );
};

export default NavbarClient;
