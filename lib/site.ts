/**
 * Public-facing site identity, used by the legal/pricing pages.
 * Override per deployment with env vars so the code stays generic.
 */
export const SITE = {
  name: "Outreach Studio",
  url: process.env.APP_URL || "https://outreach.sakodev.com",
  supportEmail: process.env.SUPPORT_EMAIL || "support@sakodev.com",
  /** The legal entity or person operating the service (shown in Terms/Privacy). */
  operator: process.env.LEGAL_OPERATOR || "Sako Dev",
} as const;
