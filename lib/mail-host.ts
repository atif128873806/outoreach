import { resolve4, reverse } from "dns/promises";

/**
 * Server-side helpers for the SMTP wizard & connection tests.
 *
 * Shared/cPanel hosts often serve mail for `mail.customer-domain.com` with a
 * certificate that only covers the *server's* hostname (e.g.
 * `*.web-hosting.com`) — strict TLS then fails. The server's real name is in
 * the IP's reverse-DNS record, so we can discover it and hand it to the user
 * (or use it directly during detection).
 */
export async function findRealMailHost(host: string): Promise<string | null> {
  try {
    const [ip] = await resolve4(host);
    if (!ip) return null;
    const ptrs = await reverse(ip);
    const ptr = ptrs.find((p) => p && p.includes("."))?.replace(/\.$/, "");
    if (!ptr || ptr.toLowerCase() === host.toLowerCase()) return null;
    return ptr;
  } catch {
    return null;
  }
}

/** Turns raw SMTP/IMAP connection errors into instructions a user can follow. */
export async function friendlyMailboxError(err: unknown, host: string): Promise<string> {
  const raw = err instanceof Error ? err.message : String(err);

  if (/altnames|ERR_TLS_CERT_ALTNAME/i.test(raw)) {
    const real = await findRealMailHost(host);
    return real
      ? `Your provider's security certificate doesn't cover "${host}". Use the server's real hostname instead: ${real} — paste it as the SMTP host (and IMAP host), save, and test again.`
      : `Your provider's security certificate doesn't cover "${host}". Your hosting panel lists the exact mail server name (cPanel → Email Accounts → Connect Devices) — use that as the SMTP/IMAP host.`;
  }
  if (/EAUTH|\b535\b|Invalid login|authentication failed/i.test(raw)) {
    return `The mail server rejected the username or password. Gmail, Outlook, Zoho, and Yahoo require an App Password (not your normal password) — the Quick setup guide links to the right page. (${raw.slice(0, 90)})`;
  }
  if (/ENOTFOUND|EAI_AGAIN|ECONNREFUSED/i.test(raw)) {
    return `Couldn't reach "${host}" — the hostname looks wrong. Re-run Quick setup above, or check your provider's settings page. (${raw.slice(0, 70)})`;
  }
  if (/wrong version number|SSL routines|ssl3_get_record/i.test(raw)) {
    return "SSL/port mismatch: port 465 needs SSL turned ON, port 587 needs STARTTLS (SSL off). Flip the TLS/SSL setting to match the port and try again.";
  }
  if (/ETIMEDOUT|timed? ?out|greeting never received/i.test(raw)) {
    return `Connection to "${host}" timed out — usually a port/SSL mismatch (465 = SSL on, 587 = SSL off) or a firewall on the provider's side. (${raw.slice(0, 70)})`;
  }
  return raw;
}
