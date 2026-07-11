import { NextRequest, NextResponse } from "next/server";
import { startPasswordReset } from "@/lib/auth";
import {
  appUrl,
  isSystemMailerConfigured,
  sendPasswordResetEmail,
} from "@/lib/system-mailer";
import { rateLimitDb, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Request a password reset link. Responds identically whether or not the
 * email belongs to an account, so addresses can't be enumerated.
 */
export async function POST(req: NextRequest) {
  if (!(await rateLimitDb(`forgot:${clientIp(req)}`, 5, 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: "Too many reset requests — try again later" },
      { status: 429 }
    );
  }

  if (!isSystemMailerConfigured() || !appUrl()) {
    return NextResponse.json(
      { error: "Password reset isn't available on this instance — contact the administrator" },
      { status: 503 }
    );
  }

  const { email } = (await req.json()) as { email?: string };
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  // Per-address limit so a known victim's inbox can't be flooded.
  const addr = email.trim().toLowerCase();
  if (await rateLimitDb(`forgot-email:${addr}`, 3, 60 * 60 * 1000)) {
    const reset = await startPasswordReset(addr);
    if (reset) {
      const url = `${appUrl()}/reset-password?token=${reset.token}`;
      void sendPasswordResetEmail(addr, reset.name, url);
    }
  }

  return NextResponse.json({
    ok: true,
    message: "If an account exists for that address, a reset link is on its way.",
  });
}
