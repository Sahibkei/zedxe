'use client';

import { useEffect, useRef } from "react";

type TurnstileWidgetProps = {
    siteKey?: string;
    onSuccess: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
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

const TurnstileWidget = ({ siteKey, onSuccess, onExpire, onError }: TurnstileWidgetProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const scriptLoadedRef = useRef(false);
    const renderRequestedRef = useRef(false);
    const resolvedSiteKey = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

    useEffect(() => {
        const renderWidget = () => {
            if (!resolvedSiteKey) return;
            if (!containerRef.current) return;
            if (!window.turnstile) return;
            if (widgetIdRef.current) return;

            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: resolvedSiteKey,
                theme: "dark",
                callback: onSuccess,
                "expired-callback": onExpire,
                "error-callback": onError,
            });
        };

        if (window.turnstile) {
            renderWidget();
            return;
        }

        const scriptId = "turnstile-script";
        const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
        const onLoad = () => {
            scriptLoadedRef.current = true;
            renderWidget();
        };

        if (existingScript) {
            if (scriptLoadedRef.current) {
                renderWidget();
                return;
            }
            existingScript.addEventListener("load", onLoad, { once: true });
            return () => existingScript.removeEventListener("load", onLoad);
        }

        if (renderRequestedRef.current) return;
        renderRequestedRef.current = true;

        const script = document.createElement("script");
        script.id = scriptId;
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        script.addEventListener("load", onLoad, { once: true });
        document.head.appendChild(script);

        return () => {
            script.removeEventListener("load", onLoad);
        };
    }, [resolvedSiteKey, onSuccess, onExpire, onError]);

    useEffect(() => {
        return () => {
            if (widgetIdRef.current && window.turnstile) {
                window.turnstile.remove(widgetIdRef.current);
                widgetIdRef.current = null;
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
        };
    }, []);

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
