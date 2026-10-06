/**
 * May the server fetch this address on a user's behalf?
 *
 * The search path fetches sites that a *source* handed us. The re-check button
 * (and any future endpoint that takes a URL from the page) is different: the
 * address comes from the user, and a server that will fetch any address a user
 * names is a server an attacker can use to reach things only it can reach —
 * its own admin routes, a neighbouring container, or a hosting provider's
 * metadata endpoint. That is not a hypothetical class of bug; it is a routine
 * one, and it costs four lines to refuse the obvious cases.
 *
 * Refused: anything that is not http/https, and any host that is loopback,
 * private, link-local, carrier-grade NAT, multicast or a bare internal name.
 *
 * Honest limit: this checks the *literal* address, so a public hostname that
 * resolves to a private IP (DNS pointing at 10.0.0.5) still gets through. Closing
 * that requires resolving first and then pinning the connection to the resolved
 * IP, which is a bigger change than this endpoint justifies today. It is written
 * down here rather than left implied.
 */

const INTERNAL_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan", ".intranet"];

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true; // this network, private, loopback
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 169 && b === 254) return true; // link-local (cloud metadata lives here)
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast and reserved
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[/, "").replace(/\]$/, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true; // unspecified, loopback
  if (/^fe[89ab]/.test(h)) return true; // link-local
  if (/^f[cd]/.test(h)) return true; // unique local

  // IPv4 in an IPv6 coat — and it has two spellings. `new URL` normalises
  // ::ffff:127.0.0.1 into hex (::ffff:7f00:1), so matching only the dotted form
  // would have let the most obvious loopback name walk straight through.
  const dotted = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) return isPrivateIpv4(dotted[1]);
  const hex = h.match(/^(?:::ffff:|(?:0:){5}ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isPrivateIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  return false;
}

/** The reason this URL must not be fetched, or null when it is fine. */
export function safeFetchUrlReject(raw: string): string | null {
  const input = (raw ?? "").trim();
  if (!input) return "No website address given.";
  let parsed: URL;
  try {
    parsed = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return `"${input}" is not a web address.`;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Only http and https addresses can be checked.";
  }
  const host = parsed.hostname.replace(/\.+$/, "").toLowerCase();
  if (!host) return "That address has no host name.";
  if (host === "localhost" || INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    return "That address is on this server's own network.";
  }
  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return "That address is on a private network.";
  }
  return null;
}
