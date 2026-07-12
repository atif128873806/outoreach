import { NextRequest, NextResponse } from "next/server";
import { createUser, userCount, startEmailVerification, isVerificationEnforced } from "@/lib/auth";
import { importLegacySqlite } from "@/lib/legacy-import";
import { appUrl, sendWelcomeEmail, sendVerificationEmail } from "@/lib/system-mailer";
import { createSessionToken, SESSION_COOKIE, SESSION_COOKIE_OPTIONS } from "@/lib/crypto";
import { rateLimitDb, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Per-IP cap. Kept generous because many legitimate users share one public IP
  // (mobile/CGNAT networks); email verification is the real abuse control.
  if (!(await rateLimitDb(`signup:${clientIp(req)}`, 20, 60 * 60 * 1000))) {
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

  // When verification is enforced, signup sends ONLY the short verification
  // email (a first-contact marketing email is more likely to hit spam and can
  // bury the link the user actually needs). The welcome email goes out after
  // they verify. Unverified instances just get the welcome email directly.
  const cleanEmail = email.trim().toLowerCase();
  if (isVerificationEnforced() && appUrl()) {
    const token = await startEmailVerification(result.id);
    void sendVerificationEmail(
      cleanEmail,
      name ?? "",
      `${appUrl()}/api/auth/verify-email?token=${token}`
    );
  } else {
    void sendWelcomeEmail(cleanEmail, name ?? "");
  }

  const session = createSessionToken(result.id);
  const res = NextResponse.json({ ok: true, imported });
  res.cookies.set(SESSION_COOKIE, session.value, {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: session.maxAge,
  });
  return res;
}
