import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);
    const { pathname } = request.nextUrl;

    const publicRoutes = ["/", "/sign-in", "/sign-up"];
    const isPublicRoute =
        pathname === "/" ||
        publicRoutes.some((route) => route !== "/" && (pathname === route || pathname.startsWith(`${route}/`)));

    if (sessionCookie && pathname === "/") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (isPublicRoute) {
        return NextResponse.next();
    }

    if (!sessionCookie) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|assets).*)',
    ],
};
