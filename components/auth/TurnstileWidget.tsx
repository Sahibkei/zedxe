'use client';

import { useEffect, useRef, useState } from "react";
import { loadTurnstile, resetTurnstileLoader } from "@/lib/turnstile/loader";
import { Button } from "@/components/ui/button";

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

const TurnstileWidget = ({ siteKey, onSuccess, onExpire, onError, onResetRef }: TurnstileWidgetProps) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const widgetIdRef = useRef<string | null>(null);
    const resolvedSiteKey = siteKey ?? process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
    const successRef = useRef(onSuccess);
    const expireRef = useRef(onExpire);
    const errorRef = useRef(onError);
    const [renderError, setRenderError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    const scriptErrorRef = useRef(false);
    const maxRetries = 2;

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
                await loadTurnstile();
                if (!active || !window.turnstile || !containerRef.current) return;
                widgetIdRef.current = window.turnstile.render(containerRef.current, {
                    sitekey: resolvedSiteKey,
                    theme: "dark",
                    callback: (token: string) => successRef.current(token),
                    "expired-callback": () => expireRef.current?.(),
                    "error-callback": () => errorRef.current?.(),
                });
                scriptErrorRef.current = false;
                setRenderError(null);
            } catch (error) {
                console.error("Turnstile failed to load", error);
                const isScriptError = error instanceof Error && error.name === "TurnstileScriptLoadError";
                if (isScriptError) {
                    scriptErrorRef.current = true;
                    resetTurnstileLoader();
                }
                if (retryCount < maxRetries) {
                    setRetryCount((prev) => prev + 1);
                    return;
                }
                setRenderError("Human verification is unavailable. Please retry.");
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
    }, [resolvedSiteKey, retryCount]);

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
            {renderError ? (
                <div className="space-y-2">
                    <p className="text-xs text-red-400">{renderError}</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (scriptErrorRef.current) {
                                resetTurnstileLoader();
                                scriptErrorRef.current = false;
                            }
                            widgetIdRef.current = null;
                            if (containerRef.current) {
                                containerRef.current.innerHTML = "";
                            }
                            setRenderError(null);
                            setRetryCount(0);
                        }}
                    >
                        Retry
                    </Button>
                </div>
            ) : null}
        </div>
    );
};

export default TurnstileWidget;
