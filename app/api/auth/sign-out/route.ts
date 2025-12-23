import { auth } from "@/lib/better-auth/auth";

export const POST = async (request: Request) => auth.api.signOut({ headers: request.headers });
