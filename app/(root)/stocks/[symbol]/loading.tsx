const StockProfileLoading = () => {
    return (
        <div className="min-h-screen bg-[#010409] text-slate-100">
            <div className="mx-auto w-full max-w-[1800px] px-6 pb-12 pt-24">
                <div className="space-y-6">
                    <div className="h-24 rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 animate-pulse" />
                    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="space-y-6">
                            <div className="h-[520px] rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 animate-pulse" />
                            <div className="h-72 rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 animate-pulse" />
                        </div>
                        <div className="space-y-6">
                            <div className="h-56 rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 animate-pulse" />
                            <div className="h-56 rounded-2xl border border-[#1c2432] bg-[#0d1117]/70 animate-pulse" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StockProfileLoading;
