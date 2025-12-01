import Link from "next/link";

import { deriveTagLabel, formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";

const NewsCard = ({ article, originPage }: { article: MarketauxArticle; originPage: number }) => {
    const primaryEntity = article.entities?.[0];
    const tagLabel = deriveTagLabel(primaryEntity?.industry, primaryEntity?.type, primaryEntity?.country);
    const excerpt = article.snippet || article.description || "";
    const title = article.title ?? "Untitled article";
    const articleUrl = article.url ?? "#";
    const source = article.source ?? "Unknown source";
    const internalHref = article.uuid ? `/news/article/${article.uuid}?page=${originPage}` : null;

    const sourceLink = article.url ? (
        <a
            href={articleUrl}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(event) => event.stopPropagation()}
            className="text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300"
        >
            Source ↗
        </a>
    ) : null;

    const content = (
        <div className="flex h-full flex-col rounded-xl border border-gray-800 bg-[#0f1115] p-5 transition transform hover:-translate-y-1 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-900/30">
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
                <span className="ml-auto text-emerald-400 transition-colors group-hover:text-emerald-300">Read More →</span>
            </div>
        </div>
    );

    if (internalHref) {
        return (
            <article className="h-full space-y-2">
                <Link
                    href={internalHref}
                    className="group block focus:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                >
                    {content}
                </Link>
                {sourceLink}
            </article>
        );
    }

    return (
        <article className="h-full space-y-2">
            <a
                href={articleUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="group block focus:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
            >
                {content}
            </a>
            {sourceLink}
        </article>
    );
};

export default NewsCard;
