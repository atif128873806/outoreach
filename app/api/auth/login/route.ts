import { NextRequest, NextResponse } from "next/server";
import { verifyLogin } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/crypto";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!rateLimit(`login:${clientIp(req)}`, 5, 15 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many attempts — try again in 15 minutes" },
      { status: 429 }
    );
  }

  const { email, password } = (await req.json()) as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const userId = await verifyLogin(email, password);
  if (userId == null) {
    return NextResponse.json({ error: "Wrong email or password" }, { status: 401 });
  }

  const session = createSessionToken(userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
  return res;
}
