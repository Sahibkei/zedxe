import { redirect } from "next/navigation";

/** Redirect disabled sign-up catch-all routes to the waitlist. */
const SignUpCatchAllPage = () => {
    redirect("/waitlist?from=signup");
};

export default SignUpCatchAllPage;
