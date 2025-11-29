/* eslint-disable @next/next/no-img-element */
import { formatRelativeTime } from "@/app/(root)/news/utils";
import type { MarketauxArticle } from "@/types/marketaux";

const FeaturedArticle = ({ article }: { article: MarketauxArticle }) => {
    const mainEntity = article.entities?.[0];
    const entityLabel = mainEntity?.name || mainEntity?.symbol || "Markets";
    const description = article.description || article.snippet || "";

    return (
        <article className="grid gap-6 rounded-2xl border border-gray-800 bg-[#0f1115] p-6 shadow-lg shadow-black/20 md:grid-cols-5">
            <div className="md:col-span-2">
                {article.image_url ? (
                    <img
                        src={article.image_url}
                        alt={article.title}
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

                <h2 className="text-2xl font-semibold text-white leading-tight line-clamp-3">{article.title}</h2>

                {description && (
                    <p className="text-sm text-gray-400 line-clamp-3">{description}</p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-3 text-sm text-gray-500">
                    <span className="text-gray-300">{article.source}</span>
                    <span className="text-gray-600">•</span>
                    <span>{formatRelativeTime(article.published_at)}</span>
                    <a
                        href={article.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-auto text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                    >
                        Read More →
                    </a>
                </div>
            </div>
        </article>
    );
};

export default FeaturedArticle;
