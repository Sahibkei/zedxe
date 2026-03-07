"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";

type TerminalIndexConstituentsButtonProps = {
    symbol: string;
    label: string;
};

const SUPPORTED_INDEX_SYMBOLS = new Set(["^GSPC", "^NDX", "^DJI"]);

export default function TerminalIndexConstituentsButton({
    symbol,
    label,
}: TerminalIndexConstituentsButtonProps) {
    if (!SUPPORTED_INDEX_SYMBOLS.has(symbol.toUpperCase())) return null;

    return (
        <Link
            href={`/terminal/constituents?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`}
            className="terminal-mini-btn"
        >
            <Building2 className="h-4 w-4" />
            Constituents
        </Link>
    );
}
