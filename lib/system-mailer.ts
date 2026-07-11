import nodemailer from "nodemailer";

/**
 * System (transactional) mailer — sends product emails like the welcome
 * message from the company mailbox. This is separate from each user's own
 * campaign SMTP; it's configured once per instance via SYSTEM_SMTP_* env vars.
 *
 * If it isn't configured, calls no-op quietly (signup must never fail because
 * a welcome email couldn't be sent).
 */

interface SystemSmtp {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

export function getSystemSmtp(): SystemSmtp | null {
  const host = process.env.SYSTEM_SMTP_HOST?.trim();
  const user = process.env.SYSTEM_SMTP_USER?.trim();
  const pass = process.env.SYSTEM_SMTP_PASS;
  if (!host || !user || !pass) return null;
  const port = parseInt(process.env.SYSTEM_SMTP_PORT || "465", 10);
  return {
    host,
    port,
    secure: process.env.SYSTEM_SMTP_SECURE === "true" || port === 465,
    user,
    pass,
    fromEmail: process.env.SYSTEM_FROM_EMAIL?.trim() || user,
    fromName: process.env.SYSTEM_FROM_NAME?.trim() || "Outreach Studio",
  };
}

export function isSystemMailerConfigured(): boolean {
  return getSystemSmtp() !== null;
}

function appUrl(): string {
  return (process.env.APP_URL || "").replace(/\/$/, "");
}

async function sendSystemMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const cfg = getSystemSmtp();
  if (!cfg) {
    console.log(`[system-mailer] not configured — skipped "${opts.subject}" to ${opts.to}`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
}

/** Verifies the system SMTP connection/credentials without sending. */
export async function verifySystemMailer(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getSystemSmtp();
  if (!cfg) return { ok: false, error: "System mailer is not configured" };
  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
      connectionTimeout: 15_000,
    });
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Welcome email on signup. Fire-and-forget — never blocks the request. */
export async function sendWelcomeEmail(to: string, name: string): Promise<void> {
  const url = appUrl();
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const dash = url ? `${url}/dashboard` : "your dashboard";

  const text = `Hi ${first},

Welcome to Outreach Studio — your account is ready.

Here's how to get your first campaign out the door:

1. Find leads — search a niche and city, and get businesses with emails, socials, and company intel included.
2. Connect your mailbox — add your SMTP under Settings so campaigns send from your own address. Until then, sends are simulated so you can test safely.
3. Write & schedule — describe your offer once; the AI writes a personal message for every contact, then tracks opens, clicks, and replies.

AI writing is included free — no API key required to get started.

${url ? `Open your dashboard: ${dash}` : ""}

Happy sending,
The Outreach Studio team`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#18181b;">
  <div style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin-bottom:4px;">Welcome to Outreach Studio</div>
  <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 20px;">Hi ${first}, your account is ready. Here's how to get your first campaign out the door.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#3f3f46;">
    <tr><td style="padding:10px 0;border-top:1px solid #eee;"><b>1. Find leads</b> — search a niche and city; get businesses with emails, socials, and company intel included.</td></tr>
    <tr><td style="padding:10px 0;border-top:1px solid #eee;"><b>2. Connect your mailbox</b> — add SMTP in Settings to send from your own address. Until then, sends are simulated so you can test safely.</td></tr>
    <tr><td style="padding:10px 0;border-top:1px solid #eee;"><b>3. Write &amp; schedule</b> — describe your offer once; the AI writes a personal message per contact and tracks opens, clicks, and replies.</td></tr>
  </table>
  <p style="color:#16a34a;font-size:13px;margin:16px 0 0;">✓ AI writing is included free — no API key required to get started.</p>
  ${
    url
      ? `<div style="margin:24px 0;"><a href="${dash}" style="background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;display:inline-block;">Open your dashboard</a></div>`
      : ""
  }
  <p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">You're receiving this because an account was created with this email at Outreach Studio.</p>
</div>`;

  try {
    await sendSystemMail({ to, subject: "Welcome to Outreach Studio 👋", text, html });
    console.log(`[system-mailer] welcome email sent to ${to}`);
  } catch (err) {
    console.error(`[system-mailer] welcome email to ${to} failed:`, err);
  }
}
