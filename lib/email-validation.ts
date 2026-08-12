import { resolve4, resolve6, resolveMx } from "dns/promises";

export type EmailVerificationStatus =
  | "unchecked"
  | "valid"
  | "risky"
  | "invalid"
  | "unknown";

export interface EmailVerification {
  status: EmailVerificationStatus;
  reason: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "dispostable.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "minutemail.com",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "throwawaymail.com",
  "yopmail.com",
]);

const domainCache = new Map<string, { result: EmailVerification; expiresAt: number }>();
const CACHE_MS = 24 * 60 * 60 * 1000;
const DNS_TIMEOUT_MS = 5_000;

function domainOf(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

export function inspectEmailSyntax(email: string): EmailVerification {
  const clean = email.trim().toLowerCase();
  if (!clean || clean.length > 254 || !EMAIL_RE.test(clean)) {
    return { status: "invalid", reason: "invalid email format" };
  }
  const domain = domainOf(clean);
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { status: "risky", reason: "disposable email provider" };
  }
  return { status: "unchecked", reason: "domain not checked yet" };
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("DNS lookup timed out")), DNS_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function hasAddressFallback(domain: string): Promise<boolean> {
  const results = await Promise.allSettled([
    withTimeout(resolve4(domain)),
    withTimeout(resolve6(domain)),
  ]);
  return results.some(
    (result) => result.status === "fulfilled" && result.value.length > 0
  );
}

/**
 * Conservative, no-third-party email check.
 *
 * This verifies syntax, known disposable providers, and whether the domain can
 * accept mail (MX, with RFC-compatible A/AAAA fallback). It deliberately does
 * not pretend to prove that a specific mailbox exists.
 */
export async function verifyEmailAddress(email: string): Promise<EmailVerification> {
  const syntax = inspectEmailSyntax(email);
  if (syntax.status !== "unchecked") return syntax;

  const domain = domainOf(email);
  const cached = domainCache.get(domain);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  let result: EmailVerification;
  try {
    const mx = await withTimeout(resolveMx(domain));
    const usable = mx.some((record) => record.exchange && record.exchange !== ".");
    if (usable) {
      result = { status: "valid", reason: "domain has mail exchange records" };
    } else if (mx.some((record) => record.exchange === ".")) {
      result = { status: "invalid", reason: "domain explicitly does not accept email" };
    } else {
      result = (await hasAddressFallback(domain))
        ? { status: "valid", reason: "domain accepts mail through its address record" }
        : { status: "invalid", reason: "domain has no mail route" };
    }
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
    if (code === "ENODATA" || code === "ENOTFOUND") {
      result = (await hasAddressFallback(domain))
        ? { status: "valid", reason: "domain accepts mail through its address record" }
        : { status: "invalid", reason: "domain has no mail route" };
    } else {
      // Temporary resolver failures must not permanently poison a good lead.
      result = { status: "unknown", reason: "domain check temporarily unavailable" };
    }
  }

  domainCache.set(domain, { result, expiresAt: Date.now() + CACHE_MS });
  return result;
}

export function verificationNeedsRefresh(
  status: string | null | undefined,
  checkedAt: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (!status || status === "unchecked" || status === "unknown" || !checkedAt) return true;
  const checked = new Date(checkedAt).getTime();
  return Number.isNaN(checked) || now.getTime() - checked > 30 * 24 * 60 * 60 * 1000;
}
