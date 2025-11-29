const Loading = () => {
    return (
        <section className="max-w-6xl mx-auto px-4 py-8 space-y-8 animate-pulse">
            <div className="space-y-3">
                <div className="h-4 w-24 rounded bg-gray-800" />
                <div className="h-8 w-64 rounded bg-gray-800" />
                <div className="h-4 w-80 rounded bg-gray-800" />
            </div>

            <div className="grid gap-6 rounded-2xl border border-gray-800 bg-[#0f1115] p-6 md:grid-cols-5">
                <div className="md:col-span-2 h-64 rounded-xl bg-gray-800" />
                <div className="md:col-span-3 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="h-3 w-32 rounded bg-gray-800" />
                        <div className="h-3 w-20 rounded bg-gray-800" />
                    </div>
                    <div className="h-6 w-full rounded bg-gray-800" />
                    <div className="h-6 w-5/6 rounded bg-gray-800" />
                    <div className="h-4 w-1/2 rounded bg-gray-800" />
                </div>
            </div>

            <div className="space-y-4">
                <div className="h-5 w-40 rounded bg-gray-800" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <div key={index} className="space-y-3 rounded-xl border border-gray-800 bg-[#0f1115] p-5">
                            <div className="h-3 w-24 rounded bg-gray-800" />
                            <div className="h-5 w-full rounded bg-gray-800" />
                            <div className="h-5 w-5/6 rounded bg-gray-800" />
                            <div className="h-4 w-1/2 rounded bg-gray-800" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Loading;
