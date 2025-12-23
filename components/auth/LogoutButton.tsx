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
                const contentLength = response.headers.get("content-length");

                if (!response.ok) {
                    let message = "Logout failed. Please try again.";
                    if (contentType.includes("application/json") && contentLength !== "0") {
                        try {
                            const payload = await response.json();
                            message = payload?.message ?? message;
                        } catch {
                            // Ignore JSON parsing errors and keep the default message.
                        }
                    }
                    toast.error(message);
                    return;
                }

                onSignedOut?.();
                toast.success("Logged out");
                router.push("/sign-in");
                router.refresh();
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
