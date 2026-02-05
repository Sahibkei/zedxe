import TopNav from "@/components/layout/TopNav";
import {auth} from "@/lib/better-auth/auth";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {searchStocks} from "@/lib/actions/finnhub.actions";

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
        <main className="min-h-screen bg-[#010409] text-slate-200">
            <TopNav user={user} initialStocks={initialStocks} />
            <div className="container pb-10 pt-24">
                {children}
            </div>
        </main>
    )
}
export default Layout
