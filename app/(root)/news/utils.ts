export const formatRelativeTime = (isoDate: string): string => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    if (Number.isNaN(diffMs)) return "Just now";

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
