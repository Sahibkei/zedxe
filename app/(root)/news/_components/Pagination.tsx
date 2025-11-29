import Link from "next/link";

const Pagination = ({ currentPage, totalPages }: { currentPage: number; totalPages: number }) => {
    if (totalPages <= 1) return null;

    const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1);

    return (
        <div className="flex items-center justify-center gap-2 pt-6">
            {pages.map((page) => {
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
