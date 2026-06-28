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
    const normalizedPathname = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

    const isAuthenticated = !!accessToken || !!refreshToken;

    const isPublicRoute = PUBLIC_ROUTES.includes(normalizedPathname);

    const isProtectedRoute = PROTECTED_ROUTES.some((route) =>
        normalizedPathname.startsWith(route)
    );

    // ============================================
    // Forget Password Flow
    // ============================================
    if (normalizedPathname === "/forget-password" && isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (normalizedPathname === "/forget-password/verify" && !Fg_email && !password_reset_token) {
        return NextResponse.redirect(new URL("/forget-password", req.url));
    }

    if (normalizedPathname === "/forget-password/verify" && password_reset_token) {
        return NextResponse.redirect(new URL("/forget-password/reset", req.url));
    }

    if (normalizedPathname === "/forget-password/reset" && !password_reset_token && !Fg_email) {
        return NextResponse.redirect(new URL("/forget-password", req.url));
    }

    if (normalizedPathname === "/forget-password/reset" && Fg_email) {
        return NextResponse.redirect(new URL("/forget-password/verify", req.url));
    }

    // ============================================
    // Google Set Password Flow
    // ============================================
    if (normalizedPathname.startsWith("/google-set-password") && !isAuthenticated) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    if (normalizedPathname === "/google-set-password" && password_reset_token) {
        return NextResponse.redirect(new URL("/google-set-password/reset", req.url));
    }

    if (normalizedPathname === "/google-set-password/verify" && password_reset_token) {
        return NextResponse.redirect(new URL("/google-set-password/reset", req.url));
    }

    if (normalizedPathname === "/google-set-password/reset" && !password_reset_token) {
        return NextResponse.redirect(new URL("/google-set-password", req.url));
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

    if (normalizedPathname === "/verifyotp" && !pendingEmail && !isAuthenticated) {
        return NextResponse.redirect(new URL("/register", req.url));
    }

    if (normalizedPathname === "/verifyotp" && !pendingEmail && isAuthenticated) {
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