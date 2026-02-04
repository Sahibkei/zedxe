import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { searchStocks } from "@/lib/actions/finnhub.actions";
import FinTerminalShell from "@/src/components/layout/FinTerminalShell";

const Layout = async ({ children }: { children : React.ReactNode }) => {
    const session = await auth.api.getSession({ headers: await headers() });

    if(!session?.user) redirect('/sign-in');

    const user = {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
    }
    const initialStocks = await searchStocks();

    return (
        <FinTerminalShell user={user} initialStocks={initialStocks}>
            {children}
        </FinTerminalShell>
    )
}
export default Layout
