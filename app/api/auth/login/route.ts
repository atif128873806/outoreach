import { NextRequest, NextResponse } from "next/server";
import { getAppPasswordHash, isAuthEnabled } from "@/lib/settings";
import { createSessionToken, verifyPassword, SESSION_COOKIE } from "@/lib/crypto";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req)}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in 15 minutes" },
      { status: 429 }
    );
  }

  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "No app password is set" }, { status: 400 });
  }

  const { password } = (await req.json()) as { password?: string };
  if (!password || !verifyPassword(password, getAppPasswordHash())) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }

  const session = createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.maxAge,
  });
  return res;
}
