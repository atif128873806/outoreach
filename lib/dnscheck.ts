import { resolveTxt } from "dns/promises";

/**
 * SPF / DKIM / DMARC lookup for a sender domain — the three DNS records that
 * decide whether email lands in the inbox or in spam. Shared by the in-app
 * Settings check and the public /tools/dns-checker.
 */

export interface DnsCheck {
  name: string;
  pass: boolean;
  detail: string;
  advice?: string;
}

export interface DnsCheckResult {
  domain: string;
  checks: DnsCheck[];
  summary: string;
}

async function txt(host: string): Promise<string[]> {
  try {
    const records = await resolveTxt(host);
    return records.map((parts) => parts.join(""));
  } catch {
    return [];
  }
}

const DKIM_SELECTORS = ["default", "mail", "selector1", "selector2", "k1", "s1", "dkim", "google", "zoho"];

export async function checkDomainDns(domain: string): Promise<DnsCheckResult> {
  const checks: DnsCheck[] = [];

  // SPF
  const root = await txt(domain);
  const spf = root.find((r) => r.toLowerCase().startsWith("v=spf1"));
  checks.push({
    name: "SPF",
    pass: Boolean(spf),
    detail: spf ? spf.slice(0, 120) : "No v=spf1 TXT record found",
    advice: spf
      ? undefined
      : `Add a TXT record on ${domain} like: v=spf1 a mx ~all (your host's docs will have the exact value)`,
  });

  // DMARC
  const dmarcRecords = await txt(`_dmarc.${domain}`);
  const dmarc = dmarcRecords.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
  checks.push({
    name: "DMARC",
    pass: Boolean(dmarc),
    detail: dmarc ? dmarc.slice(0, 120) : "No _dmarc TXT record found",
    advice: dmarc
      ? undefined
      : `Add a TXT record on _dmarc.${domain} like: v=DMARC1; p=none; rua=mailto:you@${domain}`,
  });

  // DKIM — needs a selector we can only guess, so try the common ones
  let dkimFound = "";
  for (const sel of DKIM_SELECTORS) {
    const records = await txt(`${sel}._domainkey.${domain}`);
    if (records.some((r) => r.includes("v=DKIM1") || r.includes("k=rsa") || r.includes("p="))) {
      dkimFound = sel;
      break;
    }
  }
  checks.push({
    name: "DKIM",
    pass: Boolean(dkimFound),
    detail: dkimFound
      ? `Found (selector: ${dkimFound})`
      : "Not found under common selectors — it may still exist under a custom selector",
    advice: dkimFound
      ? undefined
      : "Enable DKIM signing in your hosting/email panel (cPanel: Email Deliverability → Repair), then re-check",
  });

  const passed = checks.filter((c) => c.pass).length;
  return {
    domain,
    checks,
    summary:
      passed === 3
        ? "All three records found — your domain is set up for good deliverability."
        : `${passed}/3 records found. Fixing the missing ones significantly improves inbox placement.`,
  };
}

/** Extracts a bare domain from whatever the user pasted (email, URL, www.…). */
export function normalizeDomain(input: string): string | null {
  let d = input.trim().toLowerCase();
  if (!d) return null;
  if (d.includes("@")) d = d.split("@").pop() ?? "";
  d = d.replace(/^[a-z]+:\/\//, "").split("/")[0].split(":")[0];
  d = d.replace(/^www\./, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;
  return d;
}
