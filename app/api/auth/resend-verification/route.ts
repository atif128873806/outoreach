import { NextResponse } from "next/server";
import { getUserId, getUser, startEmailVerification, isVerificationEnforced } from "@/lib/auth";
import { appUrl, sendVerificationEmail } from "@/lib/system-mailer";
import { rateLimitDb } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Re-sends the verification email to the signed-in user. */
export async function POST() {
  const uid = await getUserId();
  if (uid == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isVerificationEnforced() || !appUrl()) {
    return NextResponse.json({ error: "Verification isn't required on this instance" }, { status: 400 });
  }

  const user = await getUser(uid);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.email_verified) return NextResponse.json({ ok: true, alreadyVerified: true });

  if (!(await rateLimitDb(`resend-verify:${uid}`, 3, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Verification email already sent — check your inbox (and spam folder)" },
      { status: 429 }
    );
  }

  const token = await startEmailVerification(uid);
  void sendVerificationEmail(user.email, user.name, `${appUrl()}/api/auth/verify-email?token=${token}`);
  return NextResponse.json({ ok: true });
}
