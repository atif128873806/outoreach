import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "./lib/crypto";
import { getAppLandingPath, isOutreachBlocked } from "./lib/product";

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
