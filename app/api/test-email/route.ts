import { NextRequest, NextResponse } from "next/server";
import { sendMail } from "@/lib/mailer";
import { getSettings, isSmtpConfigured } from "@/lib/settings";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // Optional subject/body let the campaign form send a generated preview to
  // the user's own inbox; without them this is a plain SMTP test.
  const { to, subject, body } = (await req.json()) as {
    to?: string;
    subject?: string;
    body?: string;
  };

  const settings = getSettings();
  const recipient = to?.trim() || settings.from_email;
  if (!recipient) {
    return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
  }

  if (!isSmtpConfigured(settings)) {
    return NextResponse.json(
      { error: "SMTP is not configured — fill in SMTP host and From email first" },
      { status: 400 }
    );
  }

  try {
    await sendMail({
      to: recipient,
      subject: subject?.trim() || "Outreach dashboard — SMTP test",
      body:
        body?.trim() ||
        "This is a test email from your outreach automation dashboard.\n\nIf you're reading this, your SMTP settings work.",
      settings,
    });
    return NextResponse.json({ ok: true, to: recipient });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Send failed" },
      { status: 500 }
    );
  }
}
