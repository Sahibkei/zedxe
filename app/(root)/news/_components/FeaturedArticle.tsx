/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";

const FeaturedArticle = ({ article, originPage }: { article: MarketauxArticle; originPage: number }) => {
    const mainEntity = article.entities?.[0];
    const entityLabel = mainEntity?.name || mainEntity?.symbol || "Markets";
    const title = article.title ?? "Untitled article";
    const description = article.description || article.snippet || "";
    const source = article.source ?? "Unknown source";
    const articleUrl = article.url ?? "#";
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
        <article className="grid gap-6 rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20 md:grid-cols-5">
            <div className="md:col-span-2">
                {article.image_url ? (
                    <img
                        src={article.image_url}
                        alt={title}
                        className="h-full w-full rounded-xl object-cover"
                        loading="lazy"
                    />
                ) : (
                    <div className="flex h-full min-h-64 items-center justify-center rounded-xl border border-dashed border-gray-700 bg-gray-900 text-sm uppercase tracking-wide text-gray-500">
                        Featured Image Placeholder
                    </div>
                )}
            </div>

            <div className="md:col-span-3 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                    <span className="font-semibold text-emerald-400">Featured Analysis</span>
                    <span className="text-gray-400">{entityLabel?.toUpperCase()}</span>
                </div>

                <h2 className="text-2xl font-semibold text-white leading-tight line-clamp-3">{title}</h2>

                {description && <p className="text-sm text-gray-400 line-clamp-3">{description}</p>}

                <div className="mt-auto flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="text-gray-300">{source}</span>
                    <span className="text-gray-600">•</span>
                    <span>{formatRelativeTime(article.published_at)}</span>
                    <span className="ml-auto text-emerald-400 transition-colors group-hover:text-emerald-300">
                        Read More →
                    </span>
                </div>
            </div>
        </article>
    );

    if (internalHref) {
        return (
            <div className="group space-y-2">
                <Link
                    href={internalHref}
                    className="group block focus:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
                >
                    {content}
                </Link>
                {sourceLink}
            </div>
        );
    }

    return (
        <div className="group space-y-2">
            <a
                href={articleUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="group block focus:outline-none focus-visible:ring focus-visible:ring-emerald-500/60"
            >
                {content}
            </a>
            {sourceLink}
        </div>
    );
};

export default FeaturedArticle;
