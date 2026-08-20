import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Route constants
// ─────────────────────────────────────────────────────────────────────────────
const ROUTES = {
    login: "/login",
    register: "/register",
    verifyOtp: "/verifyotp",
    studentHome: "/dashboard",
    instructorHome: "/instructor",
    // Standalone notice — deliberately NOT under /instructor or /dashboard, so it renders
    // without a role shell and never re-enters the protected-route guard (no redirect loop).
    adminNotice: "/admin-unavailable",
    // Shared full-screen course-player, allow-listed for instructors (owned-content preview).
    coursePlayer: "/dashboard/learn",
} as const;

const PUBLIC_ROUTES = [ROUTES.login, ROUTES.register];
const PROTECTED_PREFIXES = [ROUTES.studentHome, ROUTES.instructorHome];

type RoutingRole = "student" | "instructor" | "admin";

// ─────────────────────────────────────────────────────────────────────────────
// Request context — everything the flows below need, read once.
// ─────────────────────────────────────────────────────────────────────────────
interface GuardContext {
    path: string;
    isAuthenticated: boolean;
    role: RoutingRole;
    pendingEmail?: string;
    fgEmail?: string;
    passwordResetToken?: string;
}

function buildContext(req: NextRequest): GuardContext {
    const cookie = (name: string) => req.cookies.get(name)?.value;

    const { pathname } = req.nextUrl;
    const path = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

    const roleCookie = cookie("role");
    // Non-sensitive routing hint; unknown/missing => least-privilege "student".
    const role: RoutingRole =
        roleCookie === "instructor" || roleCookie === "admin" ? roleCookie : "student";

    return {
        path,
        isAuthenticated: !!cookie("access_token") || !!cookie("refresh_token"),
        role,
        pendingEmail: cookie("pending_email"),
        fgEmail: cookie("FG_email"),
        passwordResetToken: cookie("password_reset_token"),
    };
}

// The home each role lands on after auth.
function roleHome(role: RoutingRole): string {
    if (role === "instructor") return ROUTES.instructorHome;
    if (role === "admin") return ROUTES.adminNotice;
    return ROUTES.studentHome;
}

// ─────────────────────────────────────────────────────────────────────────────
// Flows — each returns a redirect target, or null to fall through to the next.
// Evaluated in order by `middleware`.
// ─────────────────────────────────────────────────────────────────────────────

// Forget-password wizard: keep the user on the correct step for their cookies.
function forgetPasswordFlow({ path, isAuthenticated, fgEmail, passwordResetToken }: GuardContext): string | null {
    if (path === "/forget-password" && isAuthenticated) return ROUTES.studentHome;
    if (path === "/forget-password/verify" && !fgEmail && !passwordResetToken) return "/forget-password";
    if (path === "/forget-password/verify" && passwordResetToken) return "/forget-password/reset";
    if (path === "/forget-password/reset" && !passwordResetToken && !fgEmail) return "/forget-password";
    if (path === "/forget-password/reset" && fgEmail) return "/forget-password/verify";
    return null;
}

// Google set-password wizard: requires auth, then keeps the user on the correct step.
function googleSetPasswordFlow({ path, isAuthenticated, passwordResetToken }: GuardContext): string | null {
    if (path.startsWith("/google-set-password") && !isAuthenticated) return ROUTES.login;
    if (path === "/google-set-password" && passwordResetToken) return "/google-set-password/reset";
    if (path === "/google-set-password/verify" && passwordResetToken) return "/google-set-password/reset";
    if (path === "/google-set-password/reset" && !passwordResetToken) return "/google-set-password";
    return null;
}

// Public pages (login/register): an authenticated user is sent to their role home.
function publicRouteFlow({ path, isAuthenticated, role }: GuardContext): string | null {
    if (isAuthenticated && PUBLIC_ROUTES.includes(path)) return roleHome(role);
    return null;
}

// Verify-OTP page: needs a pending email (or falls back by auth state).
function verifyOtpFlow({ path, isAuthenticated, pendingEmail }: GuardContext): string | null {
    if (path !== ROUTES.verifyOtp || pendingEmail) return null;
    return isAuthenticated ? ROUTES.studentHome : ROUTES.register;
}

// Protected areas (/dashboard, /instructor): auth gate + role-aware guard.
// The backend remains the security boundary; this only routes the UI.
function protectedRouteFlow({ path, isAuthenticated, role }: GuardContext): string | null {
    const isProtected = PROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix));
    if (!isProtected) return null;

    if (!isAuthenticated) return ROUTES.login;

    if (role === "admin") {
        // Admins never see a role shell — everything routes to the notice (except itself).
        return path === ROUTES.adminNotice ? null : ROUTES.adminNotice;
    }

    if (role === "instructor") {
        // Instructors are kept out of the student surface, except the shared course-player.
        const onStudentSurface = path.startsWith(ROUTES.studentHome) && !path.startsWith(ROUTES.coursePlayer);
        return onStudentSurface ? ROUTES.instructorHome : null;
    }

    // Students (and unknown roles) may not enter the instructor surface.
    return path.startsWith(ROUTES.instructorHome) ? ROUTES.studentHome : null;
}

const FLOWS = [
    forgetPasswordFlow,
    googleSetPasswordFlow,
    publicRouteFlow,
    verifyOtpFlow,
    protectedRouteFlow,
];

// ─────────────────────────────────────────────────────────────────────────────
// Middleware entry point
// ─────────────────────────────────────────────────────────────────────────────
export default function proxy(req: NextRequest) {
    const ctx = buildContext(req);

    for (const flow of FLOWS) {
        const target = flow(ctx);
        if (target && target !== ctx.path) {
            return NextResponse.redirect(new URL(target, req.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};