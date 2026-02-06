export default function StockProfileLoading() {
    return (
        <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-8 md:px-6">
            <div className="animate-pulse space-y-4 rounded-2xl border border-border/70 bg-[#0b111a] p-5">
                <div className="h-4 w-36 rounded bg-muted/40" />
                <div className="h-8 w-72 rounded bg-muted/40" />
                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                    <div className="h-16 rounded bg-muted/30" />
                    <div className="h-16 rounded bg-muted/30" />
                </div>
                <div className="h-12 rounded bg-muted/30" />
            </div>

            <div className="animate-pulse rounded-2xl border border-border/70 bg-[#0b111a] p-3">
                <div className="h-9 w-full rounded bg-muted/30" />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
                <div className="h-72 rounded-2xl border border-border/70 bg-[#0b111a]" />
                <div className="h-72 rounded-2xl border border-border/70 bg-[#0b111a]" />
                <div className="h-72 rounded-2xl border border-border/70 bg-[#0b111a]" />
            </div>

            <div className="h-[420px] animate-pulse rounded-2xl border border-border/70 bg-[#0b111a]" />
        </div>
    );
}
