import { NextResponse, type NextRequest } from "next/server";
import fs from "fs";
import { verifySessionToken, SESSION_COOKIE, AUTH_FLAG_FILE } from "./lib/crypto";

/**
 * Login protection. Active only when an app password is set in Settings —
 * the flag file (kept in sync with the DB) tells us without a DB round-trip.
 *
 * Recipient-facing endpoints stay public: tracking pixel/click redirects and
 * the unsubscribe page must work for people who receive the emails.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/api/auth/",
  "/api/t/",
  "/api/unsubscribe",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!fs.existsSync(AUTH_FLAG_FILE)) return NextResponse.next(); // auth not enabled

  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  if (pathname !== "/") login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except static assets and files served from /public
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)", "/api/:path*"],
};
