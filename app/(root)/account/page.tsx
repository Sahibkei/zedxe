import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

const updateAccount = async (formData: FormData) => {
    "use server";

    const nameValue = formData.get("name");
    const imageValue = formData.get("image");

    const updates: { name?: string | null; image?: string | null } = {};

    if (typeof nameValue === "string") {
        updates.name = nameValue.trim() || null;
    }

    if (typeof imageValue === "string") {
        updates.image = imageValue.trim() || null;
    }

    if (Object.keys(updates).length === 0) return;

    await auth.api.updateUser({
        headers: await headers(),
        body: updates,
    });
};

const AccountPage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) redirect("/sign-in");

    const user = session.user;

    return (
        <section className="max-w-xl mx-auto space-y-6">
            <div className="space-y-2">
                <p className="text-sm uppercase tracking-wide text-emerald-400">Account</p>
                <h1 className="text-3xl font-bold text-white">Profile settings</h1>
                <p className="text-sm text-gray-400">Update your display name and profile image URL.</p>
            </div>

            <form action={updateAccount} className="space-y-4 rounded-xl border border-gray-800 bg-[#0f1115] p-6">
                <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-300">
                        Full name
                    </Label>
                    <Input id="name" name="name" defaultValue={user.name ?? ""} placeholder="Your name" />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="image" className="text-gray-300">
                        Avatar image URL
                    </Label>
                    <Input
                        id="image"
                        name="image"
                        type="url"
                        defaultValue={user.image ?? ""}
                        placeholder="https://example.com/avatar.png"
                    />
                    <p className="text-xs text-gray-500">Debug: current image URL → {user.image ?? "(not set)"}</p>
                </div>

                <Button type="submit" className="w-full bg-emerald-500 text-black hover:bg-emerald-400">
                    Save changes
                </Button>
            </form>
        </section>
    );
};

export default AccountPage;
