'use client';

import { useEffect, useRef } from "react";

type TurnstileWidgetProps = {
    siteKey?: string;
    onSuccess: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
    onResetRef?: (reset: (() => void) | null) => void;
};

type TurnstileOptions = {
    sitekey: string;
    theme?: "dark" | "light";
    callback?: (token: string) => void;
    "expired-callback"?: () => void;
    "error-callback"?: () => void;
};

declare global {
    interface Window {
        turnstile?: {
            render: (container: HTMLElement, options: TurnstileOptions) => string;
            reset: (widgetId?: string) => void;
            remove: (widgetId: string) => void;
        };
    }
}

let turnstileScriptPromise: Promise<void> | null = null;

const loadTurnstileScript = () => {
    if (typeof window === "undefined") {
        return Promise.resolve();
    }

    if (window.turnstile) {
        return Promise.resolve();
    }

    if (turnstileScriptPromise) {
        return turnstileScriptPromise;
    }

    turnstileScriptPromise = new Promise((resolve, reject) => {
        const existingScript = document.getElementById("turnstile-script") as HTMLScriptElement | null;
        if (existingScript) {
            if (window.turnstile) {
                resolve();
                return;
            }
            existingScript.addEventListener("load", () => resolve(), { once: true });
            existingScript.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
            return;
        }

        const script = document.createElement("script");
        script.id = "turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
        document.head.appendChild(script);
    });

    return turnstileScriptPromise;
};

const TurnstileWidget = ({ siteKey, onSuccess, onExpire, onError, onResetRef }: TurnstileWidgetProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const resolvedSiteKey = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
    const successRef = useRef(onSuccess);
    const expireRef = useRef(onExpire);
    const errorRef = useRef(onError);

    useEffect(() => {
        successRef.current = onSuccess;
        expireRef.current = onExpire;
        errorRef.current = onError;
    }, [onSuccess, onExpire, onError]);

    useEffect(() => {
        let active = true;

        const renderWidget = async () => {
            if (!resolvedSiteKey) return;
            if (!containerRef.current) return;
            if (widgetIdRef.current) return;

            try {
                await loadTurnstileScript();
                if (!active || !window.turnstile || !containerRef.current) return;
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: resolvedSiteKey,
                    theme: "dark",
                    callback: (token: string) => successRef.current(token),
                    "expired-callback": () => expireRef.current?.(),
                    "error-callback": () => errorRef.current?.(),
                });
            } catch (error) {
                console.error("Turnstile failed to load", error);
                errorRef.current?.();
            }
        };

        renderWidget();

        return () => {
            active = false;
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, [resolvedSiteKey]);

    useEffect(() => {
        if (!onResetRef) return;
        const reset = () => {
            if (!window.turnstile || !widgetIdRef.current) return;
            window.turnstile.reset(widgetIdRef.current);
        };
        onResetRef(reset);
        return () => onResetRef(null);
    }, [onResetRef]);

    return (
        <div className="space-y-2">
            <div ref={containerRef} />
            {!resolvedSiteKey ? (
                <p className="text-xs text-red-400">Turnstile site key is not configured.</p>
            ) : null}
        </div>
    );
};

export default TurnstileWidget;
