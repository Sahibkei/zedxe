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
                });
                if (!response.ok) {
                    throw new Error("Sign out failed");
                }
                router.push("/sign-in");
                router.refresh();
                onSignedOut?.();
            } catch (error) {
                console.error("Sign out failed:", error);
                toast.error("Logout failed. Please try again.");
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
