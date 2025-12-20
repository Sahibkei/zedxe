"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "@/lib/actions/auth.actions";

type NavbarClientProps = {
    isSignedIn: boolean;
};

const NavbarClient = ({ isSignedIn }: NavbarClientProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    const handleLogout = async () => {
        await signOut();
        router.push("/");
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
                        <Link href="#product" className="transition hover:text-white">
                            Product
                        </Link>
                        <Link href="#features" className="transition hover:text-white">
                            Features
                        </Link>
                    </nav>
                    <div className="flex items-center gap-3">
                        {isSignedIn ? (
                            <>
                                <Link
                                    href="/app"
                                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:text-white"
                                >
                                    Dashboard
                                </Link>
                                <button
                                    type="button"
                                    onClick={handleLogout}
                                    className="btn-glow inline-flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-sm font-semibold text-gray-900"
                                >
                                    Logout
                                </button>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/sign-in?redirect=/app"
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
                            <Link href="#product" onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                Product
                            </Link>
                            <Link href="#features" onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                Features
                            </Link>
                            {isSignedIn ? (
                                <>
                                    <Link href="/app" onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                        Dashboard
                                    </Link>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await handleLogout();
                                            setIsOpen(false);
                                        }}
                                        className="text-left transition hover:text-white"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <Link href="/sign-in?redirect=/app" onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                        Login
                                    </Link>
                                    <Link href="#waitlist" onClick={() => setIsOpen(false)} className="transition hover:text-white">
                                        Join Waitlist
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </header>
    );
};

export default NavbarClient;
