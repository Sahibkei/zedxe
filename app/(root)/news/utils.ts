export const formatRelativeTime = (isoDate?: string | null): string => {
    if (!isoDate) return "Unknown date";

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Unknown date";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
};

export const deriveTagLabel = (industry?: string | null, type?: string | null, country?: string | null): string => {
    if (industry) return industry.toUpperCase();
    if (type) return type.toUpperCase();
    if (country) return country.toUpperCase();
    return "MARKETS";
};
