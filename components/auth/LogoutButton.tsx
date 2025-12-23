"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import clsx from "clsx";

type LogoutButtonProps = {
    children: React.ReactNode;
    className?: string;
    onSignedOut?: () => void;
};

const LogoutButton = ({ children, className, onSignedOut }: LogoutButtonProps) => {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const handleLogout = () => {
        if (isPending) return;
        startTransition(async () => {
            try {
                const response = await fetch("/api/auth/sign-out", {
                    method: "POST",
                    credentials: "include",
                    cache: "no-store",
                });
                if (!response.ok) {
                    let message = "Logout failed. Please try again.";
                    const contentType = response.headers.get("content-type") ?? "";
                    if (contentType.includes("application/json")) {
                        const payload = await response.json().catch(() => null);
                        message = payload?.message ?? message;
                    } else {
                        const text = await response.text().catch(() => "");
                        if (text) message = text;
                    }
                    toast.error(message);
                    return;
                }
                onSignedOut?.();
                router.replace("/sign-in");
                router.refresh();
                toast.success("Logged out");
            } catch (error) {
                console.error("Sign out failed:", error);
                router.replace("/sign-in");
                router.refresh();
            }
        });
    };

    return (
        <button
            type="button"
            onClick={handleLogout}
            className={clsx(className, "disabled:cursor-not-allowed disabled:opacity-70")}
            disabled={isPending}
        >
            {children}
        </button>
    );
};

export default LogoutButton;
