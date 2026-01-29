import { redirect } from "next/navigation";

/** Redirect disabled sign-up pages to the waitlist. */
const SignUpPage = () => {
    redirect("/waitlist?from=signup");
};

export default SignUpPage;
