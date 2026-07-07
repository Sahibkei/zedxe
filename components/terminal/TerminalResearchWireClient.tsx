'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react';
import {
    Bell,
    Bookmark,
    CreditCard,
    Crown,
    Home,
    Lock,
    MessageCircle,
    PenLine,
    Plus,
    Search,
    Send,
    ShieldCheck,
    UserCircle,
    UserPlus,
    Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

type WireTab = 'home' | 'subscriptions' | 'chat' | 'activity' | 'explore' | 'profile';

type WirePost = {
    id: string;
    title: string;
    author: string;
    authorRole: string;
    access: 'Free' | 'Members';
    published: string;
    summary: string;
    body: string;
    tickers: string[];
    comments: number;
    saves: number;
};

type WireCreator = {
    id: string;
    name: string;
    role: string;
    subscribers: string;
    latestReport: string;
};

type WireNotification = {
    id: string;
    kind: 'post' | 'subscribe' | 'follow';
    title: string;
    detail: string;
    actor: string;
    timestamp: string;
    createdAt: string;
    unread: boolean;
};

type WireChatMember = {
    id: string;
    name: string;
    role: 'admin' | 'member';
};

type WireChatMessage = {
    id: string;
    senderId: string;
    senderName: string;
    body: string;
    createdAt: string;
};

type WireChatConversation = {
    id: string;
    type: 'direct' | 'group';
    name: string;
    status: 'pending' | 'active';
    members: WireChatMember[];
    messages: WireChatMessage[];
};

type ResearchWireUser = {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
    bio?: string | null;
    usernameUpdatedAt?: string | null;
};

type ResearchWireSearchUser = {
    id: string;
    name: string;
    username: string | null;
    image: string | null;
    bio?: string | null;
};

type FollowState = {
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
};

type SubscribeState = {
    subscriberCount: number;
    isSubscribed: boolean;
};

type FollowListType = 'followers' | 'following';

const USERNAME_CHANGE_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;

const NAV_ITEMS: Array<{ key: WireTab; label: string; icon: typeof Home }> = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard },
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'activity', label: 'Activity', icon: Bell },
    { key: 'explore', label: 'Explore', icon: Search },
    { key: 'profile', label: 'Profile', icon: UserCircle },
];

const FOLLOWING_CREATORS: WireCreator[] = [];

const POSTS: WirePost[] = [];

const NOTIFICATIONS: WireNotification[] = [];
const NOTIFICATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const getActiveNotifications = (notifications: WireNotification[]) => {
    const cutoff = Date.now() - NOTIFICATION_RETENTION_MS;
    return notifications.filter((notification) => {
        const createdAt = new Date(notification.createdAt).getTime();
        return Number.isFinite(createdAt) && createdAt >= cutoff;
    });
};

const extractTickers = (value: string) => {
    const matches = value.toUpperCase().match(/\b[A-Z]{2,5}\b/g) ?? [];
    const blocked = new Set(['WHAT', 'THIS', 'THAT', 'WITH', 'FROM', 'YOUR', 'POST', 'TITLE', 'WRITE', 'RISK']);
    const tickers = [...new Set(matches.filter((match) => !blocked.has(match)))].slice(0, 4);
    return tickers.length ? tickers : ['SPY'];
};

const TerminalResearchWireClient = ({ user }: { user: ResearchWireUser }) => {
    const [activeTab, setActiveTab] = useState<WireTab>('home');
    const [query, setQuery] = useState('');
    const [draftTitle, setDraftTitle] = useState('');
    const [draftBody, setDraftBody] = useState('');
    const [localPosts, setLocalPosts] = useState<WirePost[]>([]);
    const [viewedProfileUser, setViewedProfileUser] = useState<ResearchWireSearchUser | null>(null);
    const [composerOpen, setComposerOpen] = useState(false);

    const posts = useMemo(() => [...localPosts, ...POSTS], [localPosts]);

    const filteredPosts = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return posts.filter((post) => {
            const matchesTab =
                activeTab === 'home' ||
                activeTab === 'explore' ||
                (activeTab === 'subscriptions' && post.access === 'Members') ||
                (activeTab === 'profile' && post.author === 'You');
            if (!matchesTab) return false;
            if (!normalizedQuery) return true;
            return [post.title, post.author, post.summary, post.body, ...post.tickers]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery);
        });
    }, [activeTab, posts, query]);

    const filteredNotifications = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        const activeNotifications = getActiveNotifications(NOTIFICATIONS);
        if (!normalizedQuery) return activeNotifications;
        return activeNotifications.filter((notification) =>
            [notification.title, notification.detail, notification.actor]
                .join(' ')
                .toLowerCase()
                .includes(normalizedQuery),
        );
    }, [query]);

    const handleCreate = () => {
        setComposerOpen(true);
    };

    const handlePublishPreview = () => {
        const title = draftTitle.trim();
        const body = draftBody.trim();
        if (!title || !body) return;

        setLocalPosts((current) => [
            {
                id: `local-${Date.now()}`,
                title,
                author: user.name || user.email || 'You',
                authorRole: 'ZedXe creator preview',
                access: 'Free',
                published: 'Just now',
                summary: body,
                body,
                tickers: extractTickers(`${title} ${body}`),
                comments: 0,
                saves: 0,
            },
            ...current,
        ]);
        setDraftTitle('');
        setDraftBody('');
        setActiveTab('home');
        setComposerOpen(false);
    };

    return (
        <section
            className="-m-[0.85rem] bg-[var(--terminal-bg)] text-[var(--terminal-text)]"
            style={{
                minHeight: 'calc(100vh - var(--terminal-topbar-height))',
            } as CSSProperties}
        >
            <div className="mx-auto grid max-w-6xl gap-12 px-5 py-8 lg:grid-cols-[minmax(0,760px)_320px] xl:gap-16">
                <main className="min-w-0">
                    <div className="mb-6 flex items-center justify-between gap-4 lg:hidden">
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--terminal-accent)]">Research Wire</p>
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--terminal-accent)] px-4 text-sm font-bold text-white transition hover:brightness-110"
                        >
                            <Plus className="h-4 w-4" />
                            Create
                        </button>
                    </div>

                    <div className="mb-8 flex justify-center overflow-x-auto px-1">
                        <nav className="terminal-analytics-nav min-w-max" aria-label="Research Wire sections">
                            {NAV_ITEMS.map((item) => {
                                const Icon = item.icon;
                                const active = item.key === activeTab;
                                return (
                                    <button
                                        key={item.key}
                                        type="button"
                                        onClick={() => {
                                            setViewedProfileUser(null);
                                            setActiveTab(item.key);
                                        }}
                                        className={cn('terminal-analytics-nav-item', active && 'terminal-analytics-nav-item-active')}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {viewedProfileUser ? (
                        <ResearchWireUserProfileView
                            currentUserId={user.id}
                            user={viewedProfileUser}
                            posts={posts}
                            onBack={() => setViewedProfileUser(null)}
                            onOpenProfile={setViewedProfileUser}
                        />
                    ) : activeTab === 'subscriptions' ? (
                        <SubscriptionsView creators={FOLLOWING_CREATORS} />
                    ) : activeTab === 'profile' ? (
                        <ProfileView user={user} posts={localPosts} onOpenProfile={setViewedProfileUser} />
                    ) : activeTab === 'explore' ? (
                        <ExploreView currentUserId={user.id} onOpenProfile={setViewedProfileUser} />
                    ) : activeTab === 'chat' ? (
                        <ChatView user={user} />
                    ) : activeTab === 'activity' ? (
                        <ActivityView notifications={filteredNotifications} />
                    ) : (
                        <div className="divide-y divide-[var(--terminal-border)] border-t border-[var(--terminal-border)]">
                            {filteredPosts.map((post) => (
                                <PostItem key={post.id} post={post} />
                            ))}
                            {!filteredPosts.length ? (
                                <div className="py-16 text-center text-sm text-[var(--terminal-muted)]">No posts match this section yet.</div>
                            ) : null}
                        </div>
                    )}
                </main>

                <aside className="hidden xl:block">
                    <div className="sticky top-6 space-y-5">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--terminal-muted)]" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search Research Wire"
                                className="h-12 w-full rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] pl-12 pr-4 text-sm text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)] focus:border-[var(--terminal-accent)]"
                            />
                        </div>
                        <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-5 text-center">
                            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)]">
                                <Image src="/brand/zedxe-mark.svg" alt="ZedXe" width={32} height={28} className="h-7 w-auto" priority />
                            </div>
                            <p className="text-xl font-black text-[var(--terminal-text)]">Start publishing on ZedXe</p>
                            <p className="mt-3 text-sm leading-6 text-[var(--terminal-muted)]">Share research, articles, and reports with investors following your market work.</p>
                            <button
                                type="button"
                                onClick={handleCreate}
                                className="mt-5 h-11 w-full rounded-xl bg-[var(--terminal-accent)] text-sm font-bold text-white transition hover:brightness-110"
                            >
                                Create a post
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
            {composerOpen ? (
                <PostComposerDialog
                    title={draftTitle}
                    body={draftBody}
                    onTitleChange={setDraftTitle}
                    onBodyChange={setDraftBody}
                    onClose={() => setComposerOpen(false)}
                    onPublish={handlePublishPreview}
                />
            ) : null}
        </section>
    );
};

const PostComposerDialog = ({
    title,
    body,
    onTitleChange,
    onBodyChange,
    onClose,
    onPublish,
}: {
    title: string;
    body: string;
    onTitleChange: (value: string) => void;
    onBodyChange: (value: string) => void;
    onClose: () => void;
    onPublish: () => void;
}) => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6">
        <section className="w-full max-w-2xl overflow-hidden rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-5 py-4">
                <div className="flex items-center gap-2 text-sm font-bold text-[var(--terminal-text)]">
                    <PenLine className="h-4 w-4 text-[var(--terminal-accent)]" />
                    Create a post
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="grid h-9 w-9 place-items-center rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] text-lg font-bold text-[var(--terminal-muted)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-text)]"
                    aria-label="Close composer"
                >
                    x
                </button>
            </div>
            <div className="p-5">
                <input
                    value={title}
                    onChange={(event) => onTitleChange(event.target.value)}
                    placeholder="Post title"
                    className="h-12 w-full border-0 bg-transparent text-2xl font-semibold text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)]"
                />
                <textarea
                    value={body}
                    onChange={(event) => onBodyChange(event.target.value)}
                    placeholder="Share a market note, article, or report..."
                    className="mt-3 min-h-44 w-full resize-y border-0 bg-transparent text-sm leading-6 text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)]"
                />
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-[var(--terminal-muted)]">Preview only. Backend publishing can be added after UI approval.</span>
                    <button
                        type="button"
                        onClick={onPublish}
                        disabled={!title.trim() || !body.trim()}
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--terminal-accent)] px-5 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        <Send className="h-4 w-4" />
                        Publish preview
                    </button>
                </div>
            </div>
        </section>
    </div>
);

const PostItem = ({ post }: { post: WirePost }) => (
    <article className="px-1 py-7">
        <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--terminal-panel-soft)] text-sm font-black text-[var(--terminal-text)]">
                {post.author.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-bold text-[var(--terminal-text)]">{post.author}</span>
                    <span className="text-[var(--terminal-muted)]">{post.published}</span>
                    <span className="research-wire-access-badge rounded-full px-2 py-0.5 text-xs font-bold">
                        {post.access}
                    </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--terminal-muted)]">{post.authorRole}</p>
                <h2 className="mt-3 text-2xl font-bold leading-tight text-[var(--terminal-text)]">{post.title}</h2>
                <p className="mt-3 text-base leading-7 text-[var(--terminal-text)]">{post.summary}</p>
                <p className="mt-3 text-sm leading-6 text-[var(--terminal-muted)]">{post.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {post.tickers.map((ticker) => (
                        <span key={ticker} className="rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-2.5 py-1 text-xs font-black text-[var(--terminal-text)]">
                            {ticker}
                        </span>
                    ))}
                </div>
                <div className="mt-5 flex items-center gap-5 text-sm text-[var(--terminal-muted)]">
                    <span>{post.comments} comments</span>
                    <span className="inline-flex items-center gap-1">
                        <Bookmark className="h-4 w-4" />
                        {post.saves}
                    </span>
                    <button type="button" className="font-bold text-[var(--terminal-accent)] hover:brightness-110">
                        Read more
                    </button>
                </div>
            </div>
        </div>
    </article>
);

const ActivityView = ({ notifications }: { notifications: WireNotification[] }) => (
    <section className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--terminal-border)] px-5 py-4">
            <div>
                <h2 className="text-xl font-black text-[var(--terminal-text)]">Notifications</h2>
                <p className="mt-1 text-sm text-[var(--terminal-muted)]">
                    New article, report, follow, and subscription alerts appear here.
                </p>
            </div>
            <span className="rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 py-1 text-xs font-black text-[var(--terminal-muted)]">
                {notifications.filter((notification) => notification.unread).length} unread
            </span>
        </div>
        {notifications.length ? (
            <div className="divide-y divide-[var(--terminal-border)]">
                {notifications.map((notification) => (
                    <article
                        key={notification.id}
                        className="flex gap-4 px-5 py-5 transition hover:bg-[color-mix(in_srgb,var(--terminal-accent)_6%,transparent)]"
                    >
                        <div
                            className={cn(
                                'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--terminal-border)]',
                                notification.unread
                                    ? 'bg-[var(--terminal-accent)] text-white'
                                    : 'bg-[var(--terminal-panel-soft)] text-[var(--terminal-muted)]',
                            )}
                        >
                            <Bell className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-black text-[var(--terminal-text)]">{notification.title}</h3>
                                {notification.unread ? (
                                    <span className="rounded-full bg-[var(--terminal-accent)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                                        New
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1 text-sm text-[var(--terminal-muted)]">{notification.actor} - {notification.timestamp}</p>
                            <p className="mt-2 text-sm leading-6 text-[var(--terminal-text)]">{notification.detail}</p>
                        </div>
                    </article>
                ))}
            </div>
        ) : (
            <div className="px-6 py-16 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--terminal-panel-soft)] text-[var(--terminal-muted)]">
                    <Bell className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-xl font-black text-[var(--terminal-text)]">No notifications</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--terminal-muted)]">
                    Subscribe to creators to receive in-app alerts when they publish articles or reports.
                </p>
            </div>
        )}
    </section>
);

const ChatView = ({ user }: { user: ResearchWireUser }) => {
    const currentUserName = user.name || user.email || 'You';
    const [conversations, setConversations] = useState<WireChatConversation[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [composerOpen, setComposerOpen] = useState(false);
    const [composerMode, setComposerMode] = useState<'direct' | 'group'>('direct');
    const [message, setMessage] = useState('');
    const [groupNameDraft, setGroupNameDraft] = useState('');

    const selectedConversation = conversations.find((conversation) => conversation.id === selectedId) ?? null;
    const currentMember = selectedConversation?.members.find((member) => member.id === user.id);
    const isGroupAdmin = selectedConversation?.type === 'group' && currentMember?.role === 'admin';

    const handleCreateConversation = (conversation: WireChatConversation) => {
        setConversations((current) => [conversation, ...current]);
        setSelectedId(conversation.id);
        setGroupNameDraft(conversation.name);
        setComposerOpen(false);
    };

    const handleSendMessage = () => {
        const trimmedMessage = message.trim();
        if (!trimmedMessage || !selectedConversation) return;

        setConversations((current) =>
            current.map((conversation) =>
                conversation.id === selectedConversation.id
                    ? {
                          ...conversation,
                          status: 'active',
                          messages: [
                              ...conversation.messages,
                              {
                                  id: `message-${Date.now()}`,
                                  senderId: user.id,
                                  senderName: currentUserName,
                                  body: trimmedMessage,
                                  createdAt: 'Now',
                              },
                          ],
                      }
                    : conversation,
            ),
        );
        setMessage('');
    };

    const updateSelectedConversation = (updater: (conversation: WireChatConversation) => WireChatConversation | null) => {
        if (!selectedConversation) return;
        setConversations((current) =>
            current.flatMap((conversation) => {
                if (conversation.id !== selectedConversation.id) return [conversation];
                const updatedConversation = updater(conversation);
                return updatedConversation ? [updatedConversation] : [];
            }),
        );
    };

    const handleRenameGroup = () => {
        const nextName = groupNameDraft.trim();
        if (!nextName || !selectedConversation) return;
        updateSelectedConversation((conversation) => ({ ...conversation, name: nextName }));
    };

    const handlePromoteMember = (memberId: string) => {
        updateSelectedConversation((conversation) => ({
            ...conversation,
            members: conversation.members.map((member) =>
                member.id === memberId ? { ...member, role: 'admin' } : member,
            ),
        }));
    };

    const handleKickMember = (memberId: string) => {
        updateSelectedConversation((conversation) => ({
            ...conversation,
            members: conversation.members.filter((member) => member.id !== memberId),
        }));
    };

    const handleLeaveConversation = () => {
        if (!selectedConversation) return;
        updateSelectedConversation((conversation) =>
            conversation.type === 'direct'
                ? null
                : {
                      ...conversation,
                      members: conversation.members.filter((member) => member.id !== user.id),
                  },
        );
        setSelectedId(null);
    };

    return (
        <section className="overflow-hidden rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--terminal-border)] px-5 py-4">
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-[var(--terminal-text)]">Encrypted chat</h2>
                        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-2.5 py-1 text-xs font-black text-[var(--terminal-muted)]">
                            <Lock className="h-3.5 w-3.5" />
                            Private
                        </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--terminal-muted)]">
                        Send chat requests, create groups, and manage group members from one secure workspace.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            setComposerMode('direct');
                            setComposerOpen(true);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 text-sm font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)]"
                    >
                        <UserPlus className="h-4 w-4" />
                        New chat request
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setComposerMode('group');
                            setComposerOpen(true);
                        }}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--terminal-accent)] px-4 text-sm font-black text-white transition hover:brightness-110"
                    >
                        <Users className="h-4 w-4" />
                        New group
                    </button>
                </div>
            </div>

            <div className="grid min-h-[520px] lg:grid-cols-[280px_minmax(0,1fr)]">
                <aside className="border-b border-[var(--terminal-border)] lg:border-b-0 lg:border-r">
                    {conversations.length ? (
                        <div className="divide-y divide-[var(--terminal-border)]">
                            {conversations.map((conversation) => (
                                <button
                                    key={conversation.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedId(conversation.id);
                                        setGroupNameDraft(conversation.name);
                                    }}
                                    className={cn(
                                        'flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--terminal-accent)_7%,transparent)]',
                                        selectedId === conversation.id && 'bg-[color-mix(in_srgb,var(--terminal-accent)_10%,transparent)]',
                                    )}
                                >
                                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--terminal-panel-soft)] text-[var(--terminal-text)]">
                                        {conversation.type === 'group' ? <Users className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-black text-[var(--terminal-text)]">{conversation.name}</p>
                                        <p className="mt-1 truncate text-xs text-[var(--terminal-muted)]">
                                            {conversation.status === 'pending' ? 'Request pending' : `${conversation.members.length} members`}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="px-5 py-12 text-center">
                            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--terminal-panel-soft)] text-[var(--terminal-muted)]">
                                <MessageCircle className="h-5 w-5" />
                            </div>
                            <h3 className="mt-4 text-lg font-black text-[var(--terminal-text)]">No chats yet</h3>
                            <p className="mt-2 text-sm leading-6 text-[var(--terminal-muted)]">
                                Send a chat request or create a group to start a private conversation.
                            </p>
                        </div>
                    )}
                </aside>

                <div className="flex min-h-[520px] flex-col">
                    {selectedConversation ? (
                        <>
                            <div className="border-b border-[var(--terminal-border)] px-5 py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-lg font-black text-[var(--terminal-text)]">{selectedConversation.name}</h3>
                                        <p className="mt-1 text-sm text-[var(--terminal-muted)]">
                                            {selectedConversation.type === 'group'
                                                ? `${selectedConversation.members.length} members`
                                                : selectedConversation.status === 'pending'
                                                  ? 'Chat request sent'
                                                  : 'Direct chat'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleLeaveConversation}
                                        className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 py-2 text-xs font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-down)] hover:text-[var(--terminal-down)]"
                                    >
                                        {selectedConversation.type === 'group' ? 'Leave' : 'Close request'}
                                    </button>
                                </div>

                                {isGroupAdmin ? (
                                    <div className="mt-4 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4">
                                        <div className="flex flex-col gap-3 sm:flex-row">
                                            <input
                                                value={groupNameDraft}
                                                onChange={(event) => setGroupNameDraft(event.target.value)}
                                                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 text-sm font-semibold text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-accent)]"
                                                placeholder="Group name"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleRenameGroup}
                                                className="h-10 rounded-xl bg-[var(--terminal-accent)] px-4 text-sm font-black text-white transition hover:brightness-110"
                                            >
                                                Rename group
                                            </button>
                                        </div>
                                        <div className="mt-4 space-y-2">
                                            {selectedConversation.members.map((member) => (
                                                <div key={member.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-[var(--terminal-text)]">{member.name}</span>
                                                        {member.role === 'admin' ? (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--terminal-accent)] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                                                                <Crown className="h-3 w-3" />
                                                                Admin
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    {member.id !== user.id ? (
                                                        <div className="flex gap-2">
                                                            {member.role !== 'admin' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePromoteMember(member.id)}
                                                                    className="rounded-full border border-[var(--terminal-border)] px-3 py-1 text-xs font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)]"
                                                                >
                                                                    Make admin
                                                                </button>
                                                            ) : null}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleKickMember(member.id)}
                                                                className="rounded-full border border-[var(--terminal-border)] px-3 py-1 text-xs font-black text-[var(--terminal-down)] transition hover:border-[var(--terminal-down)]"
                                                            >
                                                                Kick
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
                                {selectedConversation.messages.length ? (
                                    selectedConversation.messages.map((chatMessage) => (
                                        <div
                                            key={chatMessage.id}
                                            className={cn(
                                                'max-w-[78%] rounded-2xl px-4 py-3',
                                                chatMessage.senderId === user.id
                                                    ? 'ml-auto bg-[var(--terminal-accent)] text-white'
                                                    : 'bg-[var(--terminal-panel-soft)] text-[var(--terminal-text)]',
                                            )}
                                        >
                                            <p className="text-xs font-black opacity-80">{chatMessage.senderName}</p>
                                            <p className="mt-1 text-sm leading-6">{chatMessage.body}</p>
                                            <p className="mt-2 text-[10px] font-semibold opacity-70">{chatMessage.createdAt}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="grid h-full min-h-56 place-items-center text-center">
                                        <div>
                                            <ShieldCheck className="mx-auto h-10 w-10 text-[var(--terminal-muted)]" />
                                            <h3 className="mt-4 text-lg font-black text-[var(--terminal-text)]">No messages yet</h3>
                                            <p className="mt-2 max-w-md text-sm leading-6 text-[var(--terminal-muted)]">
                                                Messages will stay in this private chat once encrypted storage is connected.
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-[var(--terminal-border)] p-4">
                                <div className="flex gap-2 rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-2">
                                    <input
                                        value={message}
                                        onChange={(event) => setMessage(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') handleSendMessage();
                                        }}
                                        placeholder="Write an encrypted message..."
                                        className="h-10 min-w-0 flex-1 border-0 bg-transparent px-3 text-sm text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)]"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSendMessage}
                                        disabled={!message.trim()}
                                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-[var(--terminal-accent)] px-4 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Send className="h-4 w-4" />
                                        Send
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid flex-1 place-items-center px-5 py-16 text-center">
                            <div>
                                <Lock className="mx-auto h-12 w-12 text-[var(--terminal-muted)]" />
                                <h3 className="mt-5 text-xl font-black text-[var(--terminal-text)]">Select or create a chat</h3>
                                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--terminal-muted)]">
                                    Chat requests and groups will appear here. Group creators start as admins.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {composerOpen ? (
                <ChatComposerDialog
                    user={user}
                    currentUserName={currentUserName}
                    initialMode={composerMode}
                    onClose={() => setComposerOpen(false)}
                    onCreate={handleCreateConversation}
                />
            ) : null}
        </section>
    );
};

const ChatComposerDialog = ({
    user,
    currentUserName,
    initialMode,
    onClose,
    onCreate,
}: {
    user: ResearchWireUser;
    currentUserName: string;
    initialMode: 'direct' | 'group';
    onClose: () => void;
    onCreate: (conversation: WireChatConversation) => void;
}) => {
    const [mode, setMode] = useState<'direct' | 'group'>(initialMode);
    const [recipient, setRecipient] = useState('');
    const [groupName, setGroupName] = useState('');
    const [participants, setParticipants] = useState('');

    const participantNames = participants
        .split(',')
        .map((participant) => participant.trim())
        .filter(Boolean);
    const canCreate = mode === 'direct' ? Boolean(recipient.trim()) : Boolean(groupName.trim() && participantNames.length);

    const handleCreate = () => {
        if (!canCreate) return;
        const conversationId = `chat-${Date.now()}`;

        if (mode === 'direct') {
            onCreate({
                id: conversationId,
                type: 'direct',
                name: recipient.trim(),
                status: 'pending',
                members: [
                    { id: user.id, name: currentUserName, role: 'member' },
                    { id: `member-${recipient.trim().toLowerCase().replace(/\s+/g, '-')}`, name: recipient.trim(), role: 'member' },
                ],
                messages: [],
            });
            return;
        }

        onCreate({
            id: conversationId,
            type: 'group',
            name: groupName.trim(),
            status: 'active',
            members: [
                { id: user.id, name: currentUserName, role: 'admin' },
                ...participantNames.map((participantName) => ({
                    id: `member-${participantName.toLowerCase().replace(/\s+/g, '-')}-${conversationId}`,
                    name: participantName,
                    role: 'member' as const,
                })),
            ],
            messages: [],
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6">
            <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-5 py-4">
                    <h2 className="text-xl font-black text-[var(--terminal-text)]">Start encrypted chat</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] text-lg font-bold text-[var(--terminal-muted)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-text)]"
                        aria-label="Close chat composer"
                    >
                        x
                    </button>
                </div>
                <div className="space-y-4 p-5">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[var(--terminal-panel-soft)] p-1">
                        <button
                            type="button"
                            onClick={() => setMode('direct')}
                            className={cn(
                                'h-10 rounded-xl text-sm font-black transition',
                                mode === 'direct' ? 'bg-[var(--terminal-accent)] text-white' : 'text-[var(--terminal-muted)]',
                            )}
                        >
                            Chat request
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('group')}
                            className={cn(
                                'h-10 rounded-xl text-sm font-black transition',
                                mode === 'group' ? 'bg-[var(--terminal-accent)] text-white' : 'text-[var(--terminal-muted)]',
                            )}
                        >
                            Group
                        </button>
                    </div>

                    {mode === 'direct' ? (
                        <label className="block">
                            <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--terminal-muted)]">Recipient</span>
                            <input
                                value={recipient}
                                onChange={(event) => setRecipient(event.target.value)}
                                placeholder="@username or full name"
                                className="mt-2 h-11 w-full rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 text-sm font-semibold text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-accent)]"
                            />
                        </label>
                    ) : (
                        <>
                            <label className="block">
                                <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--terminal-muted)]">Group name</span>
                                <input
                                    value={groupName}
                                    onChange={(event) => setGroupName(event.target.value)}
                                    placeholder="Research desk"
                                    className="mt-2 h-11 w-full rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 text-sm font-semibold text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-accent)]"
                                />
                            </label>
                            <label className="block">
                                <span className="text-xs font-black uppercase tracking-[0.14em] text-[var(--terminal-muted)]">Members</span>
                                <input
                                    value={participants}
                                    onChange={(event) => setParticipants(event.target.value)}
                                    placeholder="Maya Chen, Daniel Brooks"
                                    className="mt-2 h-11 w-full rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-3 text-sm font-semibold text-[var(--terminal-text)] outline-none focus:border-[var(--terminal-accent)]"
                                />
                                <span className="mt-2 block text-xs text-[var(--terminal-muted)]">Separate names with commas.</span>
                            </label>
                        </>
                    )}

                    <button
                        type="button"
                        onClick={handleCreate}
                        disabled={!canCreate}
                        className="h-11 w-full rounded-xl bg-[var(--terminal-accent)] text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {mode === 'direct' ? 'Send chat request' : 'Create group'}
                    </button>
                </div>
            </section>
        </div>
    );
};

const SubscriptionsView = ({ creators }: { creators: WireCreator[] }) => {
    if (!creators.length) {
        return (
            <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-6 py-14 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--terminal-panel-soft)] text-[var(--terminal-muted)]">
                    <CreditCard className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-2xl font-black text-[var(--terminal-text)]">Following no one</h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--terminal-muted)]">
                    Follow creators and research desks to see their reports, articles, and market notes here.
                </p>
            </div>
        );
    }

    return (
        <div className="divide-y divide-[var(--terminal-border)] border-t border-[var(--terminal-border)]">
            {creators.map((creator) => (
                <article key={creator.id} className="flex items-center gap-4 px-1 py-6">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--terminal-panel-soft)] text-sm font-black text-[var(--terminal-text)]">
                        {creator.name.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-black text-[var(--terminal-text)]">{creator.name}</h2>
                            <span className="text-sm text-[var(--terminal-muted)]">{creator.subscribers}</span>
                        </div>
                        <p className="mt-1 text-sm text-[var(--terminal-muted)]">{creator.role}</p>
                        <p className="mt-3 text-base font-semibold text-[var(--terminal-text)]">{creator.latestReport}</p>
                    </div>
                    <button
                        type="button"
                        className="rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-2 text-sm font-bold text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)]"
                    >
                        Open
                    </button>
                </article>
            ))}
        </div>
    );
};

const ExploreView = ({
    currentUserId,
    onOpenProfile,
}: {
    currentUserId: string;
    onOpenProfile: (user: ResearchWireSearchUser) => void;
}) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<ResearchWireSearchUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<ResearchWireSearchUser | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const query = search.trim();
        setError(null);

        if (!query) {
            setResults([]);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(`/api/research-wire/users?q=${encodeURIComponent(query)}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null);

                if (!response.ok || !data?.success) {
                    setError(data?.message ?? 'Could not search users.');
                    setResults([]);
                    return;
                }

                setResults(Array.isArray(data.users) ? data.users : []);
                setSelectedUser(null);
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setError(fetchError instanceof Error ? fetchError.message : 'Could not search users.');
                setResults([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }, 220);

        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [search]);

    if (selectedUser) {
        return (
            <PublicProfileView
                currentUserId={currentUserId}
                user={selectedUser}
                onBack={() => setSelectedUser(null)}
                onOpenProfile={onOpenProfile}
            />
        );
    }

    return (
        <section className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-5">
            <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-black text-[var(--terminal-text)]">Explore creators</h2>
                <p className="text-sm leading-6 text-[var(--terminal-muted)]">
                    Search by username or full profile name. Results appear when the beginning matches.
                </p>
            </div>

            <label className="mt-5 flex items-center rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 focus-within:border-[var(--terminal-accent)]">
                <Search className="mr-3 h-5 w-5 shrink-0 text-[var(--terminal-muted)]" />
                <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search @username or full name"
                    className="h-12 min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)]"
                />
            </label>

            <div className="mt-6">
                {!search.trim() ? (
                    <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-5 py-10 text-center text-sm text-[var(--terminal-muted)]">
                        Start typing a username like @maya or a profile name like Maya Chen.
                    </div>
                ) : loading ? (
                    <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-5 py-10 text-center text-sm text-[var(--terminal-muted)]">
                        Searching users...
                    </div>
                ) : error ? (
                    <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-5 py-10 text-center text-sm text-[var(--terminal-down)]">
                        {error}
                    </div>
                ) : results.length ? (
                    <div className="divide-y divide-[var(--terminal-border)] overflow-hidden rounded-2xl border border-[var(--terminal-border)]">
                        {results.map((result) => (
                            <article key={result.id} className="flex items-center gap-4 bg-[var(--terminal-panel-soft)] px-4 py-4">
                                <Avatar className="h-12 w-12 border border-[var(--terminal-border)]">
                                    <AvatarImage src={result.image || undefined} alt={`${result.name} profile`} />
                                    <AvatarFallback className="bg-[var(--terminal-panel)] text-sm font-black text-[var(--terminal-text)]">
                                        {result.name.slice(0, 1).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-black text-[var(--terminal-text)]">{result.name}</p>
                                    <p className="mt-1 truncate text-sm text-[var(--terminal-muted)]">
                                        {result.username ?? 'No username set'}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedUser(result)}
                                    className="rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-2 text-sm font-bold text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)]"
                                >
                                    View
                                </button>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-5 py-10 text-center text-sm text-[var(--terminal-muted)]">
                        No users match the start of that username or name.
                    </div>
                )}
            </div>
        </section>
    );
};

const PublicProfileView = ({
    currentUserId,
    user,
    onBack,
    onOpenProfile,
    backLabel = 'Back to search',
}: {
    currentUserId: string;
    user: ResearchWireSearchUser;
    onBack: () => void;
    onOpenProfile?: (user: ResearchWireSearchUser) => void;
    backLabel?: string;
}) => (
    <section className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-6">
        <button
            type="button"
            onClick={onBack}
            className="mb-6 rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-2 text-sm font-bold text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)]"
        >
            {backLabel}
        </button>
        <div className="flex flex-col items-center text-center">
            <Avatar className="h-24 w-24 border border-[var(--terminal-border)]">
                <AvatarImage src={user.image || undefined} alt={`${user.name} profile`} />
                <AvatarFallback className="bg-[var(--terminal-panel-soft)] text-3xl font-black text-[var(--terminal-text)]">
                    {user.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <h2 className="mt-5 text-3xl font-black text-[var(--terminal-text)]">{user.name}</h2>
            <p className="mt-2 text-base font-semibold text-[var(--terminal-muted)]">
                {user.username ?? 'No username set'}
            </p>
            {user.bio ? (
                <p className="mt-4 max-w-md text-sm leading-6 text-[var(--terminal-muted)]">{user.bio}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                {user.id === currentUserId ? (
                    <span className="rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-5 py-2 text-sm font-bold text-[var(--terminal-muted)]">
                        This is your profile
                    </span>
                ) : (
                    <>
                        <FollowButton targetUserId={user.id} />
                        <SubscribeButton targetUserId={user.id} />
                    </>
                )}
                {onOpenProfile ? (
                    <button
                        type="button"
                        onClick={() => onOpenProfile(user)}
                        className="h-11 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-5 text-sm font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)]"
                    >
                        Take to profile
                    </button>
                ) : null}
            </div>
        </div>
    </section>
);

const ResearchWireUserProfileView = ({
    currentUserId,
    user,
    posts,
    onBack,
    onOpenProfile,
}: {
    currentUserId: string;
    user: ResearchWireSearchUser;
    posts: WirePost[];
    onBack: () => void;
    onOpenProfile: (user: ResearchWireSearchUser) => void;
}) => {
    const [followCounts, setFollowCounts] = useState<Pick<FollowState, 'followersCount' | 'followingCount'> | null>(null);
    const [openFollowList, setOpenFollowList] = useState<FollowListType | null>(null);
    const profilePosts = useMemo(() => posts.filter((post) => post.author === user.name), [posts, user.name]);

    useEffect(() => {
        const controller = new AbortController();

        const loadCounts = async () => {
            try {
                const response = await fetch(`/api/research-wire/follows?targetUserId=${encodeURIComponent(user.id)}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) return;
                setFollowCounts({
                    followersCount: Number(data.followersCount ?? 0),
                    followingCount: Number(data.followingCount ?? 0),
                });
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
            }
        };

        void loadCounts();

        return () => controller.abort();
    }, [user.id]);

    return (
        <div className="space-y-8">
            <section className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-6">
                <button
                    type="button"
                    onClick={onBack}
                    className="mb-6 rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-2 text-sm font-bold text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)]"
                >
                    Back
                </button>
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-center gap-5">
                        <Avatar className="h-20 w-20 border border-[var(--terminal-border)]">
                            <AvatarImage src={user.image || undefined} alt={`${user.name} profile`} />
                            <AvatarFallback className="bg-[var(--terminal-panel-soft)] text-2xl font-black text-[var(--terminal-text)]">
                                {user.name.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--terminal-accent)]">
                                Research Wire profile
                            </p>
                            <h1 className="mt-2 truncate text-3xl font-black text-[var(--terminal-text)]">{user.name}</h1>
                            <p className="mt-1 text-sm font-semibold text-[var(--terminal-muted)]">
                                {user.username ?? 'No username set'}
                            </p>
                        </div>
                    </div>
                    {user.id === currentUserId ? (
                        <span className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-2 text-sm font-bold text-[var(--terminal-muted)]">
                            This is your profile
                        </span>
                    ) : (
                        <div className="flex flex-wrap gap-3">
                            <FollowButton
                                targetUserId={user.id}
                                onStateChange={(nextState) =>
                                    setFollowCounts({
                                        followersCount: nextState.followersCount,
                                        followingCount: nextState.followingCount,
                                    })
                                }
                            />
                            <SubscribeButton targetUserId={user.id} />
                        </div>
                    )}
                </div>
                <p className="mt-6 max-w-2xl text-sm leading-6 text-[var(--terminal-muted)]">
                    {user.bio || 'No bio added yet.'}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <FollowCountCard
                        label="Followers"
                        value={followCounts?.followersCount ?? 0}
                        onClick={() => setOpenFollowList('followers')}
                    />
                    <FollowCountCard
                        label="Following"
                        value={followCounts?.followingCount ?? 0}
                        onClick={() => setOpenFollowList('following')}
                    />
                </div>
            </section>

            {openFollowList ? (
                <FollowListDialog
                    viewerUserId={currentUserId}
                    targetUserId={user.id}
                    type={openFollowList}
                    onClose={() => setOpenFollowList(null)}
                    onOpenProfile={(nextUser) => {
                        setOpenFollowList(null);
                        onOpenProfile(nextUser);
                    }}
                />
            ) : null}

            <section className="border-t border-[var(--terminal-border)] pt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black text-[var(--terminal-text)]">{user.name}&apos;s Research Wire posts</h2>
                    <span className="text-sm text-[var(--terminal-muted)]">{profilePosts.length} posts</span>
                </div>
                {profilePosts.length ? (
                    <div className="divide-y divide-[var(--terminal-border)]">
                        {profilePosts.map((post) => (
                            <PostItem key={post.id} post={post} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-6 py-10 text-center text-sm text-[var(--terminal-muted)]">
                        No public Research Wire posts from this profile yet.
                    </div>
                )}
            </section>
        </div>
    );
};

const FollowButton = ({
    targetUserId,
    onStateChange,
}: {
    targetUserId: string;
    onStateChange?: (state: FollowState) => void;
}) => {
    const [state, setState] = useState<FollowState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const controller = new AbortController();

        const loadFollowState = async () => {
            setError(null);
            try {
                const response = await fetch(`/api/research-wire/follows?targetUserId=${encodeURIComponent(targetUserId)}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) {
                    setError(data?.message ?? 'Could not load follow state.');
                    return;
                }
                const nextState = {
                    followersCount: Number(data.followersCount ?? 0),
                    followingCount: Number(data.followingCount ?? 0),
                    isFollowing: Boolean(data.isFollowing),
                };
                setState(nextState);
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setError(fetchError instanceof Error ? fetchError.message : 'Could not load follow state.');
            }
        };

        void loadFollowState();

        return () => controller.abort();
    }, [targetUserId]);

    const handleToggle = () => {
        if (!state) return;
        setError(null);
        startTransition(async () => {
            try {
                const response = await fetch('/api/research-wire/follows', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetUserId,
                        action: state.isFollowing ? 'unfollow' : 'follow',
                    }),
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) {
                    setError(data?.message ?? 'Could not update follow state.');
                    return;
                }
                const nextState = {
                    followersCount: Number(data.followersCount ?? 0),
                    followingCount: Number(data.followingCount ?? 0),
                    isFollowing: Boolean(data.isFollowing),
                };
                setState(nextState);
                onStateChange?.(nextState);
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : 'Could not update follow state.');
            }
        });
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                type="button"
                onClick={handleToggle}
                disabled={!state || isPending}
                className={cn(
                    'h-11 rounded-xl px-6 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50',
                    state?.isFollowing
                        ? 'border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] text-[var(--terminal-text)] hover:border-[var(--terminal-accent)]'
                        : 'bg-[var(--terminal-accent)] text-white hover:brightness-110',
                )}
            >
                {isPending ? 'Saving...' : state?.isFollowing ? 'Unfollow' : 'Follow'}
            </button>
            {error ? <p className="text-xs font-semibold text-[var(--terminal-down)]">{error}</p> : null}
        </div>
    );
};

const SubscribeButton = ({ targetUserId }: { targetUserId: string }) => {
    const [state, setState] = useState<SubscribeState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        const controller = new AbortController();

        const loadSubscribeState = async () => {
            setError(null);
            try {
                const response = await fetch(`/api/research-wire/subscriptions?targetUserId=${encodeURIComponent(targetUserId)}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) {
                    setError(data?.message ?? 'Could not load subscribe state.');
                    return;
                }
                setState({
                    subscriberCount: Number(data.subscriberCount ?? 0),
                    isSubscribed: Boolean(data.isSubscribed),
                });
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setError(fetchError instanceof Error ? fetchError.message : 'Could not load subscribe state.');
            }
        };

        void loadSubscribeState();

        return () => controller.abort();
    }, [targetUserId]);

    const handleToggle = () => {
        if (!state) return;
        setError(null);
        startTransition(async () => {
            try {
                const response = await fetch('/api/research-wire/subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        targetUserId,
                        action: state.isSubscribed ? 'unsubscribe' : 'subscribe',
                    }),
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) {
                    setError(data?.message ?? 'Could not update subscribe state.');
                    return;
                }
                setState({
                    subscriberCount: Number(data.subscriberCount ?? 0),
                    isSubscribed: Boolean(data.isSubscribed),
                });
            } catch (fetchError) {
                setError(fetchError instanceof Error ? fetchError.message : 'Could not update subscribe state.');
            }
        });
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <button
                type="button"
                onClick={handleToggle}
                disabled={!state || isPending}
                className={cn(
                    'inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-50',
                    state?.isSubscribed
                        ? 'border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] text-[var(--terminal-text)] hover:border-[var(--terminal-accent)]'
                        : 'bg-[var(--terminal-accent)] text-white hover:brightness-110',
                )}
            >
                <Bell className="h-4 w-4" />
                {isPending ? 'Saving...' : state?.isSubscribed ? 'Subscribed' : 'Subscribe'}
            </button>
            {error ? <p className="text-xs font-semibold text-[var(--terminal-down)]">{error}</p> : null}
        </div>
    );
};

const ProfileView = ({
    user,
    posts,
    onOpenProfile,
}: {
    user: ResearchWireUser;
    posts: WirePost[];
    onOpenProfile: (user: ResearchWireSearchUser) => void;
}) => {
    const displayName = user.name || 'ZedXe user';
    const email = user.email || 'No email available';
    const initials = (user.name || user.email || '?').slice(0, 1).toUpperCase();
    const [username, setUsername] = useState((user.username || '').replace(/^@/, ''));
    const [savedUsername, setSavedUsername] = useState(user.username || '');
    const [usernameUpdatedAt, setUsernameUpdatedAt] = useState(user.usernameUpdatedAt || null);
    const [usernameEditMode, setUsernameEditMode] = useState(!user.username);
    const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [bio, setBio] = useState(user.bio || '');
    const [savedBio, setSavedBio] = useState(user.bio || '');
    const [bioEditMode, setBioEditMode] = useState(!user.bio);
    const [bioMessage, setBioMessage] = useState<string | null>(null);
    const [bioError, setBioError] = useState<string | null>(null);
    const [followCounts, setFollowCounts] = useState<Pick<FollowState, 'followersCount' | 'followingCount'> | null>(null);
    const [openFollowList, setOpenFollowList] = useState<FollowListType | null>(null);
    const [currentTime] = useState(() => Date.now());
    const [isPending, startTransition] = useTransition();
    const [isBioPending, startBioTransition] = useTransition();

    const normalizedUsername = username.trim().toLowerCase();
    const usernameWithPrefix = normalizedUsername ? `@${normalizedUsername.replace(/^@+/, '')}` : '';
    const usernameIsValid = !normalizedUsername || /^@?[a-z0-9_]{3,24}$/.test(normalizedUsername);
    const usernameChanged = usernameWithPrefix !== savedUsername;
    const usernameCooldownUntil = useMemo(() => {
        if (!savedUsername || !usernameUpdatedAt) return null;
        const lastChangedAt = new Date(usernameUpdatedAt).getTime();
        if (!Number.isFinite(lastChangedAt)) return null;
        return new Date(lastChangedAt + USERNAME_CHANGE_COOLDOWN_MS);
    }, [savedUsername, usernameUpdatedAt]);
    const usernameChangeLocked = Boolean(usernameCooldownUntil && usernameCooldownUntil.getTime() > currentTime);
    const usernameCooldownLabel = usernameCooldownUntil
        ? usernameCooldownUntil.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    useEffect(() => {
        const controller = new AbortController();

        const loadCounts = async () => {
            try {
                const response = await fetch(`/api/research-wire/follows?targetUserId=${encodeURIComponent(user.id)}`, {
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) return;
                setFollowCounts({
                    followersCount: Number(data.followersCount ?? 0),
                    followingCount: Number(data.followingCount ?? 0),
                });
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
            }
        };

        void loadCounts();

        return () => controller.abort();
    }, [user.id]);

    const handleUsernameSave = () => {
        setUsernameMessage(null);
        setUsernameError(null);

        if (!usernameWithPrefix) {
            setUsernameError('Choose a username before saving.');
            return;
        }
        if (!usernameIsValid) {
            setUsernameError('Use 3-24 letters, numbers, or underscores.');
            return;
        }
        if (!usernameChanged) {
            setUsernameMessage('Username is already saved.');
            return;
        }

        startTransition(async () => {
            try {
                const response = await fetch('/api/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameWithPrefix }),
                });
                const data = await response.json().catch(() => null);

                if (!response.ok || !data?.success) {
                    setUsernameError(data?.message ?? 'Could not save username.');
                    return;
                }

                const nextUsername = data.user?.username ?? usernameWithPrefix;
                const nextUsernameUpdatedAt = data.user?.usernameUpdatedAt ?? new Date().toISOString();
                setSavedUsername(nextUsername);
                setUsername(nextUsername.replace(/^@/, ''));
                setUsernameUpdatedAt(nextUsernameUpdatedAt);
                setUsernameEditMode(false);
                setUsernameMessage('Username saved.');
            } catch (error) {
                setUsernameError(error instanceof Error ? error.message : 'Could not save username.');
            }
        });
    };

    const handleBioSave = () => {
        const nextBio = bio.trim();
        setBioMessage(null);
        setBioError(null);

        if (nextBio.length > 280) {
            setBioError('Bio must be 280 characters or fewer.');
            return;
        }
        if (nextBio === savedBio) {
            setBioMessage('Bio is already saved.');
            return;
        }

        startBioTransition(async () => {
            try {
                const response = await fetch('/api/profile', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bio: nextBio }),
                });
                const data = await response.json().catch(() => null);

                if (!response.ok || !data?.success) {
                    setBioError(data?.message ?? 'Could not save bio.');
                    return;
                }

                const updatedBio = data.user?.bio ?? nextBio;
                setSavedBio(updatedBio);
                setBio(updatedBio);
                setBioEditMode(false);
                setBioMessage('Bio saved.');
            } catch (error) {
                setBioError(error instanceof Error ? error.message : 'Could not save bio.');
            }
        });
    };

    return (
        <div className="space-y-8">
            <section className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <Avatar className="h-20 w-20 border border-[var(--terminal-border)]">
                        <AvatarImage src={user.image || undefined} alt={`${displayName} profile`} />
                        <AvatarFallback className="bg-[var(--terminal-panel-soft)] text-2xl font-black text-[var(--terminal-text)]">
                            {initials}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--terminal-accent)]">
                            Signed-in profile
                        </p>
                        <h1 className="mt-2 truncate text-3xl font-black text-[var(--terminal-text)]">{displayName}</h1>
                        <p className="mt-1 break-all text-sm text-[var(--terminal-muted)]">{email}</p>
                    </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <ProfileField label="Name" value={displayName} />
                    <ProfileField label="Email" value={email} />
                    <FollowCountCard
                        label="Followers"
                        value={followCounts?.followersCount ?? 0}
                        onClick={() => setOpenFollowList((current) => (current === 'followers' ? null : 'followers'))}
                    />
                    <FollowCountCard
                        label="Following"
                        value={followCounts?.followingCount ?? 0}
                        onClick={() => setOpenFollowList((current) => (current === 'following' ? null : 'following'))}
                    />
                    <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4 sm:col-span-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--terminal-muted)]">
                                    Bio
                                </p>
                                <p className="mt-1 text-xs text-[var(--terminal-muted)]">
                                    A short profile intro shown to readers and followers.
                                </p>
                            </div>
                            {!bioEditMode ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setBioEditMode(true);
                                        setBioMessage(null);
                                        setBioError(null);
                                    }}
                                    className="rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-1 text-xs font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)]"
                                >
                                    Edit
                                </button>
                            ) : null}
                        </div>
                        {bioEditMode ? (
                            <div className="mt-4">
                                <textarea
                                    value={bio}
                                    onChange={(event) => {
                                        setBio(event.target.value);
                                        setBioMessage(null);
                                        setBioError(null);
                                    }}
                                    maxLength={280}
                                    placeholder="Write a short bio..."
                                    className="min-h-24 w-full resize-y rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-3 text-sm leading-6 text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)] focus:border-[var(--terminal-accent)]"
                                />
                                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <span className="text-xs text-[var(--terminal-muted)]">{bio.trim().length}/280</span>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBio(savedBio);
                                                setBioEditMode(false);
                                                setBioMessage(null);
                                                setBioError(null);
                                            }}
                                            className="h-10 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 text-sm font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)]"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleBioSave}
                                            disabled={isBioPending || bio.trim() === savedBio}
                                            className="h-10 rounded-xl bg-[var(--terminal-accent)] px-5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                            {isBioPending ? 'Saving...' : 'Save bio'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-3">
                                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--terminal-text)]">
                                    {savedBio || 'No bio added yet.'}
                                </p>
                            </div>
                        )}
                        {bioError ? <p className="mt-2 text-xs font-semibold text-[var(--terminal-down)]">{bioError}</p> : null}
                        {bioMessage ? <p className="mt-2 text-xs font-semibold text-[var(--terminal-up)]">{bioMessage}</p> : null}
                    </div>
                    <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4 sm:col-span-2">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--terminal-muted)]">
                                    Platform username
                                </p>
                                <p className="mt-1 text-xs text-[var(--terminal-muted)]">
                                    Unique across ZedXe. After saving, it can be changed once every 15 days.
                                </p>
                            </div>
                            {savedUsername ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-[var(--terminal-accent)] px-3 py-1 text-xs font-black text-white">
                                        {savedUsername}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUsernameEditMode(true);
                                            setUsernameMessage(null);
                                            setUsernameError(null);
                                        }}
                                        disabled={usernameChangeLocked}
                                        className="rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 py-1 text-xs font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-accent)] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Edit
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        {!savedUsername || usernameEditMode ? (
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <label className="flex min-w-0 flex-1 items-center rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-3 focus-within:border-[var(--terminal-accent)]">
                                    <span className="text-lg font-black text-[var(--terminal-muted)]">@</span>
                                    <input
                                        value={username}
                                        onChange={(event) => {
                                            setUsername(event.target.value.replace(/^@+/, '').toLowerCase());
                                            setUsernameMessage(null);
                                            setUsernameError(null);
                                        }}
                                        placeholder="yourname"
                                        className="h-11 min-w-0 flex-1 border-0 bg-transparent px-1 text-sm font-semibold text-[var(--terminal-text)] outline-none placeholder:text-[var(--terminal-muted)]"
                                    />
                                </label>
                                <div className="flex gap-2">
                                    {savedUsername ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setUsername(savedUsername.replace(/^@/, ''));
                                                setUsernameEditMode(false);
                                                setUsernameMessage(null);
                                                setUsernameError(null);
                                            }}
                                            className="h-11 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 text-sm font-black text-[var(--terminal-text)] transition hover:border-[var(--terminal-accent)]"
                                        >
                                            Cancel
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={handleUsernameSave}
                                        disabled={isPending || !usernameChanged}
                                        className="h-11 rounded-xl bg-[var(--terminal-accent)] px-5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isPending ? 'Saving...' : savedUsername ? 'Save username' : 'Claim username'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-4 py-3">
                                <p className="text-sm font-semibold text-[var(--terminal-text)]">{savedUsername}</p>
                                <p className="mt-1 text-xs text-[var(--terminal-muted)]">
                                    {usernameChangeLocked && usernameCooldownLabel
                                        ? `Next username change available on ${usernameCooldownLabel}.`
                                        : 'Use Edit to change your username.'}
                                </p>
                            </div>
                        )}
                        {usernameError ? <p className="mt-2 text-xs font-semibold text-[var(--terminal-down)]">{usernameError}</p> : null}
                        {usernameMessage ? <p className="mt-2 text-xs font-semibold text-[var(--terminal-up)]">{usernameMessage}</p> : null}
                    </div>
                </div>
            </section>

            {openFollowList ? (
                <FollowListDialog
                    viewerUserId={user.id}
                    targetUserId={user.id}
                    type={openFollowList}
                    onClose={() => setOpenFollowList(null)}
                    onOpenProfile={(nextUser) => {
                        setOpenFollowList(null);
                        onOpenProfile(nextUser);
                    }}
                />
            ) : null}

            <section className="border-t border-[var(--terminal-border)] pt-6">
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-black text-[var(--terminal-text)]">Your Research Wire posts</h2>
                    <span className="text-sm text-[var(--terminal-muted)]">{posts.length} preview posts</span>
                </div>
                {posts.length ? (
                    <div className="divide-y divide-[var(--terminal-border)]">
                        {posts.map((post) => (
                            <PostItem key={post.id} post={post} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] px-6 py-10 text-center text-sm text-[var(--terminal-muted)]">
                        No Research Wire posts from this profile yet.
                    </div>
                )}
            </section>
        </div>
    );
};

const ProfileField = ({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) => (
    <div className={cn('rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4', wide && 'sm:col-span-2')}>
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--terminal-muted)]">{label}</p>
        <p className="mt-2 break-all text-sm font-semibold text-[var(--terminal-text)]">{value}</p>
    </div>
);

const FollowCountCard = ({ label, value, onClick }: { label: string; value: number; onClick: () => void }) => (
    <button
        type="button"
        onClick={onClick}
        className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] p-4 text-left transition hover:border-[var(--terminal-accent)] hover:bg-[color-mix(in_srgb,var(--terminal-accent)_8%,var(--terminal-panel-soft))]"
    >
        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--terminal-muted)]">{label}</p>
        <p className="mt-2 text-sm font-semibold text-[var(--terminal-text)]">{value}</p>
    </button>
);

const FollowListDialog = ({
    viewerUserId,
    targetUserId,
    type,
    onClose,
    onOpenProfile,
}: {
    viewerUserId: string;
    targetUserId: string;
    type: FollowListType;
    onClose: () => void;
    onOpenProfile: (user: ResearchWireSearchUser) => void;
}) => {
    const [users, setUsers] = useState<ResearchWireSearchUser[]>([]);
    const [selectedUser, setSelectedUser] = useState<ResearchWireSearchUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const loadUsers = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(
                    `/api/research-wire/follows?targetUserId=${encodeURIComponent(targetUserId)}&list=${type}`,
                    { signal: controller.signal },
                );
                const data = await response.json().catch(() => null);
                if (!response.ok || !data?.success) {
                    setError(data?.message ?? 'Could not load users.');
                    setUsers([]);
                    return;
                }
                setUsers(Array.isArray(data.users) ? data.users : []);
            } catch (fetchError) {
                if (fetchError instanceof DOMException && fetchError.name === 'AbortError') return;
                setError(fetchError instanceof Error ? fetchError.message : 'Could not load users.');
                setUsers([]);
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void loadUsers();

        return () => controller.abort();
    }, [targetUserId, type]);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 px-4 py-6">
            <section className="max-h-[82vh] w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--terminal-border)] bg-[var(--terminal-panel)] shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--terminal-border)] px-5 py-4">
                    <h2 className="text-xl font-black capitalize text-[var(--terminal-text)]">
                        {selectedUser ? 'Profile' : type}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="grid h-9 w-9 place-items-center rounded-full border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] text-lg font-bold text-[var(--terminal-muted)] transition hover:border-[var(--terminal-accent)] hover:text-[var(--terminal-text)]"
                        aria-label="Close"
                    >
                        x
                    </button>
                </div>
                <div className="max-h-[66vh] overflow-y-auto p-5">
                    {selectedUser ? (
                        <PublicProfileView
                            currentUserId={viewerUserId}
                            user={selectedUser}
                            onBack={() => setSelectedUser(null)}
                            onOpenProfile={(userToOpen) => {
                                onClose();
                                onOpenProfile(userToOpen);
                            }}
                            backLabel={`Back to ${type}`}
                        />
                    ) : loading ? (
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-8 text-center text-sm text-[var(--terminal-muted)]">
                            Loading {type}...
                        </div>
                    ) : error ? (
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-8 text-center text-sm text-[var(--terminal-down)]">
                            {error}
                        </div>
                    ) : users.length ? (
                        <div className="divide-y divide-[var(--terminal-border)] overflow-hidden rounded-xl border border-[var(--terminal-border)]">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => setSelectedUser(user)}
                                    className="flex w-full items-center gap-4 bg-[var(--terminal-panel-soft)] px-4 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--terminal-accent)_8%,var(--terminal-panel-soft))]"
                                >
                                    <Avatar className="h-11 w-11 border border-[var(--terminal-border)]">
                                        <AvatarImage src={user.image || undefined} alt={`${user.name} profile`} />
                                        <AvatarFallback className="bg-[var(--terminal-panel)] text-sm font-black text-[var(--terminal-text)]">
                                            {user.name.slice(0, 1).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="min-w-0">
                                        <p className="truncate font-black text-[var(--terminal-text)]">{user.name}</p>
                                        <p className="truncate text-sm text-[var(--terminal-muted)]">{user.username ?? 'No username set'}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-panel-soft)] px-4 py-8 text-center text-sm text-[var(--terminal-muted)]">
                            {type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default TerminalResearchWireClient;
