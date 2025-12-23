'use client';

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

type ProfileModalProps = {
    user: User;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const validateAvatarUrl = (value: string | null | undefined) => {
    if (!value) return null;
    if (value.length > 100) return "Avatar URL must be 100 characters or fewer.";
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            return "Avatar URL must start with http or https.";
        }
    } catch {
        return "Please enter a valid image URL.";
    }
    return null;
};

const validateName = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return "Name must be at least 2 characters.";
    if (trimmed.length > 50) return "Name must be 50 characters or fewer.";
    return null;
};

const ProfileModal = ({ user, open, onOpenChange }: ProfileModalProps) => {
    const router = useRouter();
    const [name, setName] = useState(user.name);
    const [avatarUrl, setAvatarUrl] = useState(user.image ?? "");
    const [editingName, setEditingName] = useState(false);
    const [showAvatarInput, setShowAvatarInput] = useState(false);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const [nameError, setNameError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [avatarLoadError, setAvatarLoadError] = useState(false);

    const initials = useMemo(() => user.name?.[0]?.toUpperCase() ?? "?", [user.name]);

    useEffect(() => {
        if (!open) {
            setAvatarLoadError(false);
            setAvatarError(null);
            setNameError(null);
            setEditingName(false);
            setShowAvatarInput(false);
            setName(user.name);
            setAvatarUrl(user.image ?? "");
        }
    }, [open, user.image, user.name]);

    const hasChanges = useMemo(() => {
        const trimmedName = name.trim();
        const trimmedAvatar = avatarUrl.trim();
        const nameChanged = trimmedName !== user.name;
        const avatarChanged = trimmedAvatar !== (user.image ?? "");
        return nameChanged || avatarChanged;
    }, [avatarUrl, name, user.image, user.name]);

    const handleAvatarChange = (value: string) => {
        setAvatarUrl(value);
        setAvatarLoadError(false);
        setAvatarError(validateAvatarUrl(value.trim() || null));
    };

    const handleSave = async () => {
        const trimmedName = name.trim();
        const trimmedAvatar = avatarUrl.trim();

        const nameValidation = editingName ? validateName(trimmedName) : null;
        const avatarValidation = showAvatarInput ? validateAvatarUrl(trimmedAvatar || null) : null;
        setNameError(nameValidation);
        setAvatarError(avatarValidation);

        if (nameValidation || avatarValidation) return;
        if (!hasChanges) {
            toast.info("No changes to save");
            return;
        }

        const payload: Record<string, string> = {};
        if (editingName && trimmedName !== user.name) {
            payload.name = trimmedName;
        }
        if (showAvatarInput && trimmedAvatar !== (user.image ?? "")) {
            payload.avatarUrl = trimmedAvatar;
        }

        setSaving(true);
        try {
            const response = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const contentType = response.headers.get("content-type") ?? "";
            const data = contentType.includes("application/json") ? await response.json() : null;

            if (!response.ok || !data?.success) {
                const message = data?.message ?? "Failed to update profile.";
                toast.error(message);
                return;
            }

            toast.success("Profile updated");
            onOpenChange(false);
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to update profile.";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const canSave = hasChanges && !avatarError && !nameError && !saving;

    const avatarPreview = !avatarLoadError && (avatarUrl || user.image)
        ? <img
            src={avatarUrl || user.image || ""}
            alt="Profile avatar"
            className="h-20 w-20 rounded-full object-cover border border-gray-700"
            onError={() => setAvatarLoadError(true)}
        />
        : (
            <div className="h-20 w-20 rounded-full bg-yellow-500 text-yellow-900 flex items-center justify-center text-2xl font-semibold">
                {initials}
            </div>
        );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-gray-900 text-gray-100 border border-gray-800 sm:max-w-md">
                <DialogHeader className="flex items-center justify-between">
                    <DialogTitle className="text-xl">Your Profile</DialogTitle>
                    <DialogClose />
                </DialogHeader>

                <div className="flex flex-col items-center gap-4">
                    {avatarPreview}

                    <Button variant="outline" className="border-gray-700 text-gray-200" onClick={() => setShowAvatarInput(true)}>
                        Change Profile Picture
                    </Button>
                    {showAvatarInput ? (
                        <div className="w-full space-y-2">
                            <label className="text-sm text-gray-400" htmlFor="avatar-url">Avatar URL</label>
                            <Input
                                id="avatar-url"
                                value={avatarUrl}
                                onChange={(e) => handleAvatarChange(e.target.value)}
                                placeholder="https://example.com/avatar.png"
                                className="bg-gray-800 border-gray-700 text-gray-100"
                            />
                            {avatarError ? <p className="text-xs text-red-400">{avatarError}</p> : null}
                        </div>
                    ) : null}

                    <div className="w-full space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-sm text-gray-400" htmlFor="name">Name</label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-xs text-yellow-400 hover:text-yellow-500"
                                onClick={() => setEditingName((prev) => !prev)}
                            >
                                {editingName ? "Cancel" : "Edit"}
                            </Button>
                        </div>
                        <Input
                            id="name"
                            value={name}
                            disabled={!editingName}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                            className="bg-gray-800 border-gray-700 text-gray-100 disabled:opacity-50"
                        />
                        {nameError ? <p className="text-xs text-red-400">{nameError}</p> : null}
                    </div>

                    <div className="w-full space-y-2">
                        <label className="text-sm text-gray-400" htmlFor="email">Email</label>
                        <Input
                            id="email"
                            value={user.email}
                            disabled
                            className="bg-gray-800 border-gray-700 text-gray-400"
                        />
                    </div>

                    <div className="w-full flex justify-end gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="border-gray-700 text-gray-200"
                            onClick={() => onOpenChange(false)}
                        >
                            Close
                        </Button>
                        <Button
                            type="button"
                            disabled={!canSave}
                            className="blue-btn text-white"
                            onClick={handleSave}
                        >
                            {saving ? "Saving..." : "Save changes"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProfileModal;
