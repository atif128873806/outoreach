import { NextRequest, NextResponse } from "next/server";
import { resetPasswordWithToken } from "@/lib/auth";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/crypto";
import { rateLimitDb, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Complete a password reset: { token, password }. Signs the user in on success. */
export async function POST(req: NextRequest) {
  if (!(await rateLimitDb(`reset:${clientIp(req)}`, 10, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many attempts — try again later" },
      { status: 429 }
    );
  }

  const { token, password } = (await req.json()) as { token?: string; password?: string };
  if (!token || !password) {
    return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
  }

  const result = await resetPasswordWithToken(token, password);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const session = createSessionToken(result.userId);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, session.value, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
  return res;
}
