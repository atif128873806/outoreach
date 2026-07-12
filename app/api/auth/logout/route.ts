import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/crypto";
import { appUrl } from "@/lib/system-mailer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Base on APP_URL, not req.url — behind the proxy req.url is the bind address.
  const res = NextResponse.redirect(new URL("/login", appUrl() || req.url));
  res.cookies.set(SESSION_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
