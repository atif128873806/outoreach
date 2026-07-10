import nodemailer from "nodemailer";
import { isSmtpConfigured, type Settings } from "./settings";

export interface SendResult {
  /** "smtp" when actually delivered, "simulated" when SMTP is not configured */
  via: "smtp" | "simulated";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;

/**
 * Turn escaped plain text into HTML: URLs become links, wrapped through the
 * click tracker when a token is available.
 */
function linkify(escaped: string, base: string, token?: string): string {
  return escaped.replace(URL_RE, (url) => {
    const href =
      token && base
        ? `${base}/api/t/c/${token}?u=${encodeURIComponent(url)}`
        : url;
    return `<a href="${href}" style="color:#2563eb;">${url}</a>`;
  });
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  body: string;
  unsubToken?: string;
  /** enables open-pixel + click tracking for this email */
  trackToken?: string;
  settings: Settings;
}): Promise<SendResult> {
  const s = opts.settings;
  const base = s.base_url ? s.base_url.replace(/\/$/, "") : "";

  const unsubUrl =
    opts.unsubToken && base
      ? `${base}/api/unsubscribe?token=${opts.unsubToken}`
      : "";

  const text = unsubUrl
    ? `${opts.body}\n\n---\nTo stop receiving these emails, visit: ${unsubUrl}`
    : opts.body;

  const track = base && opts.trackToken ? opts.trackToken : undefined;
  const htmlBody = linkify(escapeHtml(opts.body), base, track);
  const pixel = track
    ? `<img src="${base}/api/t/o/${track}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
    : "";

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222;white-space:pre-wrap;">${htmlBody}</div>${
    unsubUrl
      ? `<p style="font-size:11px;color:#999;margin-top:24px;">Don't want these emails? <a href="${unsubUrl}" style="color:#999;">Unsubscribe</a>.</p>`
      : ""
  }${pixel}`;

  if (!isSmtpConfigured(s)) {
    // Simulation mode: the campaign pipeline runs end to end without a mail
    // server, so everything can be tested safely before going live.
    console.log(
      `[mailer] SIMULATED send → ${opts.to} | subject: ${opts.subject}`
    );
    return { via: "simulated" };
  }

  const port = parseInt(s.smtp_port || "587", 10);
  const transporter = nodemailer.createTransport({
    host: s.smtp_host,
    port,
    secure: s.smtp_secure === "true" || port === 465,
    auth: s.smtp_user ? { user: s.smtp_user, pass: s.smtp_pass } : undefined,
    // A hung SMTP connection must not stall the whole campaign runner.
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  await transporter.sendMail({
    from: s.from_name ? `"${s.from_name}" <${s.from_email}>` : s.from_email,
    to: opts.to,
    subject: opts.subject,
    text,
    html,
    ...(unsubUrl
      ? { list: { unsubscribe: { url: unsubUrl, comment: "Unsubscribe" } } }
      : {}),
  });

  return { via: "smtp" };
}
