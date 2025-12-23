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
                const isSuccess = response.status >= 200 && response.status < 400;
                if (!isSuccess) {
                    const contentType = response.headers.get("content-type") ?? "";
                    const payload = contentType.includes("application/json") ? await response.json() : null;
                    const message = payload?.message ?? "Logout failed. Please try again.";
                    throw new Error(message);
                }
                onSignedOut?.();
                router.replace("/sign-in");
                router.refresh();
                setTimeout(() => {
                    window.location.assign("/sign-in");
                }, 150);
            } catch (error) {
                console.error("Sign out failed:", error);
                const message = error instanceof Error ? error.message : "Logout failed. Please try again.";
                toast.error(message);
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
