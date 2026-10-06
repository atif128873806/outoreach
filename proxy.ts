import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./lib/crypto";
import { ADMIN_COOKIE } from "./lib/admin-session";
import { getAppLandingPath, isNewBusinessesBlocked, isOutreachBlocked } from "./lib/product";

/**
 * Session gate. Every page and API requires a signed-in user, except:
 *  - the auth pages/endpoints themselves
 *  - recipient-facing endpoints (tracking pixel/click, unsubscribe) — those
 *    must work for the people who receive the emails
 *  - the health check
 *
 * Session cookies are stateless HMAC tokens, so no database is touched here.
 */

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/features",
  "/demo",
  "/docs",
  "/guides",
  "/tools",
  "/api/tools/",
  "/pricing",
  "/terms",
  "/privacy",
  "/refund-policy",
  "/contact",
  "/api/auth/",
  "/api/t/",
  "/api/unsubscribe",
  "/api/health",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login" || pathname === "/api/admin/auth/login" || pathname === "/api/admin/auth/logout") return NextResponse.next();
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/api/admin/")) {
    // Presence only here; every page/API verifies the revocable session + role in DB.
    if (request.cookies.get(ADMIN_COOKIE)?.value) return NextResponse.next();
    if (pathname.startsWith("/api/")) return NextResponse.json({error:"Administrator sign-in required"},{status:401});
    const login = new URL("/admin/login",request.url);
    login.searchParams.set("next",pathname+request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  const authed =
    verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value) != null;

  // Marketing landing: public for visitors; signed-in users go straight to the
  // product — which, with the outreach half hidden, is the search screen.
  if (pathname === "/") {
    return authed
      ? NextResponse.redirect(new URL(getAppLandingPath(), request.url))
      : NextResponse.next();
  }

  // Single-feature product: the outreach routes still exist and still work,
  // but nothing links to them and a typed URL lands back on the product. The
  // flag and the path list are combined in one place (see isOutreachBlocked), so
  // a route cannot be hidden in the router and left advertised in the footer.
  if (isOutreachBlocked(pathname)) {
    if (pathname.startsWith("/api/")) return NextResponse.json({error:"Feature is parked"},{status:404});
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  // "New businesses" is parked (see isNewBusinessesBlocked) — the page and its API
  // both still exist and both still work, they are just not offered. A page lands
  // on the search screen; an API path gets a 404 instead, because a redirect would
  // hand `fetch()` the search screen's HTML with a 200 on it and any caller that
  // checks `res.ok` would treat that as data.
  if (isNewBusinessesBlocked(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.redirect(new URL("/leads", request.url));
  }

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except static assets and files served from /public
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|.*\\..*).*)", "/api/:path*"],
};
