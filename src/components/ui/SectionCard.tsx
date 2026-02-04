import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export default function SectionCard({
    title,
    eyebrow,
    action,
    children,
    className,
    contentClassName,
}: {
    title?: string;
    eyebrow?: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
    contentClassName?: string;
}) {
    return (
        <section className={cn("rounded-2xl border border-white/10 bg-slate-900/60 p-6 shadow-lg backdrop-blur", className)}>
            {(title || eyebrow || action) && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        {eyebrow ? (
                            <p className="text-xs uppercase tracking-wide text-slate-400">{eyebrow}</p>
                        ) : null}
                        {title ? <h2 className="text-lg font-semibold text-slate-100">{title}</h2> : null}
                    </div>
                    {action ? <div>{action}</div> : null}
                </div>
            )}
            <div className={cn("text-sm text-slate-200", contentClassName)}>{children}</div>
        </section>
    );
}
