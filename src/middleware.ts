import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/jwt";

/**
 * Route guard. Runs in the Edge runtime, so it only uses `jose` (no bcrypt /
 * DB). Verifies the session JWT and enforces role-based access:
 *   /admin/*  -> admin only
 *   /seller/* -> seller only
 * Unauthenticated users hitting a protected route are redirected to /login.
 * Authenticated users hitting /login are bounced to their home panel.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySession(token);

  const isAdminRoute = pathname.startsWith("/admin");
  const isSellerRoute = pathname.startsWith("/seller");
  const isLogin = pathname === "/login";

  // Already logged in -> keep them out of /login.
  if (isLogin && session) {
    return NextResponse.redirect(new URL(homeFor(session.role), req.url));
  }

  if (isAdminRoute || isSellerRoute) {
    if (!session) {
      const url = new URL("/login", req.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    if (isAdminRoute && session.role !== "admin") {
      return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    }
    if (isSellerRoute && session.role !== "seller") {
      return NextResponse.redirect(new URL(homeFor(session.role), req.url));
    }
  }

  return NextResponse.next();
}

function homeFor(role: "admin" | "seller"): string {
  return role === "admin" ? "/admin" : "/seller";
}

export const config = {
  matcher: ["/admin/:path*", "/seller/:path*", "/login"],
};
