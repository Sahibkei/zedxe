"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";

type ApiCredentialPanelProps = {
    token: string;
    curlExample: string;
};

function maskToken(token: string): string {
    if (token.length <= 32) return token;
    return `${token.slice(0, 24)}...${token.slice(-16)}`;
}

const ApiCredentialPanel = ({ token, curlExample }: ApiCredentialPanelProps) => {
    const [revealed, setRevealed] = useState(false);
    const [copiedField, setCopiedField] = useState<"token" | "curl" | null>(null);
    const [copyError, setCopyError] = useState<string | null>(null);

    const displayToken = useMemo(() => (revealed ? token : maskToken(token)), [revealed, token]);

    const copyValue = async (value: string, field: "token" | "curl") => {
        try {
            await navigator.clipboard.writeText(value);
            setCopyError(null);
            setCopiedField(field);
            window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1800);
        } catch {
            setCopyError("Clipboard access was blocked. Reveal the token and copy it manually.");
            setCopiedField(null);
        }
    };

    return (
        <div className="space-y-5">
            <div className="rounded-[1.5rem] border border-white/10 bg-[#08121d]/90 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-blue-200">Personal bearer token</p>
                        <p className="mt-2 text-sm text-slate-300">
                            This token is tied to your site account and can be used against <code>api.zedxe.com</code>.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={() => setRevealed((value) => !value)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20 hover:text-white"
                        >
                            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                            {revealed ? "Hide" : "Reveal"}
                        </button>
                        <button
                            type="button"
                            onClick={() => copyValue(token, "token")}
                            className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-teal-300"
                        >
                            {copiedField === "token" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copiedField === "token" ? "Copied" : "Copy token"}
                        </button>
                    </div>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#050c15] p-4 text-xs leading-7 text-slate-200">
                    <code aria-hidden={!revealed}>{displayToken}</code>
                    {!revealed ? <span className="sr-only">Masked personal token. Use Reveal to expose it or Copy token to copy it.</span> : null}
                </pre>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-[#08121d]/90 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-blue-200">Sample request</p>
                        <p className="mt-2 text-sm text-slate-300">
                            Paste the token above into this request to test your account-level access.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => copyValue(curlExample, "curl")}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-200 transition hover:border-white/20 hover:text-white"
                    >
                        {copiedField === "curl" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedField === "curl" ? "Copied" : "Copy curl"}
                    </button>
                </div>
                <pre className="mt-4 overflow-x-auto rounded-2xl border border-white/10 bg-[#050c15] p-4 text-xs leading-7 text-slate-200">
                    <code>{curlExample}</code>
                </pre>
            </div>
            {copyError ? <p className="text-sm text-amber-200">{copyError}</p> : null}
        </div>
    );
};

export default ApiCredentialPanel;
