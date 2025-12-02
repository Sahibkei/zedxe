import Link from "next/link";
import { deriveTagLabel, formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";
import type { MouseEvent } from "react";

const NewsCard = ({ article, currentPage }: { article: MarketauxArticle; currentPage: number }) => {
    const primaryEntity = article.entities?.[0];
    const tagLabel = deriveTagLabel(primaryEntity?.industry, primaryEntity?.type, primaryEntity?.country);
    const excerpt = article.snippet || article.description || "";
    const title = article.title || "Untitled article";
    const source = article.source || "Unknown source";
    const internalHref = article.uuid ? `/news/article/${article.uuid}?page=${currentPage}` : null;
    const externalHref = article.url ?? null;

    const handleExternalClick = (event: MouseEvent<HTMLAnchorElement>) => {
        event.stopPropagation();
    };

    const content = (
        <article className="group flex h-full flex-col rounded-xl border border-gray-800 bg-[#0f1115] p-5 transition transform hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-900/30">
            <span className="inline-flex w-fit rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                {tagLabel}
            </span>

            <h3 className="mt-3 text-lg font-semibold text-white leading-tight line-clamp-3 group-hover:text-emerald-200">
                {title}
            </h3>

            {excerpt && <p className="mt-2 text-sm text-gray-400 line-clamp-3">{excerpt}</p>}

            <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-gray-500">
                <span className="text-gray-300">{source}</span>
                <span className="text-gray-600">•</span>
                <span>{formatRelativeTime(article.published_at)}</span>
                {externalHref ? (
                    <a
                        href={externalHref}
                        target="_blank"
                        rel="noreferrer noopener"
                        onClick={handleExternalClick}
                        className="ml-auto text-emerald-400 hover:text-emerald-300"
                    >
                        Source
                    </a>
                ) : null}
            </div>
        </article>
    );

    if (internalHref) {
        return (
            <Link href={internalHref} className="flex h-full">
                {content}
            </Link>
        );
    }

    if (externalHref) {
        return (
            <a href={externalHref} target="_blank" rel="noreferrer noopener" className="flex h-full">
                {content}
            </a>
        );
    }

    return content;
};

export default NewsCard;
