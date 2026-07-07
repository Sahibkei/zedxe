import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import TerminalResearchWireClient from '@/components/terminal/TerminalResearchWireClient';
import { auth } from '@/lib/better-auth/auth';
import { connectToDatabase } from '@/database/mongoose';
import { findUserBySessionId } from '@/lib/research-wire/users';

const TerminalResearchWirePage = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    const mongoose = await connectToDatabase();
    const db = mongoose.connection.db;
    const userDocument = db
        ? await findUserBySessionId<{ username?: string | null; bio?: string | null; usernameUpdatedAt?: Date | string | null }>(
              db,
              session.user.id,
              { username: 1, bio: 1, usernameUpdatedAt: 1 },
          )
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
