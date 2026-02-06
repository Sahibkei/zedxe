type ComingSoonPanelProps = {
    title: string;
    description: string;
};

export default function ComingSoonPanel({ title, description }: ComingSoonPanelProps) {
    return (
        <div className="rounded-2xl border border-border/70 bg-[#0c141f] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Coming soon</p>
            <h3 className="mt-2 text-xl font-semibold text-foreground">{title}</h3>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
    );
}
