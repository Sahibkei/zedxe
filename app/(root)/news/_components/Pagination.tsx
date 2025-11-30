import Link from "next/link";

type PageItem = number | "ellipsis";

const buildPagination = (currentPage: number, totalPages: number): PageItem[] => {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    const pages: PageItem[] = [1];
    const startPage = Math.max(2, currentPage - 1);
    const endPage = Math.min(totalPages - 1, currentPage + 1);

    if (startPage > 2) {
        pages.push("ellipsis");
    }

    for (let page = startPage; page <= endPage; page += 1) {
        pages.push(page);
    }

    if (endPage < totalPages - 1) {
        pages.push("ellipsis");
    }

    pages.push(totalPages);

    return pages;
};

const Pagination = ({ currentPage, totalPages }: { currentPage: number; totalPages: number }) => {
    if (totalPages <= 1) return null;

    const pages = buildPagination(currentPage, totalPages);

    return (
        <div className="flex items-center justify-center gap-2 pt-6">
            {pages.map((page, index) => {
                if (page === "ellipsis") {
                    return (
                        <span
                            key={`ellipsis-${index}`}
                            className="px-3 py-1 text-sm font-semibold text-gray-500"
                        >
                            …
                        </span>
                    );
                }

                const isActive = page === currentPage;

                return (
                    <Link
                        key={page}
                        href={`/news?page=${page}`}
                        className={`min-w-10 rounded-full px-3 py-1 text-sm font-semibold transition border ${
                            isActive
                                ? "bg-emerald-500 text-emerald-950 border-emerald-400"
                                : "border-gray-700 text-gray-300 hover:border-emerald-400 hover:text-emerald-200"
                        }`}
                    >
                        {page}
                    </Link>
                );
            })}
        </div>
    );
};

export default Pagination;
