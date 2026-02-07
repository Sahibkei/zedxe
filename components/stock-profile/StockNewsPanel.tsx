import Link from "next/link";

type StockNewsPanelProps = {
    newsItems: MarketNewsArticle[];
};

const relativeTime = (unixSeconds?: number) => {
    if (unixSeconds == null) return "Just now";
    const diff = Math.max(0, Date.now() - unixSeconds * 1000);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

export default function StockNewsPanel({ newsItems }: StockNewsPanelProps) {
    if (!newsItems.length) {
        return (
            <div className="rounded-2xl border border-border/70 bg-[#0c141f] p-6 text-sm text-muted-foreground">
                News feed unavailable right now. Please check back shortly.
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-border/70 bg-[#0c141f] p-6">
            <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">Recent Headlines</h3>
                <Link href="/news" className="text-xs uppercase tracking-wide text-primary hover:underline">
                    Open News Center
                </Link>
            </div>
            <div className="space-y-3">
                {newsItems.map((item) => (
                    <a
                        key={`${item.url}-${item.id}`}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block rounded-xl border border-border/60 bg-muted/10 p-3 transition hover:bg-muted/20"
                    >
                        <p className="text-sm font-medium text-foreground">{item.headline}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {item.source || "Market"} | {relativeTime(item.datetime)}
                        </p>
                    </a>
                ))}
            </div>
        </div>
    );
}
