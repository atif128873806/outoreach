/**
 * Email-provider presets + MX-based auto-detection for the SMTP wizard.
 * Pure data & logic (client-safe, unit-tested) — the server route only adds
 * the DNS MX lookup. `{domain}` in hosts is replaced with the user's domain.
 */

export interface ProviderPreset {
  id: string;
  label: string;
  smtp: { host: string; port: string; secure: "true" | "false" };
  imap: { host: string; port: string };
  appPasswordUrl?: string;
  /** Short, concrete setup steps shown inline. */
  guide: string[];
}

export const PROVIDER_PRESETS: Record<string, ProviderPreset> = {
  google: {
    id: "google",
    label: "Gmail / Google Workspace",
    smtp: { host: "smtp.gmail.com", port: "465", secure: "true" },
    imap: { host: "imap.gmail.com", port: "993" },
    appPasswordUrl: "https://myaccount.google.com/apppasswords",
    guide: [
      "Google blocks normal passwords for apps — you need an App Password (16 characters).",
      "Open the App Passwords page (button below), create one named “Outreach Studio”, and paste it as the SMTP password.",
      "If you don't see App Passwords, enable 2-Step Verification first (Google Account → Security).",
    ],
  },
  microsoft365: {
    id: "microsoft365",
    label: "Microsoft 365 / Outlook (business)",
    smtp: { host: "smtp.office365.com", port: "587", secure: "false" },
    imap: { host: "outlook.office365.com", port: "993" },
    guide: [
      "Use your full email address as the username and your normal password.",
      "If sign-in fails, your admin may need to enable “Authenticated SMTP” for the mailbox (Microsoft 365 admin → user → Mail → Manage email apps).",
    ],
  },
  "outlook-personal": {
    id: "outlook-personal",
    label: "Outlook.com / Hotmail (personal)",
    smtp: { host: "smtp-mail.outlook.com", port: "587", secure: "false" },
    imap: { host: "outlook.office365.com", port: "993" },
    appPasswordUrl: "https://account.live.com/proofs/AppPassword",
    guide: [
      "With two-step verification on, create an App Password (button below) and use it as the SMTP password.",
      "Without two-step verification, your normal password works.",
    ],
  },
  zoho: {
    id: "zoho",
    label: "Zoho Mail",
    smtp: { host: "smtp.zoho.com", port: "465", secure: "true" },
    imap: { host: "imap.zoho.com", port: "993" },
    appPasswordUrl: "https://accounts.zoho.com/home#security/app_password",
    guide: [
      "Create an App Password (button below) and use it as the SMTP password.",
      "Also enable IMAP access once: Zoho Mail → Settings → Mail Accounts → IMAP → enable.",
    ],
  },
  yahoo: {
    id: "yahoo",
    label: "Yahoo Mail",
    smtp: { host: "smtp.mail.yahoo.com", port: "465", secure: "true" },
    imap: { host: "imap.mail.yahoo.com", port: "993" },
    appPasswordUrl: "https://login.yahoo.com/myaccount/security/app-password",
    guide: ["Yahoo requires an App Password — create one (button below) and paste it as the SMTP password."],
  },
  privateemail: {
    id: "privateemail",
    label: "Namecheap Private Email",
    smtp: { host: "mail.privateemail.com", port: "465", secure: "true" },
    imap: { host: "mail.privateemail.com", port: "993" },
    guide: ["Use your full email address as the username and your mailbox password — no extra steps."],
  },
  hostinger: {
    id: "hostinger",
    label: "Hostinger Email",
    smtp: { host: "smtp.hostinger.com", port: "465", secure: "true" },
    imap: { host: "imap.hostinger.com", port: "993" },
    guide: ["Use your full email address as the username and your mailbox password — no extra steps."],
  },
  godaddy: {
    id: "godaddy",
    label: "GoDaddy Email",
    smtp: { host: "smtpout.secureserver.net", port: "465", secure: "true" },
    imap: { host: "imap.secureserver.net", port: "993" },
    guide: ["Use your full email address as the username and your mailbox password."],
  },
  cpanel: {
    id: "cpanel",
    label: "cPanel hosting (Namecheap shared, and most web hosts)",
    smtp: { host: "mail.{domain}", port: "465", secure: "true" },
    imap: { host: "mail.{domain}", port: "993" },
    guide: [
      "Username is your full email address; the password is the one set when the mailbox was created in cPanel.",
      "The exact hostnames are in cPanel → Email Accounts → Connect Devices, if mail.yourdomain doesn't work.",
    ],
  },
  generic: {
    id: "generic",
    label: "Other / my own mail server",
    smtp: { host: "mail.{domain}", port: "465", secure: "true" },
    imap: { host: "mail.{domain}", port: "993" },
    guide: [
      "We've guessed the common pattern (mail.yourdomain). If it fails, your email provider's help pages list the exact SMTP/IMAP hostnames.",
    ],
  },
};

/** Maps a domain's MX hosts to a provider preset id. */
export function classifyMx(mxHosts: string[]): string {
  const mx = mxHosts.map((h) => h.toLowerCase()).join(" ");
  if (/google\.com|googlemail\.com/.test(mx)) return "google";
  if (/olc\.protection\.outlook\.com/.test(mx)) return "outlook-personal";
  if (/protection\.outlook\.com/.test(mx)) return "microsoft365";
  if (/zoho/.test(mx)) return "zoho";
  if (/yahoodns|yahoo\.com/.test(mx)) return "yahoo";
  if (/privateemail\.com|registrar-servers\.com/.test(mx)) return "privateemail";
  if (/hostinger/.test(mx)) return "hostinger";
  if (/secureserver\.net/.test(mx)) return "godaddy";
  if (/web-hosting\.com/.test(mx)) return "cpanel";
  return "generic";
}

/** Fills the {domain} token with the user's email domain. */
export function resolvePreset(preset: ProviderPreset, email: string): ProviderPreset {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const fill = (h: string) => h.replace("{domain}", domain);
  return {
    ...preset,
    smtp: { ...preset.smtp, host: fill(preset.smtp.host) },
    imap: { ...preset.imap, host: fill(preset.imap.host) },
  };
}
