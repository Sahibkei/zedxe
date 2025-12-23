"use client";

import { forwardRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type LogoutButtonProps = Omit<React.ComponentPropsWithoutRef<"button">, "children" | "onClick"> & {
    children: React.ReactNode | ((state: { isSigningOut: boolean }) => React.ReactNode);
    onSignedOut?: () => void;
};

const LogoutButton = forwardRef<HTMLButtonElement, LogoutButtonProps>(
    ({ children, onSignedOut, disabled, ...props }, ref) => {
        const router = useRouter();
        const [isSigningOut, setIsSigningOut] = useState(false);

        const handleLogout = async () => {
            if (isSigningOut) {
                return;
            }
            setIsSigningOut(true);
            try {
                const response = await fetch("/api/auth/sign-out", {
                    method: "POST",
                    credentials: "include",
                });
                const contentType = response.headers.get("content-type") ?? "";
                const payload = contentType.includes("application/json") ? await response.json() : null;

                if (!response.ok) {
                    toast.error("Logout failed", {
                        description: payload?.message ?? "Logout failed. Please try again.",
                    });
                    return;
                }

                toast.success("Logged out successfully");
                router.push("/sign-in");
                router.refresh();
                onSignedOut?.();
            } catch (error) {
                toast.error("Logout failed", {
                    description: error instanceof Error ? error.message : "Logout failed. Please try again.",
                });
            } finally {
                setIsSigningOut(false);
            }
        };

        const content = typeof children === "function" ? children({ isSigningOut }) : children;

        return (
            <button
                ref={ref}
                type="button"
                onClick={handleLogout}
                disabled={disabled || isSigningOut}
                {...props}
            >
                {content}
            </button>
        );
    },
);

LogoutButton.displayName = "LogoutButton";

export default LogoutButton;
