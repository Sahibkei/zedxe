'use client';

import { useEffect, useId, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { loadTurnstile } from "@/lib/turnstile/loader";

type TurnstileWidgetProps = {
    siteKey?: string;
    onSuccess: (token: string) => void;
    onExpire?: () => void;
    onError?: () => void;
    onResetRef?: (reset: (() => void) | null) => void;
    instanceKey?: string;
    onTokenReset?: () => void;
    onWidgetReset?: () => void;
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

const TurnstileWidget = ({
    siteKey,
    onSuccess,
    onExpire,
    onError,
    onResetRef,
    instanceKey,
    onTokenReset,
    onWidgetReset,
}: TurnstileWidgetProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const retryCountRef = useRef(0);
    const resolvedSiteKey = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
    const successRef = useRef(onSuccess);
    const expireRef = useRef(onExpire);
    const errorRef = useRef(onError);
    const tokenResetRef = useRef(onTokenReset);
    const widgetResetRef = useRef(onWidgetReset);
    const pathname = usePathname();
    const reactId = useId();
    const [renderNonce, setRenderNonce] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const renderKey = instanceKey ?? pathname ?? "";

    useEffect(() => {
        successRef.current = onSuccess;
        expireRef.current = onExpire;
        errorRef.current = onError;
        tokenResetRef.current = onTokenReset;
        widgetResetRef.current = onWidgetReset;
    }, [onSuccess, onExpire, onError, onTokenReset, onWidgetReset]);

    useEffect(() => {
        retryCountRef.current = 0;
        setErrorMessage(null);
    }, [resolvedSiteKey, renderKey]);

    useEffect(() => {
        let active = true;

        const handleSuccess = (token: string) => successRef.current(token);
        const handleExpire = () => {
            tokenResetRef.current?.();
            expireRef.current?.();
        };
        const handleError = (shouldRerender: boolean) => {
            tokenResetRef.current?.();
            errorRef.current?.();
            if (shouldRerender && retryCountRef.current < 1) {
                retryCountRef.current += 1;
                setRenderNonce((prev) => prev + 1);
                return;
            }
            setErrorMessage("Verification failed to load. Please disable blockers and refresh.");
        };

        const renderWidget = async () => {
            if (!resolvedSiteKey) return;
            if (!containerRef.current) return;
            if (widgetIdRef.current) return;

            try {
                await loadTurnstile();
                if (!active || !window.turnstile || !containerRef.current) return;
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: resolvedSiteKey,
                    theme: "dark",
                    callback: handleSuccess,
                    "expired-callback": handleExpire,
                    "error-callback": () => handleError(true),
                });
            } catch (error) {
                console.error("Turnstile failed to load", error);
                handleError(false);
            }
        };

        renderWidget();

        return () => {
            active = false;
            if (widgetIdRef.current && window.turnstile) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch (error) {
                    console.warn("Turnstile cleanup failed", error);
                }
                widgetIdRef.current = null;
            }
            if (containerRef.current) {
                containerRef.current.innerHTML = "";
            }
            tokenResetRef.current?.();
        };
    }, [resolvedSiteKey, renderKey, renderNonce]);

    useEffect(() => {
        if (!onResetRef) return;
        const reset = () => {
            if (!window.turnstile || !widgetIdRef.current) return;
            window.turnstile.reset(widgetIdRef.current);
            widgetResetRef.current?.();
        };
        onResetRef(reset);
        return () => onResetRef(null);
    }, [onResetRef]);

    return (
        <div className="space-y-2">
            <div id={`turnstile-${reactId}`} ref={containerRef} />
            {errorMessage ? (
                <p className="text-xs text-red-400" role="alert" aria-live="polite">
                    {errorMessage}
                </p>
            ) : null}
            {!resolvedSiteKey ? (
                <p className="text-xs text-red-400">Turnstile site key is not configured.</p>
            ) : null}
        </div>
    );
};

export default TurnstileWidget;
