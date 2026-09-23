import nodemailer from "nodemailer";
import { digestEmail } from "./digest";

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
  /** Skip TLS cert-hostname validation — needed when connecting to a cPanel mail server by IP. */
  insecureTls: boolean;
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
    insecureTls: process.env.SYSTEM_SMTP_INSECURE_TLS === "true",
  };
}

function transportOptions(cfg: SystemSmtp) {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
    ...(cfg.insecureTls ? { tls: { rejectUnauthorized: false } } : {}),
  };
}

export function isSystemMailerConfigured(): boolean {
  return getSystemSmtp() !== null;
}

/** Public base URL of this instance (APP_URL env), no trailing slash. */
export function appUrl(): string {
  return (process.env.APP_URL || "").replace(/\/$/, "");
}

async function sendSystemMail(opts: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<boolean> {
  const cfg = getSystemSmtp();
  if (!cfg) {
    console.log(`[system-mailer] not configured — skipped "${opts.subject}" to ${opts.to}`);
    return false;
  }
  const transporter = nodemailer.createTransport(transportOptions(cfg));
  await transporter.sendMail({
    from: `"${cfg.fromName}" <${cfg.fromEmail}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
  });
  return true;
}

/** Verifies the system SMTP connection/credentials without sending. */
export async function verifySystemMailer(): Promise<{ ok: boolean; error?: string }> {
  const cfg = getSystemSmtp();
  if (!cfg) return { ok: false, error: "System mailer is not configured" };
  try {
    const transporter = nodemailer.createTransport(transportOptions(cfg));
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

const FOOT_HTML = (why: string) =>
  `<p style="color:#a1a1aa;font-size:12px;line-height:1.6;margin-top:24px;border-top:1px solid #eee;padding-top:16px;">${why}</p>`;

const BUTTON_HTML = (href: string, label: string) =>
  `<div style="margin:24px 0;"><a href="${href}" style="background:#18181b;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:8px;display:inline-block;">${label}</a></div>`;

/** Email-verification email (signup + resend). Fire-and-forget safe. */
export async function sendVerificationEmail(
  to: string,
  name: string,
  verifyUrl: string
): Promise<void> {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const text = `Hi ${first},

Confirm your email address to unlock sending with Outreach Studio.

Open this link:
${verifyUrl}

The link is valid for 48 hours. If you didn't create an account, you can ignore this email.

The Outreach Studio team`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#18181b;">
  <div style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin-bottom:4px;">Confirm your email</div>
  <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi ${first}, click the button below to verify this address and unlock sending.</p>
  ${BUTTON_HTML(verifyUrl, "Verify my email")}
  <p style="color:#71717a;font-size:12px;line-height:1.6;margin:0;">Or paste this link into your browser:<br/><span style="word-break:break-all;color:#2563eb;">${verifyUrl}</span></p>
  ${FOOT_HTML("The link is valid for 48 hours. If you didn't create an account at Outreach Studio, you can safely ignore this email.")}
</div>`;

  try {
    await sendSystemMail({ to, subject: "Confirm your email — Outreach Studio", text, html });
    console.log(`[system-mailer] verification email sent to ${to}`);
  } catch (err) {
    console.error(`[system-mailer] verification email to ${to} failed:`, err);
  }
}

/** Password-reset email. Fire-and-forget safe. */
export async function sendPasswordResetEmail(
  to: string,
  name: string,
  resetUrl: string
): Promise<void> {
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  const text = `Hi ${first},

Someone requested a password reset for your Outreach Studio account.

Reset your password here (valid for 60 minutes):
${resetUrl}

If this wasn't you, ignore this email — your password stays unchanged.

The Outreach Studio team`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#18181b;">
  <div style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin-bottom:4px;">Reset your password</div>
  <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0 0 8px;">Hi ${first}, click the button below to choose a new password. The link is valid for 60 minutes.</p>
  ${BUTTON_HTML(resetUrl, "Choose a new password")}
  <p style="color:#71717a;font-size:12px;line-height:1.6;margin:0;">Or paste this link into your browser:<br/><span style="word-break:break-all;color:#2563eb;">${resetUrl}</span></p>
  ${FOOT_HTML("If you didn't request this, you can safely ignore this email — your password stays unchanged.")}
</div>`;

  try {
    await sendSystemMail({ to, subject: "Reset your password — Outreach Studio", text, html });
    console.log(`[system-mailer] password-reset email sent to ${to}`);
  } catch (err) {
    console.error(`[system-mailer] password-reset email to ${to} failed:`, err);
  }
}

/** Welcome email on signup. Fire-and-forget — never blocks the request. */
export async function sendWelcomeEmail(to: string, name: string, verifyUrl?: string): Promise<void> {
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
${
  verifyUrl
    ? `
First, confirm your email address (valid for 48 hours):
${verifyUrl}
`
    : ""
}
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
    verifyUrl
      ? `${BUTTON_HTML(verifyUrl, "Verify my email")}<p style="color:#71717a;font-size:12px;line-height:1.6;margin:-12px 0 16px;">Confirming your address unlocks real sending and free AI writing. Or paste this link:<br/><span style="word-break:break-all;color:#2563eb;">${verifyUrl}</span></p>`
      : url
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

/** Everything from the register is third-party text, so it gets escaped, not trusted. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Company-incorporation dates arrive as YYYY-MM-DD; a reader wants "12 Sep 2026". */
function readableDate(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The weekly "new businesses in your niches" digest.
 *
 * Deliberately one message per account covering every watch that produced
 * something, and nothing at all when nothing did. A weekly "no news" email is
 * the fastest way to teach someone to ignore the one that matters.
 *
 * Answers whether it actually went. A deployment with no system mailer logs and
 * moves on, and a caller that counted that as "sent" would report a digest
 * delivered to someone who is about to wonder why they got nothing.
 */
export async function sendDigestEmail(
  to: string,
  name: string,
  watches: {
    niche: string;
    location: string;
    companies: { business_name: string; company_number: string; incorporated_on: string }[];
  }[],
  total: number
): Promise<boolean> {
  const url = appUrl();
  const first = (name || "").trim().split(/\s+/)[0] || "there";
  // With no APP_URL there is no link to give: a button whose href is the words
  // "your saved searches" is a broken link in every client. Say it in words
  // instead, so the email sends a reader to the right place rather than nowhere.
  const digestUrl = url ? `${url}/watches` : "";
  const link = digestUrl || "your saved searches";

  // The subject and the plain-text body come from lib/digest.ts, where the
  // wording is unit-tested and the module has no dependencies. Only the HTML
  // below is built here.
  const { subject, text } = digestEmail({ name: first, watches, total, url: link });

  const htmlSections = watches
    .map((w) => {
      const rows = w.companies
        .map(
          (c) => `<tr><td style="padding:7px 0;border-top:1px solid #f1f1f4;font-size:13px;color:#3f3f46;">
            <b style="color:#18181b;">${esc(c.business_name)}</b>${
              c.company_number
                ? `<span style="color:#a1a1aa;"> · ${esc(c.company_number)}</span>`
                : ""
            }${
              c.incorporated_on
                ? `<div style="color:#71717a;font-size:12px;">incorporated ${esc(readableDate(c.incorporated_on))}</div>`
                : ""
            }
          </td></tr>`
        )
        .join("");
      return `<div style="font-size:13px;font-weight:600;color:#18181b;margin:20px 0 4px;">${esc(
        w.niche
      )} in ${esc(w.location)} <span style="color:#a1a1aa;font-weight:400;">— ${
        w.companies.length
      } new</span></div><table style="width:100%;border-collapse:collapse;">${rows}</table>`;
    })
    .join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:540px;margin:0 auto;color:#18181b;">
  <div style="font-size:20px;font-weight:600;letter-spacing:-0.01em;margin-bottom:4px;">${total} new ${
    total === 1 ? "business" : "businesses"
  } in your niches</div>
  <p style="color:#52525b;font-size:14px;line-height:1.6;margin:0;">Hi ${esc(
    first
  )}, these companies were incorporated in the areas you're watching.</p>
  ${htmlSections}
  ${
    digestUrl
      ? BUTTON_HTML(digestUrl, "Open your new leads")
      : `<p style="color:#52525b;font-size:14px;line-height:1.6;">Open <b>New businesses</b> in the app to work these.</p>`
  }
  ${FOOT_HTML(
    "Newly incorporated businesses have no incumbent working with them yet. You're receiving this because you set up saved searches — removing a search stops it being covered here."
  )}
</div>`;

  try {
    const sent = await sendSystemMail({ to, subject, text, html });
    if (sent) console.log(`[system-mailer] digest email sent to ${to}`);
    return sent;
  } catch (err) {
    console.error(`[system-mailer] digest email to ${to} failed:`, err);
    return false;
  }
}
