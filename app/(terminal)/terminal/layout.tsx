import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import TerminalShellClient from '@/components/terminal/TerminalShellClient';

const TerminalLayout = async ({ children }: { children: React.ReactNode }) => {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) redirect('/sign-in');

    return <TerminalShellClient>{children}</TerminalShellClient>;
};

export default TerminalLayout;
