let turnstileScriptPromise: Promise<void> | null = null;
let lastError: Error | null = null;

const SCRIPT_ID = "turnstile-script";
const SCRIPT_DATA_ATTR = "data-turnstile-script";
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_LOAD_TIMEOUT_MS = 4000;

const createScriptLoadError = (message: string) => {
    const error = new Error(message);
    error.name = "TurnstileScriptLoadError";
    return error;
};

const createTurnstileUnavailableError = (message: string) => {
    const error = new Error(message);
    error.name = "TurnstileUnavailableError";
    return error;
};

const getExistingScript = () => {
    return (
        document.getElementById(SCRIPT_ID) ??
        document.querySelector(`script[${SCRIPT_DATA_ATTR}="true"]`)
    ) as HTMLScriptElement | null;
};

const waitForTurnstileReady = () => {
    return new Promise<void>((resolve, reject) => {
        const startedAt = Date.now();
        const checkReady = () => {
            if (window.turnstile) {
                resolve();
                return;
            }

            if (Date.now() - startedAt >= TURNSTILE_LOAD_TIMEOUT_MS) {
                reject(createTurnstileUnavailableError("Turnstile failed to initialize."));
                return;
            }

            setTimeout(checkReady, 50);
        };

        checkReady();
    });
};

export const loadTurnstile = () => {
    if (typeof window === "undefined") {
        return Promise.resolve();
    }

    if (window.turnstile) {
        lastError = null;
        return Promise.resolve();
    }

    if (turnstileScriptPromise) {
        return turnstileScriptPromise;
    }

    turnstileScriptPromise = new Promise((resolve, reject) => {
        let settled = false;
        const finishResolve = () => {
            if (settled) return;
            settled = true;
            lastError = null;
            resolve();
        };
        const finishReject = (error: Error) => {
            if (settled) return;
            settled = true;
            lastError = error;
            turnstileScriptPromise = null;
            reject(error);
        };

        const handleReady = () => {
            waitForTurnstileReady().then(finishResolve).catch(finishReject);
        };

        const existingScript = getExistingScript();
        if (existingScript) {
            existingScript.addEventListener("load", handleReady, { once: true });
            existingScript.addEventListener(
                "error",
                () => finishReject(createScriptLoadError("Turnstile failed to load.")),
                { once: true },
            );
            handleReady();
            return;
        }

        const script = document.createElement("script");
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.setAttribute(SCRIPT_DATA_ATTR, "true");
        script.addEventListener("load", handleReady, { once: true });
        script.addEventListener(
            "error",
            () => finishReject(createScriptLoadError("Turnstile failed to load.")),
            { once: true },
        );
        document.head.appendChild(script);
    });

    return turnstileScriptPromise;
};

export const resetTurnstileLoader = () => {
    turnstileScriptPromise = null;
    lastError = null;

    if (typeof window === "undefined") {
        return;
    }

    const existingScript = getExistingScript();
    if (existingScript) {
        existingScript.remove();
    }
};
