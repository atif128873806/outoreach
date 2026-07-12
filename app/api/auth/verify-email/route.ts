import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken, getUser } from "@/lib/auth";
import { appUrl, sendWelcomeEmail } from "@/lib/system-mailer";
import { rateLimitDb, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Landing point of the emailed verification link. Redirects into the app.
 *
 * The redirect base MUST be APP_URL, not req.url — behind the reverse proxy
 * the standalone server reconstructs req.url from its bind address
 * (0.0.0.0:3000), which would send the user's browser to a dead URL.
 */
export async function GET(req: NextRequest) {
  if (!(await rateLimitDb(`verify:${clientIp(req)}`, 20, 60 * 60 * 1000))) {
    return NextResponse.json({ error: "Too many attempts — try again later" }, { status: 429 });
  }

  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = await verifyEmailToken(token);

  // Verified accounts get the welcome/getting-started email now — signup only
  // sends the focused verification email (cleaner inbox placement).
  if (userId != null) {
    const user = await getUser(userId);
    if (user) void sendWelcomeEmail(user.email, user.name);
  }

  const dest = new URL(userId ? "/dashboard" : "/login", appUrl() || req.url);
  dest.searchParams.set("verified", userId ? "1" : "0");
  return NextResponse.redirect(dest);
}
