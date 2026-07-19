import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getUserId } from "@/lib/auth";
import { getSettings, SECRET_MASK } from "@/lib/settings";
import { friendlyMailboxError } from "@/lib/mail-host";
import { rateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";

/**
 * Live SMTP credential check — logs in to the mail server (no email is sent)
 * so the user knows their password works BEFORE anything depends on it.
 * Rate-limited: repeated failed logins can trip providers' account security.
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (userId == null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!rateLimit(`verify-smtp:${userId}`, 6, 60_000)) {
    return NextResponse.json(
      { error: "Too many attempts — wait a minute (providers may lock accounts on repeated failed logins)" },
      { status: 429 }
    );
  }

  const body = (await req.json()) as {
    host?: string;
    port?: string;
    secure?: string;
    user?: string;
    pass?: string;
  };

  const host = body.host?.trim();
  const user = body.user?.trim();
  let pass = body.pass ?? "";
  if (!host || !user || !pass) {
    return NextResponse.json(
      { error: "Fill in SMTP host, username, and password first" },
      { status: 400 }
    );
  }
  // The form shows a mask for an already-saved password — verify the stored one.
  if (pass === SECRET_MASK) {
    pass = (await getSettings(userId)).smtp_pass;
    if (!pass) return NextResponse.json({ error: "No saved password — enter it first" }, { status: 400 });
  }

  const port = parseInt(body.port || "465", 10);
  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: body.secure === "true" || port === 465,
      auth: { user, pass },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 15_000,
    });
    await transporter.verify();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: await friendlyMailboxError(err, host) }, { status: 400 });
  }
}
