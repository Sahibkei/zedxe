import { auth } from "@/lib/better-auth/auth";
import { headers } from "next/headers";
import NavbarClient from "@/app/(marketing)/components/NavbarClient";

const Navbar = async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    const isSignedIn = Boolean(session?.user);

    return <NavbarClient isSignedIn={isSignedIn} />;
};

export default Navbar;
