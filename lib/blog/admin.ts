const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const parseAdminEmails = (rawValue: string | undefined): Set<string> => {
    if (!rawValue) return new Set();

    return new Set(
        rawValue
            .split(",")
            .map((email) => normalizeEmail(email))
            .filter(Boolean),
    );
};

export const getBlogAdminEmails = (): Set<string> => parseAdminEmails(process.env.BLOG_ADMIN_EMAILS);

export const isBlogAdminConfigured = (): boolean => getBlogAdminEmails().size > 0;

export const isBlogAdmin = (email?: string | null): boolean => {
    if (!email) return false;
    return getBlogAdminEmails().has(normalizeEmail(email));
};
