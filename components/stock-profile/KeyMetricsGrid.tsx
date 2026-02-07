import { DASH_VALUE } from "@/components/stock-profile/formatters";
import { cn } from "@/lib/utils";

type MetricItem = {
    label: string;
    value: string;
};

type MetricSection = {
    title: string;
    rows: MetricItem[];
};

type KeyMetricsGridProps = {
    sections: MetricSection[];
};

const toColumns = (sections: MetricSection[], count: number) => {
    const columns: MetricSection[][] = Array.from({ length: count }, () => []);
    sections.forEach((section, index) => {
        columns[index % count].push(section);
    });
    return columns;
};

export default function KeyMetricsGrid({ sections }: KeyMetricsGridProps) {
    const filteredSections = sections
        .map((section) => ({
            ...section,
            rows: section.rows.filter((row) => row.value && row.value !== DASH_VALUE),
        }))
        .filter((section) => section.rows.length > 0);

    if (filteredSections.length === 0) {
        return (
            <section className="rounded-xl border border-border/80 bg-card p-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Company Statistics</h3>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Available fundamentals only</p>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Fundamental metrics are unavailable for this symbol.</p>
            </section>
        );
    }

    const columnCount = filteredSections.length >= 3 ? 3 : filteredSections.length;
    const columns = toColumns(filteredSections, columnCount);
    const gridColumnsClass =
        columnCount === 1 ? "lg:grid-cols-1" : columnCount === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

    return (
        <section className="rounded-xl border border-border/80 bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-foreground">Company Statistics</h3>
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Available fundamentals only</p>
            </div>

            <div className={cn("mt-4 grid gap-4 lg:gap-5", gridColumnsClass)}>
                {columns.map((column, columnIndex) => (
                    <div
                        key={`metrics-column-${columnIndex}`}
                        className="space-y-4 lg:border-r lg:border-border/70 lg:pr-4 last:border-r-0 last:pr-0"
                    >
                        {column.map((section) => (
                            <div key={section.title} className="space-y-2">
                                <h4 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    {section.title}
                                </h4>
                                <div className="rounded-lg border border-border/60 bg-muted/15 px-2.5">
                                    {section.rows.map((row) => (
                                        <div
                                            key={`${section.title}-${row.label}`}
                                            className="flex items-center justify-between gap-2 py-2 text-sm tabular-nums border-b border-border/40 last:border-b-0"
                                        >
                                            <span className="text-muted-foreground">{row.label}</span>
                                            <span className="font-semibold text-foreground">{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}
