import { redirect } from "next/navigation";

const SignUpCatchAllPage = () => {
    redirect("/waitlist?from=signup");
};

export default SignUpCatchAllPage;
