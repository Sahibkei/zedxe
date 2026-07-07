import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import TerminalResearchWireClient from '@/components/terminal/TerminalResearchWireClient';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { Types } from 'mongoose';

const TerminalResearchWirePage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    const filters: Record<string, unknown>[] = [{ id: session.user.id }];
    if (Types.ObjectId.isValid(session.user.id)) {
        filters.push({ _id: new Types.ObjectId(session.user.id) });
    }
    const userDocument = db
        ? await db.collection('user').findOne<{ username?: string | null; bio?: string | null; usernameUpdatedAt?: Date | string | null }>({ $or: filters })
        : null;

    return (
        <TerminalResearchWireClient
            user={{
                id: session.user.id,
                name: session.user.name,
                email: session.user.email,
                image: session.user.image ?? null,
                username: userDocument?.username ?? null,
                bio: userDocument?.bio ?? null,
                usernameUpdatedAt: userDocument?.usernameUpdatedAt
                    ? new Date(userDocument.usernameUpdatedAt).toISOString()
                    : null,
            }}
        />
    );
};

export default TerminalResearchWirePage;
