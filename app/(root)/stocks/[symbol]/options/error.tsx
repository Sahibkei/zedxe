"use client";

type OptionsErrorProps = {
    error: Error & { digest?: string };
    reset: () => void;
};

export default function OptionsError({ error, reset }: OptionsErrorProps) {
    return (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
            <div className="space-y-2">
                <h2 className="text-base font-semibold">Something went wrong loading Options Analysis.</h2>
                <p>{error?.message || "Unexpected error. Please try again."}</p>
            </div>
            <button
                type="button"
                onClick={reset}
                className="mt-4 inline-flex items-center rounded-lg border border-destructive/40 px-3 py-1 text-xs font-semibold hover:bg-destructive/10"
            >
                Try again
            </button>
        </div>
    );
}
