let loadPromise: Promise<void> | null = null;

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const resolveWhenReady = (resolve: () => void, reject: (error: Error) => void) => {
    if (typeof window === "undefined") {
        resolve();
        return;
    }

    if (window.turnstile) {
        resolve();
        return;
    }

    reject(new Error("Turnstile did not initialize"));
};

export const loadTurnstile = (): Promise<void> => {
    if (typeof window === "undefined") {
        return Promise.resolve();
    }

    if (window.turnstile) {
        return Promise.resolve();
    }

    if (loadPromise) {
        return loadPromise;
    }

    loadPromise = new Promise((resolve, reject) => {
        const handleResolve = () =>
            resolveWhenReady(
                resolve,
                (error) => {
                    loadPromise = null;
                    reject(error);
                },
            );
        const handleReject = () => {
            loadPromise = null;
            reject(new Error("Turnstile failed to load"));
        };

        const existingScript = document.querySelector<HTMLScriptElement>(
            `script[data-turnstile="true"], script[src="${TURNSTILE_SRC}"]`,
        );

        if (existingScript) {
            if (window.turnstile) {
                resolve();
                return;
            }

            const isLoaded =
                existingScript.dataset.turnstileLoaded === "true" ||
                existingScript.readyState === "complete" ||
                existingScript.readyState === "loaded";
            if (isLoaded) {
                handleResolve();
                return;
            }

            existingScript.addEventListener("load", handleResolve, { once: true });
            existingScript.addEventListener("error", handleReject, { once: true });
            return;
        }

        const script = document.createElement("script");
        script.src = TURNSTILE_SRC;
        script.async = true;
        script.defer = true;
        script.dataset.turnstile = "true";
        script.addEventListener(
            "load",
            () => {
                script.dataset.turnstileLoaded = "true";
                handleResolve();
            },
            { once: true },
        );
        script.addEventListener("error", handleReject, { once: true });
        document.head.appendChild(script);
    });

    return loadPromise;
};
