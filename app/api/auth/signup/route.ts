import { NextRequest, NextResponse } from "next/server";
import { createUser, userCount } from "@/lib/auth";
import { importLegacySqlite } from "@/lib/legacy-import";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/crypto";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!rateLimit(`signup:${clientIp(req)}`, 5, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many signups from this address — try again later" },
      { status: 429 }
    );
  }

  // Self-hosters can close registration once their accounts exist.
  if (process.env.SIGNUPS_DISABLED === "true") {
    return NextResponse.json(
      { error: "Sign-ups are currently disabled on this instance" },
      { status: 403 }
    );
  }

  const { email, name, password } = (await req.json()) as {
    email?: string;
    name?: string;
    password?: string;
  };
  if (!email?.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const wasEmpty = (await userCount()) === 0;
  const result = await createUser(email, name ?? "", password);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // First account on a machine that ran the single-user version: adopt its data.
  let imported: string | null = null;
  if (wasEmpty) {
    imported = await importLegacySqlite(result.id);
  }

  const session = createSessionToken(result.id);
  const res = NextResponse.json({ ok: true, imported });
  res.cookies.set(SESSION_COOKIE, session.value, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
  return res;
}
