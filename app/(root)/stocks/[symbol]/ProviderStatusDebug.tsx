'use client';

import React from 'react';

export function ProviderStatusDebug({ errors }: { errors?: string[] | null }) {
    const debugEnabled =
        process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_DEBUG_PROVIDER_STATUS === '1';

    if (!debugEnabled || !errors || errors.length === 0) return null;

    return (
        <details className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Provider debug</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
                {errors.map((error, idx) => (
                    <li key={`${error}-${idx}`}>{error}</li>
                ))}
            </ul>
        </details>
    );
}

export default ProviderStatusDebug;
