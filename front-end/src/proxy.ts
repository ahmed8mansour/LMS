import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register"];
const PROTECTED_ROUTES = ["/dashboard"];

export default function middleware(req: NextRequest) {

    const accessToken = req.cookies.get("access_token")?.value;
    const refreshToken = req.cookies.get("refresh_token")?.value;

    const pendingEmail = req.cookies.get("pending_email")?.value;
    const Fg_email = req.cookies.get("FG_email")?.value;
    const password_reset_token = req.cookies.get("password_reset_token")?.value;

    const { pathname } = req.nextUrl;

    const isAuthenticated = !!accessToken || !!refreshToken;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

    const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
        pathname.startsWith(route)
    );

    // ============================================
    // Forget Password Flow
    // ============================================
    if (pathname === "/forget-password" && isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (pathname === "/forget-password/verify" && !Fg_email && !password_reset_token) {
        return NextResponse.redirect(new URL("/forget-password", req.url));
    }

    if (pathname === "/forget-password/verify" && password_reset_token) {
        return NextResponse.redirect(new URL("/forget-password/reset", req.url));
    }

    if (pathname === "/forget-password/reset" && !password_reset_token && !Fg_email) {
        return NextResponse.redirect(new URL("/forget-password", req.url));
    }

    if (pathname === "/forget-password/reset" && Fg_email) {
        return NextResponse.redirect(new URL("/forget-password/verify", req.url));
    }

    // ============================================
    // Public Routes (login / register)
    // ============================================

    if (isAuthenticated && isPublicRoute) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // ============================================
    // Verify OTP Flow
    // ============================================

    if (pathname === "/verifyotp" && !pendingEmail && !isAuthenticated) {
        return NextResponse.redirect(new URL("/register", req.url));
    }

    if (pathname === "/verifyotp" && !pendingEmail && isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // ============================================
    // Protected Routes
    // ============================================

    if (isProtectedRoute && !isAuthenticated) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};