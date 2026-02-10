import type { JSX } from "react";

export type BlogPost = {
    slug: string;
    title: string;
    dateISO: string;
    excerpt: string;
    tags: string[];
    pdfPath: string;
    coverLabel?: string;
    content: () => JSX.Element;
};

export const BLOG_POSTS: BlogPost[] = [
    {
        slug: "apple-fiscal-q1-2026",
        title: "Apple Fiscal Q1 2026 Earnings Summary",
        dateISO: "2026-01-30",
        excerpt:
            "Apple posted record fiscal Q1 2026 revenue and earnings, led by iPhone momentum, resilient Services growth, and improving regional performance.",
        tags: ["Earnings", "Apple", "Equities"],
        pdfPath: "/reports/apple-fiscal-q1-2026-earnings-summary-zedxe.pdf",
        coverLabel: "Q1 2026",
        content: () => (
            <div className="space-y-10 text-gray-200">
                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">1) Overview</h2>
                    <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-gray-300 md:text-base">
                        <li>Apple reported record-breaking results for fiscal Q1 2026 (quarter ended Dec 27, 2025).</li>
                        <li>Revenue: $143.8B (+16% YoY)</li>
                        <li>Diluted EPS: $2.84 (+19% YoY)</li>
                        <li>Services revenue hit an all-time record</li>
                        <li>Active device installed base surpassed 2.5B</li>
                        <li>Products vs Services: Products $113.74B; Services $30.01B</li>
                        <li>Total cost of sales: $74.53B; Gross margin: $69.23B</li>
                        <li>Operating expenses (R&amp;D + SG&amp;A): $18.38B; Operating income: $50.85B</li>
                        <li>Net income: $42.10B (vs $36.33B year-ago)</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">2) Revenue by Geography and Product (table)</h2>
                    <div className="overflow-x-auto rounded-2xl border border-white/10">
                        <table className="min-w-full divide-y divide-white/10 text-left text-sm text-gray-300">
                            <thead className="bg-white/5 text-xs uppercase tracking-[0.12em] text-gray-300">
                                <tr>
                                    <th className="px-4 py-3">Segment / Region</th>
                                    <th className="px-4 py-3">Q1 2026 revenue (USD billion)</th>
                                    <th className="px-4 py-3">Year-ago comparison</th>
                                    <th className="px-4 py-3">Notes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                                <tr className="bg-white/[0.02]"><td className="px-4 py-3 font-medium text-white">Americas</td><td className="px-4 py-3">58.53</td><td className="px-4 py-3">up from 52.65</td><td className="px-4 py-3">Largest region; strong iPhone upgrades</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-white">Europe</td><td className="px-4 py-3">38.15</td><td className="px-4 py-3">up from 33.86</td><td className="px-4 py-3">Growth in iPhone and Services</td></tr>
                                <tr className="bg-white/[0.02]"><td className="px-4 py-3 font-medium text-white">Greater China</td><td className="px-4 py-3">25.53</td><td className="px-4 py-3">up from 18.51</td><td className="px-4 py-3">Rebound amid easing macro headwinds</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-white">Japan</td><td className="px-4 py-3">9.41</td><td className="px-4 py-3">slightly up from 8.99</td><td className="px-4 py-3">Continued demand for high-end iPhones</td></tr>
                                <tr className="bg-white/[0.02]"><td className="px-4 py-3 font-medium text-white">Rest of Asia Pacific</td><td className="px-4 py-3">12.14</td><td className="px-4 py-3">up from 10.29</td><td className="px-4 py-3">Growth across emerging markets</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-white">iPhone</td><td className="px-4 py-3">85.27</td><td className="px-4 py-3">up from 69.14</td><td className="px-4 py-3">Best-ever quarter; strong demand for iPhone 17 lineup</td></tr>
                                <tr className="bg-white/[0.02]"><td className="px-4 py-3 font-medium text-white">Mac</td><td className="px-4 py-3">8.39</td><td className="px-4 py-3">down from 8.99</td><td className="px-4 py-3">Supply-chain normalization; tough comparison</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-white">iPad</td><td className="px-4 py-3">8.60</td><td className="px-4 py-3">up slightly from 8.09</td><td className="px-4 py-3">New iPad Air and Pro drove demand</td></tr>
                                <tr className="bg-white/[0.02]"><td className="px-4 py-3 font-medium text-white">Wearables/Home/Accessories</td><td className="px-4 py-3">11.49</td><td className="px-4 py-3">nearly flat</td><td className="px-4 py-3">Apple Watch and Vision Pro sales offset slight wearables softness</td></tr>
                                <tr><td className="px-4 py-3 font-medium text-white">Services</td><td className="px-4 py-3">30.01</td><td className="px-4 py-3">up from 26.34</td><td className="px-4 py-3">Record revenue in App Store, Apple Music, Apple Pay &amp; iCloud</td></tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">3) Financial Analysis and Commentary</h2>
                    <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-gray-300 md:text-base">
                        <li>16% growth is Apple’s fastest in several quarters</li>
                        <li>iPhone sales surged 23% to $85.27B (iPhone 17 lineup + upgrades)</li>
                        <li>Services climbed 14% to $30.01B; structurally higher margins</li>
                        <li>Gross margin ~48% (69.23 / 143.76)</li>
                        <li>Operating margin &gt;35%</li>
                        <li>Cash flow from operations nearly $54B</li>
                        <li>Returned almost $32B to shareholders (dividends + repurchases)</li>
                        <li>Greater China revenue up 38%; Europe and Americas double-digit growth</li>
                        <li>Wearables roughly flat (Vision Pro/Watch strength; accessories slower)</li>
                        <li>Balance sheet: current assets $158.10B; non-current assets $221.19B; total liabilities $291.11B</li>
                        <li>Dividend: $0.26 per share payable Feb 12, 2026</li>
                    </ul>
                </section>

                <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-white">4) Outlook</h2>
                    <ul className="list-disc space-y-2 pl-6 text-sm leading-7 text-gray-300 md:text-base">
                        <li>No formal Q2 2026 revenue guidance</li>
                        <li>Continued focus: AI + spatial computing (Vision Pro, Apple Intelligence)</li>
                        <li>Watch: macro conditions, FX volatility, regulatory risks</li>
                    </ul>
                </section>

                <p className="border-t border-white/10 pt-6 text-sm tracking-wide text-gray-400">Powered by ZedXe</p>
            </div>
        ),
    },
];

export const getPost = (slug: string): BlogPost | undefined => BLOG_POSTS.find((post) => post.slug === slug);
