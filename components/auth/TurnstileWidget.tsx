'use client';

import { useEffect, useRef, useState } from "react";
import Script from "next/script";

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
        };
    }
}

const TurnstileWidget = ({ siteKey, onSuccess, onExpire, onError }: TurnstileWidgetProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const [scriptLoaded, setScriptLoaded] = useState(false);
    const resolvedSiteKey = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

    useEffect(() => {
        if (!scriptLoaded) return;
        if (!resolvedSiteKey) return;
        if (!containerRef.current) return;
        if (!window.turnstile) return;

        if (widgetIdRef.current) {
            window.turnstile.reset(widgetIdRef.current);
            return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: resolvedSiteKey,
            theme: "dark",
            callback: onSuccess,
            "expired-callback": onExpire,
            "error-callback": onError,
        });
    }, [scriptLoaded, resolvedSiteKey, onSuccess, onExpire, onError]);

    return (
        <div className="space-y-2">
            <Script
                src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
                strategy="afterInteractive"
                onLoad={() => setScriptLoaded(true)}
            />
            <div ref={containerRef} />
            {!resolvedSiteKey ? (
                <p className="text-xs text-red-400">Turnstile site key is not configured.</p>
            ) : null}
        </div>
    );
};

export default TurnstileWidget;
