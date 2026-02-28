"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PublishState = {
    status: "idle" | "success" | "error";
    message: string;
};

type BlogFormData = {
    title: string;
    excerpt: string;
    tags: string;
    content: string;
};

const INITIAL_FORM: BlogFormData = {
    title: "",
    excerpt: "",
    tags: "",
    content: "",
};

const parseTags = (value: string): string[] =>
    value
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 8);

const BlogAdminForm = () => {
    const router = useRouter();
    const [form, setForm] = useState<BlogFormData>(INITIAL_FORM);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [publishState, setPublishState] = useState<PublishState>({ status: "idle", message: "" });

    const tagsPreview = useMemo(() => parseTags(form.tags), [form.tags]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        setPublishState({ status: "idle", message: "" });

        try {
            const response = await fetch("/api/blogs", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    title: form.title,
                    excerpt: form.excerpt,
                    content: form.content,
                    tags: parseTags(form.tags),
                }),
            });

            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                const errorMessage = typeof payload?.error === "string" ? payload.error : "Failed to publish blog";
                setPublishState({ status: "error", message: errorMessage });
                return;
            }

            setForm(INITIAL_FORM);
            setPublishState({ status: "success", message: "Blog post published successfully." });
            router.refresh();
        } catch (error) {
            console.error("Failed to publish blog", error);
            setPublishState({ status: "error", message: "Failed to publish blog." });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-[#1c2432] bg-[#0d1117] p-6">
            <div className="space-y-2">
                <label htmlFor="blog-title" className="block text-sm font-medium text-slate-200">
                    Blog title
                </label>
                <input
                    id="blog-title"
                    type="text"
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full rounded-md border border-[#26334a] bg-[#0a0f16] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#58a6ff] focus:outline-none"
                    placeholder="Example: Why volatility clusters before major breakouts"
                    required
                    minLength={5}
                    maxLength={160}
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="blog-excerpt" className="block text-sm font-medium text-slate-200">
                    Excerpt
                </label>
                <textarea
                    id="blog-excerpt"
                    value={form.excerpt}
                    onChange={(event) => setForm((prev) => ({ ...prev, excerpt: event.target.value }))}
                    className="min-h-24 w-full rounded-md border border-[#26334a] bg-[#0a0f16] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#58a6ff] focus:outline-none"
                    placeholder="Write a concise summary shown on the blog listing page."
                    required
                    minLength={20}
                    maxLength={320}
                />
            </div>

            <div className="space-y-2">
                <label htmlFor="blog-tags" className="block text-sm font-medium text-slate-200">
                    Tags (comma separated, up to 8)
                </label>
                <input
                    id="blog-tags"
                    type="text"
                    value={form.tags}
                    onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))}
                    className="w-full rounded-md border border-[#26334a] bg-[#0a0f16] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[#58a6ff] focus:outline-none"
                    placeholder="ai, options, risk-management"
                    maxLength={240}
                />
                {tagsPreview.length > 0 ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {tagsPreview.map((tag) => (
                            <span key={tag} className="rounded-full border border-[#26334a] px-2 py-1 text-xs text-slate-300">
                                {tag}
                            </span>
                        ))}
                    </div>
                ) : null}
            </div>

            <div className="space-y-2">
                <label htmlFor="blog-content" className="block text-sm font-medium text-slate-200">
                    Content
                </label>
                <textarea
                    id="blog-content"
                    value={form.content}
                    onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                    className="min-h-80 w-full rounded-md border border-[#26334a] bg-[#0a0f16] px-3 py-2 text-sm leading-7 text-slate-100 placeholder:text-slate-500 focus:border-[#58a6ff] focus:outline-none"
                    placeholder="Write your full blog content. Use blank lines to separate paragraphs."
                    required
                    minLength={100}
                    maxLength={50000}
                />
            </div>

            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-md bg-[#58a6ff] px-5 py-2 text-sm font-medium text-[#010409] transition hover:bg-[#7cb9ff] disabled:cursor-not-allowed disabled:opacity-70"
                >
                    {isSubmitting ? "Publishing..." : "Publish blog"}
                </button>
                {publishState.status === "success" ? (
                    <p className="text-sm text-emerald-400">{publishState.message}</p>
                ) : null}
                {publishState.status === "error" ? (
                    <p className="text-sm text-red-400">{publishState.message}</p>
                ) : null}
            </div>
        </form>
    );
};

export default BlogAdminForm;
