import type { TerminalNewsItem } from '@/lib/news/terminal-items';

const timeAgo = (iso: string | null) => {
    if (!iso) return 'n/a';
    const parsed = Date.parse(iso);
    if (!Number.isFinite(parsed)) return 'n/a';
    const diff = Math.max(0, Date.now() - parsed);
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

const regionLabel = (region: TerminalNewsItem['region']) => {
    if (region === 'us') return 'United States';
    if (region === 'europe') return 'Europe';
    if (region === 'middle-east') return 'Middle East';
    return 'World';
};

const TerminalNewsWorkspace = ({ items }: { items: TerminalNewsItem[] }) => {
    const featured = items.slice(0, 6);
    const byRegion = {
        world: items.filter((item) => item.region === 'world').slice(0, 5),
        us: items.filter((item) => item.region === 'us').slice(0, 5),
        europe: items.filter((item) => item.region === 'europe').slice(0, 5),
        middleEast: items.filter((item) => item.region === 'middle-east').slice(0, 5),
    };

    return (
        <section className="space-y-3">
            <article className="terminal-widget">
                <header className="terminal-widget-head">
                    <p className="text-sm font-semibold">Market News</p>
                </header>
                <div className="terminal-table">
                    {featured.map((item) => (
                        <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="terminal-news-row">
                            <p className="line-clamp-1 text-sm font-semibold">{item.title}</p>
                            <p className="text-xs terminal-muted">{item.source} - {regionLabel(item.region)} - {timeAgo(item.publishedAt)}</p>
                        </a>
                    ))}
                </div>
            </article>

            <div className="terminal-bento-grid">
                {([
                    ['world', byRegion.world, 'World'],
                    ['us', byRegion.us, 'United States'],
                    ['europe', byRegion.europe, 'Europe'],
                    ['middle-east', byRegion.middleEast, 'Middle East'],
                ] as const).map(([id, regionItems, title]) => (
                    <article
                        key={id}
                        className="terminal-widget"
                        style={{ gridColumn: 'span 3 / span 3', gridRow: 'span 2 / span 2' }}
                    >
                        <header className="terminal-widget-head">
                            <p className="text-sm font-semibold">{title}</p>
                        </header>
                        <div className="terminal-table">
                            {regionItems.map((item) => (
                                <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="terminal-news-row">
                                    <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                                    <p className="text-xs terminal-muted">{item.source} - {timeAgo(item.publishedAt)}</p>
                                </a>
                            ))}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
};

export default TerminalNewsWorkspace;
